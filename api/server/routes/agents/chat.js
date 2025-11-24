const express = require('express');
const { randomUUID } = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { generateCheckAccess, skipAgentCheck } = require('@librechat/api');
const { PermissionTypes, Permissions, PermissionBits } = require('librechat-data-provider');
const {
  setHeaders,
  moderateText,
  // validateModel,
  validateConvoAccess,
  buildEndpointOption,
  canAccessAgentFromBody,
} = require('~/server/middleware');
const { initializeClient } = require('~/server/services/Endpoints/agents');
const AgentController = require('~/server/controllers/agents/request');
const addTitle = require('~/server/services/Endpoints/agents/title');
const { getRoleByName } = require('~/models/Role');

const router = express.Router();

router.use(moderateText);

const checkAgentAccess = generateCheckAccess({
  permissionType: PermissionTypes.AGENTS,
  permissions: [Permissions.USE],
  skipCheck: skipAgentCheck,
  getRoleByName,
});
const checkAgentResourceAccess = canAccessAgentFromBody({
  requiredPermission: PermissionBits.VIEW,
});

router.use(checkAgentAccess);
router.use(checkAgentResourceAccess);
router.use(validateConvoAccess);
router.use(buildEndpointOption);
router.use(setHeaders);

const controller = async (req, res, next) => {
  const traceId =
    req.traceId ||
    req.headers['x-trace-id'] ||
    req.headers['x-request-id'] ||
    randomUUID().replace(/-/g, '');

  req.traceId = traceId;
  res.locals.traceId = traceId;

  const start = Date.now();
  const logContext = {
    traceId,
    userId: req.user?.id ?? null,
    conversationId: req.body?.conversationId ?? null,
    endpoint: req.body?.endpointOption?.endpoint ?? req.params?.endpoint ?? 'default',
    route: 'POST /api/agents/chat',
  };

  logger.info('[routes/agents/chat] Incoming request', logContext);

  try {
    await AgentController(req, res, next, initializeClient, addTitle);
    logger.info('[routes/agents/chat] Request completed', {
      ...logContext,
      durationMs: Date.now() - start,
    });
  } catch (error) {
    logger.error('[routes/agents/chat] Request failed', {
      ...logContext,
      durationMs: Date.now() - start,
      error: error?.message,
    });
    next(error);
  }
};

/**
 * @route POST / (regular endpoint)
 * @desc Chat with an assistant
 * @access Public
 * @param {express.Request} req - The request object, containing the request data.
 * @param {express.Response} res - The response object, used to send back a response.
 * @returns {void}
 */
router.post('/', controller);

/**
 * @route POST /:endpoint (ephemeral agents)
 * @desc Chat with an assistant
 * @access Public
 * @param {express.Request} req - The request object, containing the request data.
 * @param {express.Response} res - The response object, used to send back a response.
 * @returns {void}
 */
router.post('/:endpoint', controller);

module.exports = router;
