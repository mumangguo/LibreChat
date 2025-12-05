const { logger, webSearchKeys } = require('@librechat/data-schemas');
const { Tools, CacheKeys, Constants, FileSources } = require('librechat-data-provider');
const {
  MCPOAuthHandler,
  MCPTokenStorage,
  mcpServersRegistry,
  normalizeHttpError,
  extractWebSearchEnvVars,
} = require('@librechat/api');
const {
  deleteAllUserSessions,
  deleteAllSharedLinks,
  deleteUserById,
  deleteMessages,
  deletePresets,
  deleteConvos,
  deleteFiles,
  updateUser,
  findToken,
  getFiles,
} = require('~/models');
const {
  ConversationTag,
  Transaction,
  MemoryEntry,
  Assistant,
  AclEntry,
  Balance,
  Action,
  Group,
  Token,
  User,
} = require('~/db/models');
const { updateUserPluginAuth, deleteUserPluginAuth } = require('~/server/services/PluginService');
const { updateUserPluginsService, deleteUserKey } = require('~/server/services/UserService');
const { verifyEmail, resendVerificationEmail } = require('~/server/services/AuthService');
const { needsRefresh, getNewS3URL } = require('~/server/services/Files/S3/crud');
const { processDeleteRequest } = require('~/server/services/Files/process');
const { getMCPManager, getFlowStateManager } = require('~/config');
const { getAppConfig } = require('~/server/services/Config');
const { deleteToolCalls } = require('~/models/ToolCall');
const { deleteUserPrompts } = require('~/models/Prompt');
const { deleteUserAgents } = require('~/models/Agent');
const { getLogStores } = require('~/cache');

const getUserController = async (req, res) => {
  const appConfig = await getAppConfig({ role: req.user?.role });
  /** @type {IUser} */
  const userData = req.user.toObject != null ? req.user.toObject() : { ...req.user };
  /**
   * These fields should not exist due to secure field selection, but deletion
   * is done in case of alternate database incompatibility with Mongo API
   * */
  delete userData.password;
  delete userData.totpSecret;
  delete userData.backupCodes;
  if (appConfig.fileStrategy === FileSources.s3 && userData.avatar) {
    const avatarNeedsRefresh = needsRefresh(userData.avatar, 3600);
    if (!avatarNeedsRefresh) {
      return res.status(200).send(userData);
    }
    const originalAvatar = userData.avatar;
    try {
      userData.avatar = await getNewS3URL(userData.avatar);
      await updateUser(userData.id, { avatar: userData.avatar });
    } catch (error) {
      userData.avatar = originalAvatar;
      logger.error('Error getting new S3 URL for avatar:', error);
    }
  }
  res.status(200).send(userData);
};

const getTermsStatusController = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ termsAccepted: !!user.termsAccepted });
  } catch (error) {
    logger.error('Error fetching terms acceptance status:', error);
    res.status(500).json({ message: 'Error fetching terms acceptance status' });
  }
};

const acceptTermsController = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { termsAccepted: true }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'Terms accepted successfully' });
  } catch (error) {
    logger.error('Error accepting terms:', error);
    res.status(500).json({ message: 'Error accepting terms' });
  }
};

const deleteUserFiles = async (req) => {
  try {
    const userFiles = await getFiles({ user: req.user.id });
    await processDeleteRequest({
      req,
      files: userFiles,
    });
  } catch (error) {
    logger.error('[deleteUserFiles]', error);
  }
};

const updateUserPluginsController = async (req, res) => {
  const appConfig = await getAppConfig({ role: req.user?.role });
  const { user } = req;
  const { pluginKey, action, auth, isEntityTool } = req.body;
  try {
    if (!isEntityTool) {
      const userPluginsService = await updateUserPluginsService(user, pluginKey, action);

      if (userPluginsService instanceof Error) {
        logger.error('[userPluginsService]', userPluginsService);
        const { status, message } = normalizeHttpError(userPluginsService);
        return res.status(status).send({ message });
      }
    }

    if (auth == null) {
      return res.status(200).send();
    }

    let keys = Object.keys(auth);
    const values = Object.values(auth); // Used in 'install' block

    const isMCPTool = pluginKey.startsWith('mcp_') || pluginKey.includes(Constants.mcp_delimiter);

    // Early exit condition:
    // If keys are empty (meaning auth: {} was likely sent for uninstall, or auth was empty for install)
    // AND it's not web_search (which has special key handling to populate `keys` for uninstall)
    // AND it's NOT (an uninstall action FOR an MCP tool - we need to proceed for this case to clear all its auth)
    // THEN return.
    if (
      keys.length === 0 &&
      pluginKey !== Tools.web_search &&
      !(action === 'uninstall' && isMCPTool)
    ) {
      return res.status(200).send();
    }

    /** @type {number} */
    let status = 200;
    /** @type {string} */
    let message;
    /** @type {IPluginAuth | Error} */
    let authService;

    if (pluginKey === Tools.web_search) {
      /** @type  {TCustomConfig['webSearch']} */
      const webSearchConfig = appConfig?.webSearch;
      keys = extractWebSearchEnvVars({
        keys: action === 'install' ? keys : webSearchKeys,
        config: webSearchConfig,
      });
    }

    if (action === 'install') {
      for (let i = 0; i < keys.length; i++) {
        authService = await updateUserPluginAuth(user.id, keys[i], pluginKey, values[i]);
        if (authService instanceof Error) {
          logger.error('[authService]', authService);
          ({ status, message } = normalizeHttpError(authService));
        }
      }
    } else if (action === 'uninstall') {
      // const isMCPTool was defined earlier
      if (isMCPTool && keys.length === 0) {
        // This handles the case where auth: {} is sent for an MCP tool uninstall.
        // It means "delete all credentials associated with this MCP pluginKey".
        authService = await deleteUserPluginAuth(user.id, null, true, pluginKey);
        if (authService instanceof Error) {
          logger.error(
            `[authService] Error deleting all auth for MCP tool ${pluginKey}:`,
            authService,
          );
          ({ status, message } = normalizeHttpError(authService));
        }
        try {
          // if the MCP server uses OAuth, perform a full cleanup and token revocation
          await maybeUninstallOAuthMCP(user.id, pluginKey, appConfig);
        } catch (error) {
          logger.error(
            `[updateUserPluginsController] Error uninstalling OAuth MCP for ${pluginKey}:`,
            error,
          );
        }
      } else {
        // This handles:
        // 1. Web_search uninstall (keys will be populated with all webSearchKeys if auth was {}).
        // 2. Other tools uninstall (if keys were provided).
        // 3. MCP tool uninstall if specific keys were provided in `auth` (not current frontend behavior).
        // If keys is empty for non-MCP tools (and not web_search), this loop won't run, and nothing is deleted.
        for (let i = 0; i < keys.length; i++) {
          authService = await deleteUserPluginAuth(user.id, keys[i]); // Deletes by authField name
          if (authService instanceof Error) {
            logger.error('[authService] Error deleting specific auth key:', authService);
            ({ status, message } = normalizeHttpError(authService));
          }
        }
      }
    }

    if (status === 200) {
      // If auth was updated successfully, disconnect MCP sessions as they might use these credentials
      if (pluginKey.startsWith(Constants.mcp_prefix)) {
        try {
          const mcpManager = getMCPManager();
          if (mcpManager) {
            // Extract server name from pluginKey (format: "mcp_<serverName>")
            const serverName = pluginKey.replace(Constants.mcp_prefix, '');
            logger.info(
              `[updateUserPluginsController] Attempting disconnect of MCP server "${serverName}" for user ${user.id} after plugin auth update.`,
            );
            await mcpManager.disconnectUserConnection(user.id, serverName);
          }
        } catch (disconnectError) {
          logger.error(
            `[updateUserPluginsController] Error disconnecting MCP connection for user ${user.id} after plugin auth update:`,
            disconnectError,
          );
          // Do not fail the request for this, but log it.
        }
      }
      return res.status(status).send();
    }

    const normalized = normalizeHttpError({ status, message });
    return res.status(normalized.status).send({ message: normalized.message });
  } catch (err) {
    logger.error('[updateUserPluginsController]', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const deleteUserController = async (req, res) => {
  const { user } = req;

  try {
    await deleteMessages({ user: user.id }); // delete user messages
    await deleteAllUserSessions({ userId: user.id }); // delete user sessions
    await Transaction.deleteMany({ user: user.id }); // delete user transactions
    await deleteUserKey({ userId: user.id, all: true }); // delete user keys
    await Balance.deleteMany({ user: user._id }); // delete user balances
    await deletePresets(user.id); // delete user presets
    try {
      await deleteConvos(user.id); // delete user convos
    } catch (error) {
      logger.error('[deleteUserController] Error deleting user convos, likely no convos', error);
    }
    await deleteUserPluginAuth(user.id, null, true); // delete user plugin auth
    await deleteUserById(user.id); // delete user
    await deleteAllSharedLinks(user.id); // delete user shared links
    await deleteUserFiles(req); // delete user files
    await deleteFiles(null, user.id); // delete database files in case of orphaned files from previous steps
    await deleteToolCalls(user.id); // delete user tool calls
    await deleteUserAgents(user.id); // delete user agents
    await Assistant.deleteMany({ user: user.id }); // delete user assistants
    await ConversationTag.deleteMany({ user: user.id }); // delete user conversation tags
    await MemoryEntry.deleteMany({ userId: user.id }); // delete user memory entries
    await deleteUserPrompts(req, user.id); // delete user prompts
    await Action.deleteMany({ user: user.id }); // delete user actions
    await Token.deleteMany({ userId: user.id }); // delete user OAuth tokens
    await Group.updateMany(
      // remove user from all groups
      { memberIds: user.id },
      { $pull: { memberIds: user.id } },
    );
    await AclEntry.deleteMany({ principalId: user._id }); // delete user ACL entries
    logger.info(`User deleted account. Email: ${user.email} ID: ${user.id}`);
    res.status(200).send({ message: 'User deleted' });
  } catch (err) {
    logger.error('[deleteUserController]', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const listUsersController = async (req, res) => {
  try {
    // Only admin can list users
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const users = await User.find(
      {},
      'id name username email avatar role provider createdAt updatedAt',
    )
      .sort({ createdAt: -1 })
      .lean();

    // Remove sensitive fields and format response
    const safeUsers = users.map((user) => {
      const userObj = { ...user };
      delete userObj.password;
      delete userObj.totpSecret;
      delete userObj.backupCodes;
      delete userObj.refreshToken;
      return {
        id: userObj._id?.toString() || userObj.id,
        name: userObj.name || '',
        username: userObj.username || '',
        email: userObj.email || '',
        avatar: userObj.avatar || '',
        role: userObj.role || 'USER',
        provider: userObj.provider || 'local',
        createdAt: userObj.createdAt?.toISOString() || '',
        updatedAt: userObj.updatedAt?.toISOString() || '',
      };
    });

    res.status(200).json({ data: safeUsers });
  } catch (error) {
    logger.error('[listUsersController] Error listing users:', error);
    res.status(500).json({ message: 'Error listing users' });
  }
};

const deleteUserByIdController = async (req, res) => {
  try {
    // Only admin can delete users
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { user_id } = req.params;
    const currentUserId = req.user.id;

    // Prevent self-deletion
    if (user_id === currentUserId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const targetUser = await User.findById(user_id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Use the same deletion logic as deleteUserController
    await deleteMessages({ user: user_id });
    await deleteAllUserSessions({ userId: user_id });
    await Transaction.deleteMany({ user: user_id });
    await deleteUserKey({ userId: user_id, all: true });
    await Balance.deleteMany({ user: targetUser._id });
    await deletePresets(user_id);
    try {
      await deleteConvos(user_id);
    } catch (error) {
      logger.error('[deleteUserByIdController] Error deleting user convos', error);
    }
    await deleteUserPluginAuth(user_id, null, true);
    await deleteUserById(user_id);
    await deleteAllSharedLinks(user_id);
    await deleteFiles(null, user_id);
    await deleteToolCalls(user_id);
    await deleteUserAgents(user_id);
    await Assistant.deleteMany({ user: user_id });
    await ConversationTag.deleteMany({ user: user_id });
    await MemoryEntry.deleteMany({ userId: user_id });
    await Action.deleteMany({ user: user_id });
    await Token.deleteMany({ userId: user_id });
    await Group.updateMany({ memberIds: user_id }, { $pull: { memberIds: user_id } });
    await AclEntry.deleteMany({ principalId: targetUser._id });

    logger.info(`Admin deleted user. Email: ${targetUser.email} ID: ${user_id}`);
    res.status(200).send({ message: 'User deleted' });
  } catch (err) {
    logger.error('[deleteUserByIdController]', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const createUserController = async (req, res) => {
  try {
    // Only admin can create users
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { email, username, name, password, role } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const bcrypt = require('bcryptjs');
    const { SystemRoles } = require('librechat-data-provider');
    const { createUser: createUserModel } = require('~/models');
    const { getAppConfig } = require('~/server/services/Config');

    const appConfig = await getAppConfig({ role: req.user?.role });
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUserData = {
      email: email.toLowerCase(),
      username: username || '',
      name: name || username || '',
      password: hashedPassword,
      role: role || SystemRoles.USER,
      provider: 'local',
      emailVerified: true, // Admin created users are auto-verified
    };

    const newUser = await createUserModel(newUserData, appConfig.balance, true, true);

    // Format response
    const userObj = newUser.toObject ? newUser.toObject() : { ...newUser };
    delete userObj.password;
    delete userObj.totpSecret;
    delete userObj.backupCodes;
    delete userObj.refreshToken;

    res.status(201).json({
      id: userObj._id?.toString() || userObj.id,
      name: userObj.name || '',
      username: userObj.username || '',
      email: userObj.email || '',
      avatar: userObj.avatar || '',
      role: userObj.role || 'USER',
      provider: userObj.provider || 'local',
      createdAt: userObj.createdAt?.toISOString() || '',
      updatedAt: userObj.updatedAt?.toISOString() || '',
    });
  } catch (error) {
    logger.error('[createUserController] Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

const updateUserByIdController = async (req, res) => {
  try {
    // Only admin can update users
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { user_id } = req.params;
    const { name, username, email, role, password } = req.body;

    const targetUser = await User.findById(user_id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user_id },
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      updateData.email = email.toLowerCase();
    }
    if (role !== undefined) {
      const { SystemRoles } = require('librechat-data-provider');
      if (role !== SystemRoles.ADMIN && role !== SystemRoles.USER) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      updateData.role = role;
    }
    if (password !== undefined && password !== '') {
      const bcrypt = require('bcryptjs');
      const salt = bcrypt.genSaltSync(10);
      updateData.password = bcrypt.hashSync(password, salt);
    }

    const updatedUser = await updateUser(user_id, updateData);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format response
    const userObj = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser };
    delete userObj.password;
    delete userObj.totpSecret;
    delete userObj.backupCodes;
    delete userObj.refreshToken;

    res.status(200).json({
      id: userObj._id?.toString() || userObj.id,
      name: userObj.name || '',
      username: userObj.username || '',
      email: userObj.email || '',
      avatar: userObj.avatar || '',
      role: userObj.role || 'USER',
      provider: userObj.provider || 'local',
      createdAt: userObj.createdAt?.toISOString() || '',
      updatedAt: userObj.updatedAt?.toISOString() || '',
    });
  } catch (error) {
    logger.error('[updateUserByIdController] Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
};

const verifyEmailController = async (req, res) => {
  try {
    const verifyEmailService = await verifyEmail(req);
    if (verifyEmailService instanceof Error) {
      return res.status(400).json(verifyEmailService);
    } else {
      return res.status(200).json(verifyEmailService);
    }
  } catch (e) {
    logger.error('[verifyEmailController]', e);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

const resendVerificationController = async (req, res) => {
  try {
    const result = await resendVerificationEmail(req);
    if (result instanceof Error) {
      return res.status(400).json(result);
    } else {
      return res.status(200).json(result);
    }
  } catch (e) {
    logger.error('[verifyEmailController]', e);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

/**
 * OAuth MCP specific uninstall logic
 */
const maybeUninstallOAuthMCP = async (userId, pluginKey, appConfig) => {
  if (!pluginKey.startsWith(Constants.mcp_prefix)) {
    // this is not an MCP server, so nothing to do here
    return;
  }

  const serverName = pluginKey.replace(Constants.mcp_prefix, '');
  const serverConfig =
    (await mcpServersRegistry.getServerConfig(serverName, userId)) ??
    appConfig?.mcpServers?.[serverName];
  const oauthServers = await mcpServersRegistry.getOAuthServers();
  if (!oauthServers.has(serverName)) {
    // this server does not use OAuth, so nothing to do here as well
    return;
  }

  // 1. get client info used for revocation (client id, secret)
  const clientTokenData = await MCPTokenStorage.getClientInfoAndMetadata({
    userId,
    serverName,
    findToken,
  });
  if (clientTokenData == null) {
    return;
  }
  const { clientInfo, clientMetadata } = clientTokenData;

  // 2. get decrypted tokens before deletion
  const tokens = await MCPTokenStorage.getTokens({
    userId,
    serverName,
    findToken,
  });

  // 3. revoke OAuth tokens at the provider
  const revocationEndpoint =
    serverConfig.oauth?.revocation_endpoint ?? clientMetadata.revocation_endpoint;
  const revocationEndpointAuthMethodsSupported =
    serverConfig.oauth?.revocation_endpoint_auth_methods_supported ??
    clientMetadata.revocation_endpoint_auth_methods_supported;
  const oauthHeaders = serverConfig.oauth_headers ?? {};

  if (tokens?.access_token) {
    try {
      await MCPOAuthHandler.revokeOAuthToken(
        serverName,
        tokens.access_token,
        'access',
        {
          serverUrl: serverConfig.url,
          clientId: clientInfo.client_id,
          clientSecret: clientInfo.client_secret ?? '',
          revocationEndpoint,
          revocationEndpointAuthMethodsSupported,
        },
        oauthHeaders,
      );
    } catch (error) {
      logger.error(`Error revoking OAuth access token for ${serverName}:`, error);
    }
  }

  if (tokens?.refresh_token) {
    try {
      await MCPOAuthHandler.revokeOAuthToken(
        serverName,
        tokens.refresh_token,
        'refresh',
        {
          serverUrl: serverConfig.url,
          clientId: clientInfo.client_id,
          clientSecret: clientInfo.client_secret ?? '',
          revocationEndpoint,
          revocationEndpointAuthMethodsSupported,
        },
        oauthHeaders,
      );
    } catch (error) {
      logger.error(`Error revoking OAuth refresh token for ${serverName}:`, error);
    }
  }

  // 4. delete tokens from the DB after revocation attempts
  await MCPTokenStorage.deleteUserTokens({
    userId,
    serverName,
    deleteToken: async (filter) => {
      await Token.deleteOne(filter);
    },
  });

  // 5. clear the flow state for the OAuth tokens
  const flowsCache = getLogStores(CacheKeys.FLOWS);
  const flowManager = getFlowStateManager(flowsCache);
  const flowId = MCPOAuthHandler.generateFlowId(userId, serverName);
  await flowManager.deleteFlow(flowId, 'mcp_get_tokens');
  await flowManager.deleteFlow(flowId, 'mcp_oauth');
};

module.exports = {
  getUserController,
  getTermsStatusController,
  acceptTermsController,
  deleteUserController,
  verifyEmailController,
  updateUserPluginsController,
  resendVerificationController,
  listUsersController,
  deleteUserByIdController,
  createUserController,
  updateUserByIdController,
};
