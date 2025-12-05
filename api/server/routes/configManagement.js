const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const checkAdmin = require('~/server/middleware/roles/admin');
const { clearAppConfigCache, getAppConfig } = require('~/server/services/Config/app');
const { CacheKeys } = require('librechat-data-provider');
const { getLogStores } = require('~/cache');
const { mcpServersRegistry } = require('@librechat/api');

const router = express.Router();

// Use the same path resolution as loadCustomConfig.js
// __dirname in routes is: api/server/routes
// We need to go up 3 levels: routes -> server -> api -> project root
const projectRoot = path.resolve(__dirname, '..', '..', '..');
// If CONFIG_PATH is not set, use the default path relative to project root
const defaultConfigPath = process.env.CONFIG_PATH || path.resolve(projectRoot, 'config.yaml');

// Debug logging (can be removed in production)
if (process.env.NODE_ENV === 'development') {
  logger.debug('Config file path:', defaultConfigPath);
  logger.debug('Config file exists:', fs.existsSync(defaultConfigPath));
}

/**
 * Load config.yaml file
 */
function loadConfigFile() {
  try {
    if (/^https?:\/\//.test(defaultConfigPath)) {
      throw new Error('Remote config files are not supported for editing');
    }
    
    // Check if file exists
    if (!fs.existsSync(defaultConfigPath)) {
      const error = new Error(
        `Config file not found at: ${defaultConfigPath}. ` +
        `Project root: ${projectRoot}. ` +
        `Please ensure config.yaml exists in the project root directory.`
      );
      logger.error(error.message);
      throw error;
    }
    
    const fileContents = fs.readFileSync(defaultConfigPath, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    logger.error('Failed to load config file:', error);
    throw error;
  }
}

/**
 * Save config.yaml file
 */
function saveConfigFile(config) {
  try {
    if (/^https?:\/\//.test(defaultConfigPath)) {
      throw new Error('Remote config files are not supported for editing');
    }
    const yamlString = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false,
    });
    fs.writeFileSync(defaultConfigPath, yamlString, 'utf8');
    return true;
  } catch (error) {
    logger.error('Failed to save config file:', error);
    throw error;
  }
}

/**
 * Clear relevant caches after config update
 */
async function clearCaches() {
  try {
    // Clear APP_CONFIG cache (including BASE_CONFIG_KEY)
    await clearAppConfigCache();
    
    // Clear STARTUP_CONFIG cache
    const configCache = getLogStores(CacheKeys.CONFIG_STORE);
    await configCache.delete(CacheKeys.STARTUP_CONFIG);
    
    // Reload config and update MCP servers registry
    try {
      const appConfig = await getAppConfig({ refresh: true });
      if (appConfig?.mcpConfig) {
        // Update the raw configs in MCP servers registry
        mcpServersRegistry.setRawConfigs(appConfig.mcpConfig);
        logger.info('MCP servers registry updated with new config');
      }
    } catch (error) {
      logger.warn('Failed to reload MCP config:', error);
    }
    
    logger.info('Config caches cleared and MCP registry updated');
  } catch (error) {
    logger.warn('Failed to clear some caches:', error);
  }
}

/**
 * GET /api/config/endpoints/custom
 * Get all custom endpoints
 */
router.get('/endpoints/custom', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    const customEndpoints = config?.endpoints?.custom || [];
    res.json({ success: true, data: customEndpoints });
  } catch (error) {
    logger.error('Failed to get custom endpoints:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/config/endpoints/custom
 * Create a new custom endpoint
 */
router.post('/endpoints/custom', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    if (!config.endpoints) {
      config.endpoints = {};
    }
    if (!config.endpoints.custom) {
      config.endpoints.custom = [];
    }

    const newEndpoint = req.body;
    config.endpoints.custom.push(newEndpoint);

    saveConfigFile(config);
    await clearCaches();

    res.json({ success: true, message: 'Custom endpoint created successfully' });
  } catch (error) {
    logger.error('Failed to create custom endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/config/endpoints/custom/:index
 * Update a custom endpoint by index
 */
router.put('/endpoints/custom/:index', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    const index = parseInt(req.params.index, 10);

    if (!config.endpoints?.custom || index < 0 || index >= config.endpoints.custom.length) {
      return res.status(404).json({ error: 'Custom endpoint not found' });
    }

    config.endpoints.custom[index] = req.body;

    saveConfigFile(config);
    await clearCaches();

    res.json({ success: true, message: 'Custom endpoint updated successfully' });
  } catch (error) {
    logger.error('Failed to update custom endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/config/endpoints/custom/:index
 * Delete a custom endpoint by index
 */
router.delete('/endpoints/custom/:index', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    const index = parseInt(req.params.index, 10);

    if (!config.endpoints?.custom || index < 0 || index >= config.endpoints.custom.length) {
      return res.status(404).json({ error: 'Custom endpoint not found' });
    }

    config.endpoints.custom.splice(index, 1);

    saveConfigFile(config);
    await clearCaches();

    res.json({ success: true, message: 'Custom endpoint deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete custom endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/config/mcp/servers
 * Get all MCP servers
 */
router.get('/mcp/servers', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    const mcpServers = config?.mcpServers || {};
    
    // Convert object to array with keys
    const serversArray = Object.entries(mcpServers).map(([name, config]) => ({
      name,
      ...config,
    }));

    res.json({ success: true, data: serversArray });
  } catch (error) {
    logger.error('Failed to get MCP servers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/config/mcp/servers
 * Create a new MCP server
 */
router.post('/mcp/servers', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const { name, ...serverConfig } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Server name is required' });
    }

    if (config.mcpServers[name]) {
      return res.status(400).json({ error: 'MCP server with this name already exists' });
    }

    config.mcpServers[name] = serverConfig;

    saveConfigFile(config);
    await clearCaches();

    res.json({ success: true, message: 'MCP server created successfully' });
  } catch (error) {
    logger.error('Failed to create MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/config/mcp/servers/:name
 * Update an MCP server by name
 */
router.put('/mcp/servers/:name', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    const oldName = req.params.name;
    const { name: newName, ...serverConfig } = req.body;

    if (!config.mcpServers || !config.mcpServers[oldName]) {
      return res.status(404).json({ error: 'MCP server not found' });
    }

    // If name changed, delete old and create new
    if (newName && newName !== oldName) {
      if (config.mcpServers[newName]) {
        return res.status(400).json({ error: 'MCP server with new name already exists' });
      }
      delete config.mcpServers[oldName];
      config.mcpServers[newName] = serverConfig;
    } else {
      // Update existing
      config.mcpServers[oldName] = { ...config.mcpServers[oldName], ...serverConfig };
    }

    saveConfigFile(config);
    await clearCaches();

    res.json({ success: true, message: 'MCP server updated successfully' });
  } catch (error) {
    logger.error('Failed to update MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/config/mcp/servers/:name
 * Delete an MCP server by name
 */
router.delete('/mcp/servers/:name', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const config = loadConfigFile();
    const name = req.params.name;

    if (!config.mcpServers || !config.mcpServers[name]) {
      return res.status(404).json({ error: 'MCP server not found' });
    }

    delete config.mcpServers[name];

    saveConfigFile(config);
    await clearCaches();

    res.json({ success: true, message: 'MCP server deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
