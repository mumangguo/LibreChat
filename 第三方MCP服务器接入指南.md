# LibreChat 第三方 MCP 服务器接入指南

## 概述

本文档详细说明如何在 LibreChat 中接入第三方 MCP（Model Context Protocol）服务器。由于前端没有直接添加 MCP 服务器的入口，所有 MCP 服务器都需要通过配置文件进行添加。

## 目录

1. [MCP 服务器类型](#mcp-服务器类型)
2. [配置文件位置](#配置文件位置)
3. [基础配置](#基础配置)
4. [传输类型详解](#传输类型详解)
5. [认证配置](#认证配置)
6. [完整配置示例](#完整配置示例)
7. [前端管理](#前端管理)
8. [故障排除](#故障排除)

---

## MCP 服务器类型

LibreChat 支持四种 MCP 传输类型：

1. **stdio** - 标准输入输出（最常用）
2. **sse** - Server-Sent Events
3. **websocket** - WebSocket 连接
4. **streamable-http** / **http** - 流式 HTTP 连接

---

## 配置文件位置

MCP 服务器配置在 LibreChat 的配置文件中：

- **配置文件**: `librechat.yaml`（或 `librechat.example.yaml` 作为参考）
- **配置节**: `mcpServers`

### 配置文件示例位置

```yaml
# 在 librechat.yaml 文件中
mcpServers:
  server-name:
    # 配置项...
```

---

## 基础配置

### 1. stdio 类型（标准输入输出）

最常用的类型，适用于通过命令行启动的 MCP 服务器。

#### 基本结构

```yaml
mcpServers:
  server-name:
    type: stdio  # 可选，默认为 stdio
    command: <可执行命令>
    args:
      - <参数1>
      - <参数2>
    timeout: 60000  # 超时时间（毫秒），可选
    startup: true   # 是否在启动时初始化，默认 true
    iconPath: /path/to/icon.svg  # 图标路径，可选
```

#### 示例：使用 npx 运行 MCP 服务器

```yaml
mcpServers:
  puppeteer:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-puppeteer"
    timeout: 300000  # 5 分钟超时
```

#### 示例：使用本地命令

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - /home/user/documents  # 文件系统路径
    iconPath: /home/user/LibreChat/client/public/assets/logo.svg
```

#### 示例：使用环境变量

```yaml
mcpServers:
  custom-server:
    type: stdio
    command: ${CUSTOM_MCP_COMMAND}  # 从环境变量读取
    args:
      - ${CUSTOM_MCP_ARG1}
      - ${CUSTOM_MCP_ARG2}
    env:
      API_KEY: ${MY_API_KEY}  # 设置环境变量
      CUSTOM_VAR: "value"
```

### 2. SSE 类型（Server-Sent Events）

适用于通过 HTTP SSE 端点提供的 MCP 服务器。

```yaml
mcpServers:
  everything:
    type: sse  # 可选，如果只有 url 则默认为 sse
    url: http://localhost:3001/sse
    timeout: 60000
    headers:  # 可选的自定义请求头
      Authorization: "Bearer ${API_TOKEN}"
      X-Custom-Header: "value"
```

### 3. WebSocket 类型

适用于通过 WebSocket 连接的 MCP 服务器。

```yaml
mcpServers:
  websocket-server:
    type: websocket
    url: ws://localhost:8080/mcp  # 或 wss:// 用于安全连接
    timeout: 60000
```

### 4. Streamable HTTP 类型

适用于通过流式 HTTP 连接的 MCP 服务器。

```yaml
mcpServers:
  http-server:
    type: streamable-http  # 或 http
    url: http://localhost:3000/mcp
    timeout: 60000
    headers:
      Authorization: "Bearer ${API_TOKEN}"
```

---

## 认证配置

### 1. 自定义用户变量（customUserVars）

用于需要用户提供认证信息的 MCP 服务器（如 API Key、Token 等）。

```yaml
mcpServers:
  github:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-github"
    customUserVars:
      GITHUB_PAT:  # 变量名，会在前端显示为输入框
        title: "GitHub Personal Access Token"
        description: "Your GitHub Personal Access Token with appropriate permissions"
    startup: false  # 设置为 false，等待用户配置后再初始化
```

**说明**：
- `customUserVars` 中的键名会作为环境变量传递给 MCP 服务器
- `title` 和 `description` 会在前端 MCP 面板中显示
- 用户可以在前端 MCP 面板中配置这些变量
- 配置后，这些变量会通过 `${VAR_NAME}` 语法在配置中使用

### 2. OAuth 认证

适用于需要 OAuth 流程的 MCP 服务器。

#### 基础 OAuth 配置

```yaml
mcpServers:
  oauth-server:
    type: sse
    url: https://api.example.com/mcp
    requiresOAuth: true  # 标记需要 OAuth
    oauth:
      authorization_url: https://api.example.com/oauth/authorize
      token_url: https://api.example.com/oauth/token
      client_id: ${OAUTH_CLIENT_ID}  # 从环境变量读取
      client_secret: ${OAUTH_CLIENT_SECRET}
      scope: "read write"
      redirect_uri: http://localhost:3080/api/mcp/oauth-server/oauth/callback
```

#### 完整 OAuth 配置（所有可选参数）

```yaml
mcpServers:
  full-oauth-server:
    type: sse
    url: https://api.example.com/mcp
    requiresOAuth: true
    oauth:
      # 基础配置
      authorization_url: https://api.example.com/oauth/authorize
      token_url: https://api.example.com/oauth/token
      client_id: ${OAUTH_CLIENT_ID}
      client_secret: ${OAUTH_CLIENT_SECRET}
      scope: "read write"
      redirect_uri: http://localhost:3080/api/mcp/full-oauth-server/oauth/callback
      
      # 高级配置
      token_exchange_method: "POST"  # 或 "GET"
      grant_types_supported:
        - "authorization_code"
        - "refresh_token"
      token_endpoint_auth_methods_supported:
        - "client_secret_basic"
        - "client_secret_post"
      response_types_supported:
        - "code"
      code_challenge_methods_supported:
        - "S256"
        - "plain"
      skip_code_challenge_check: false
      revocation_endpoint: https://api.example.com/oauth/revoke
      revocation_endpoint_auth_methods_supported:
        - "client_secret_basic"
    oauth_headers:  # OAuth 请求的自定义请求头
      X-Custom-Header: "value"
```

**OAuth 自动发现**：

如果某些 OAuth 参数未配置，LibreChat 会尝试自动发现：
- 当收到 401 响应时，会自动检测是否需要 OAuth
- 可以自动发现 `authorization_url`、`token_url` 等端点
- 支持动态客户端注册

---

## 完整配置示例

### 示例 1：基础 stdio 服务器

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - /home/user/documents
    timeout: 60000
    startup: true
    iconPath: /home/user/LibreChat/client/public/assets/filesystem.svg
```

### 示例 2：带自定义用户变量的服务器

```yaml
mcpServers:
  github:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-github"
    customUserVars:
      GITHUB_PAT:
        title: "GitHub Personal Access Token"
        description: "Create a PAT at https://github.com/settings/tokens with 'repo' scope"
    startup: false  # 等待用户配置
    timeout: 300000
```

### 示例 3：SSE 服务器

```yaml
mcpServers:
  everything:
    type: sse
    url: http://localhost:3001/sse
    timeout: 60000
    startup: true
    chatMenu: true  # 在聊天菜单中显示
```

### 示例 4：OAuth 服务器

```yaml
mcpServers:
  google-drive:
    type: sse
    url: https://mcp-server.example.com/google-drive
    requiresOAuth: true
    oauth:
      authorization_url: https://accounts.google.com/o/oauth2/v2/auth
      token_url: https://oauth2.googleapis.com/token
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      scope: "https://www.googleapis.com/auth/drive.readonly"
      redirect_uri: http://localhost:3080/api/mcp/google-drive/oauth/callback
    startup: false
```

### 示例 5：复杂配置（环境变量 + 自定义变量）

```yaml
mcpServers:
  custom-api:
    type: stdio
    command: python
    args:
      - /path/to/mcp-server.py
      - --api-url
      - ${API_BASE_URL}
      - --api-key
      - ${CUSTOM_API_KEY}
    env:
      PYTHONPATH: /path/to/python/libs
      LOG_LEVEL: "INFO"
    customUserVars:
      CUSTOM_API_KEY:
        title: "API Key"
        description: "Your API key for the custom service"
      USER_ID:
        title: "User ID"
        description: "Your user ID"
    timeout: 120000
    startup: false
```

---

## 配置选项说明

### 通用选项

| 选项 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `type` | string | 否 | `stdio` | 传输类型：`stdio`、`sse`、`websocket`、`streamable-http` |
| `timeout` | number | 否 | `60000` | 超时时间（毫秒） |
| `startup` | boolean | 否 | `true` | 是否在应用启动时初始化 |
| `iconPath` | string | 否 | - | 服务器图标路径（相对于项目根目录或绝对路径） |
| `chatMenu` | boolean | 否 | `false` | 是否在聊天下拉菜单中显示 |
| `serverInstructions` | boolean/string | 否 | - | 服务器指令：`true` 使用服务器提供的，字符串使用自定义的 |
| `initTimeout` | number | 否 | - | 初始化超时时间（毫秒） |

### stdio 特定选项

| 选项 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `command` | string | 是 | 可执行命令 |
| `args` | array | 是 | 命令行参数数组 |
| `env` | object | 否 | 环境变量对象 |
| `stderr` | string | 否 | stderr 处理方式 |

### SSE/WebSocket/HTTP 特定选项

| 选项 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 服务器 URL |
| `headers` | object | 否 | 自定义请求头 |

### 认证选项

| 选项 | 类型 | 说明 |
|------|------|------|
| `customUserVars` | object | 自定义用户变量配置 |
| `requiresOAuth` | boolean | 是否需要 OAuth 认证 |
| `oauth` | object | OAuth 配置对象 |

---

## 前端管理

### MCP 面板位置

1. 进入 LibreChat
2. 点击左侧边栏的 **设置**（Settings）
3. 找到 **MCP Servers** 部分

### 功能说明

前端 MCP 面板提供以下功能：

1. **查看已配置的服务器**
   - 显示所有在 `librechat.yaml` 中配置的 MCP 服务器
   - 显示连接状态（connected/disconnected/connecting/error）

2. **配置自定义用户变量**
   - 如果服务器配置了 `customUserVars`，可以在这里输入值
   - 例如：GitHub PAT、API Key 等

3. **OAuth 认证**
   - 如果服务器需要 OAuth，会显示 OAuth 登录按钮
   - 点击后跳转到 OAuth 授权页面

4. **初始化服务器**
   - 对于 `startup: false` 的服务器，可以手动初始化
   - 初始化后，工具会自动加载

### 限制

⚠️ **重要**：前端**无法添加新的 MCP 服务器**，只能：
- 管理已在配置文件中定义的服务器
- 配置这些服务器的认证信息
- 查看连接状态

要添加新的 MCP 服务器，必须：
1. 编辑 `librechat.yaml` 文件
2. 添加服务器配置
3. 重启 LibreChat 服务器

---

## 配置步骤

### 步骤 1：编辑配置文件

找到并编辑 `librechat.yaml` 文件：

```bash
# 如果文件不存在，从示例文件复制
cp librechat.example.yaml librechat.yaml

# 编辑配置文件
nano librechat.yaml  # 或使用你喜欢的编辑器
```

### 步骤 2：添加 MCP 服务器配置

在 `mcpServers` 部分添加你的服务器配置：

```yaml
mcpServers:
  my-custom-server:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-custom"
    timeout: 60000
```

### 步骤 3：保存并重启

```bash
# 保存配置文件后，重启 LibreChat
# Docker 方式
docker-compose restart

# 或直接重启 Node.js 进程
pm2 restart librechat
# 或
npm run backend:dev
```

### 步骤 4：验证配置

1. 检查服务器日志，确认 MCP 服务器已初始化
2. 在前端 MCP 面板中查看服务器是否出现
3. 如果配置了 `customUserVars`，在前端配置认证信息
4. 如果配置了 OAuth，完成 OAuth 流程

---

## 环境变量使用

### 在配置中使用环境变量

可以使用 `${VAR_NAME}` 语法引用环境变量：

```yaml
mcpServers:
  server:
    url: ${MCP_SERVER_URL}
    command: ${MCP_COMMAND}
    args:
      - ${MCP_ARG1}
```

### 设置环境变量

**方式 1：`.env` 文件**

```bash
# .env
MCP_SERVER_URL=http://localhost:3001
MCP_COMMAND=npx
MCP_ARG1=@modelcontextprotocol/server-example
```

**方式 2：系统环境变量**

```bash
export MCP_SERVER_URL=http://localhost:3001
export MCP_COMMAND=npx
```

**方式 3：Docker Compose**

```yaml
services:
  librechat:
    environment:
      - MCP_SERVER_URL=http://localhost:3001
      - MCP_COMMAND=npx
```

---

## 故障排除

### 问题 1：服务器未出现在前端

**可能原因**：
- 配置文件格式错误
- 服务器未正确初始化
- 需要重启 LibreChat

**解决方案**：
1. 检查 YAML 语法是否正确（缩进、引号等）
2. 查看服务器日志中的错误信息
3. 确认 `mcpServers` 配置节名称正确
4. 重启 LibreChat 服务器

### 问题 2：连接失败

**可能原因**：
- URL 不正确
- 命令路径错误
- 权限问题
- 网络问题

**解决方案**：
1. 验证 URL 或命令路径
2. 检查文件权限（stdio 类型）
3. 测试网络连接（SSE/WebSocket/HTTP 类型）
4. 查看详细错误日志

### 问题 3：OAuth 认证失败

**可能原因**：
- OAuth 配置错误
- redirect_uri 不匹配
- client_id/client_secret 错误

**解决方案**：
1. 验证 `redirect_uri` 格式：`http://your-domain/api/mcp/{serverName}/oauth/callback`
2. 检查 OAuth 提供商的配置
3. 确认 client_id 和 client_secret 正确
4. 查看浏览器控制台和服务器日志

### 问题 4：自定义用户变量未生效

**可能原因**：
- 变量名不匹配
- 用户未在前端配置
- 环境变量优先级问题

**解决方案**：
1. 确认 `customUserVars` 中的键名与服务器期望的环境变量名一致
2. 在前端 MCP 面板中配置变量值
3. 检查变量是否通过 `${VAR_NAME}` 正确引用

### 问题 5：工具未加载

**可能原因**：
- 服务器未正确启动
- 工具定义格式错误
- 缓存问题

**解决方案**：
1. 检查服务器连接状态
2. 查看服务器日志，确认工具已注册
3. 清除缓存并重启
4. 检查工具名称格式：`toolName_mcp_serverName`

---

## 最佳实践

### 1. 命名规范

- 使用小写字母和连字符：`my-mcp-server`
- 避免空格和特殊字符
- 使用描述性的名称

### 2. 超时设置

- stdio 服务器：根据操作复杂度设置（通常 300000ms = 5 分钟）
- SSE/WebSocket/HTTP：根据网络延迟设置（通常 60000ms = 1 分钟）

### 3. 启动策略

- **`startup: true`**：适用于不需要用户配置的服务器（如文件系统）
- **`startup: false`**：适用于需要用户认证的服务器（如 GitHub、需要 API Key 的服务器）

### 4. 安全性

- 敏感信息（API Key、Token）使用 `customUserVars`，不要硬编码
- OAuth 的 `client_secret` 使用环境变量
- 限制文件系统访问路径

### 5. 图标配置

- 图标路径可以是绝对路径或相对于项目根目录
- 推荐使用 SVG 格式
- 图标大小建议 128x128 或 256x256

---

## 常见 MCP 服务器示例

### 1. Puppeteer（浏览器自动化）

```yaml
mcpServers:
  puppeteer:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-puppeteer"
    timeout: 300000
```

### 2. 文件系统

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - /home/user/documents  # 限制访问的目录
    timeout: 60000
```

### 3. GitHub

```yaml
mcpServers:
  github:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-github"
    customUserVars:
      GITHUB_PAT:
        title: "GitHub Personal Access Token"
        description: "Create a PAT at https://github.com/settings/tokens"
    startup: false
```

### 4. Obsidian

```yaml
mcpServers:
  obsidian:
    type: stdio
    command: npx
    args:
      - -y
      - "mcp-obsidian"
      - /path/to/obsidian/vault
    timeout: 60000
```

---

## 相关资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [LibreChat MCP 支持](https://www.librechat.ai/docs/features/mcp)
- [工具调用模式切换机制分析](./工具调用模式切换机制分析.md)

---

## 总结

接入第三方 MCP 服务器的关键步骤：

1. ✅ 编辑 `librechat.yaml` 配置文件
2. ✅ 在 `mcpServers` 节中添加服务器配置
3. ✅ 选择合适的传输类型（stdio/sse/websocket/http）
4. ✅ 配置认证（如需要）
5. ✅ 重启 LibreChat 服务器
6. ✅ 在前端 MCP 面板中配置用户变量（如需要）
7. ✅ 验证服务器连接和工具加载

记住：**前端无法添加新的 MCP 服务器**，所有配置都必须在 `librechat.yaml` 文件中完成。





