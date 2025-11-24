# 🚀 LibreChat 快速开始指南

本指南将帮助您使用 npm 在本地快速启动 LibreChat。

> **注意：** 对于大多数场景，Docker Compose 是推荐的安装方法，因为它更简单、易用且可靠。如果您更喜欢使用 npm，可以按照以下说明操作。

## 📋 前置要求

在开始之前，请确保您的系统已安装以下软件：

- **Node.js v20.19.0+** (或 ^22.12.0 或 >= 23.0.0)
  - 下载地址：<https://nodejs.org/en/download>
  - LibreChat 使用 CommonJS (CJS)，需要这些特定的 Node.js 版本以兼容 openid-client v6
- **Git**
  - 下载地址：<https://git-scm.com/download/>
- **MongoDB** (Atlas 或 Community Server)
  - [MongoDB Atlas](https://www.librechat.ai/docs/local/mongodb/mongodb_atlas) - 云端 MongoDB 服务
  - [MongoDB Community Server](https://www.librechat.ai/docs/local/mongodb/mongodb_community_server) - 本地 MongoDB 安装

## 📦 安装步骤

### 1. 准备环境

#### 克隆仓库（如果尚未克隆）

```bash
git clone https://github.com/danny-avila/LibreChat.git
```

#### 进入项目目录

```bash
cd LibreChat
```

#### 创建 .env 文件

从 `.env.example` 创建 `.env` 文件：

**Windows:**
```bash
copy .env.example .env
```

**Linux/macOS:**
```bash
cp .env.example .env
```

#### ⚠️ 重要：更新 MONGO_URI

编辑新创建的 `.env` 文件，将 `MONGO_URI` 更新为您自己的 MongoDB 实例 URI。

例如：
```env
MONGO_URI=mongodb://localhost:27017/librechat
```

或者使用 MongoDB Atlas：
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/librechat
```

### 2. 构建和启动

完成准备工作后，运行以下命令：

#### 安装依赖

```bash
npm ci
```

#### 构建前端

```bash
npm run frontend
```

此命令会构建所有必要的包和前端资源。

#### 启动 LibreChat

```bash
npm run backend
```

🎉 **完成！** 现在您可以访问 LibreChat 了！

**访问地址：** <http://localhost:3080/>

### 💡 提示

下次启动 LibreChat 时，您只需要执行 `npm run backend` 即可（前提是您已经完成过构建）。

## 🔄 更新 LibreChat

要更新 LibreChat 到最新版本，请运行以下命令：

1. **停止 LibreChat**（如果正在运行）

2. **拉取最新代码**
   ```bash
   git pull
   ```

3. **更新依赖**
   ```bash
   npm ci
   ```

4. **重新构建前端**
   ```bash
   npm run frontend
   ```

5. **启动 LibreChat**
   ```bash
   npm run backend
   ```

## ⚙️ 额外配置

通过探索我们的配置指南，您可以解锁更多功能：

- **Meilisearch 集成** - 增强搜索功能
- **RAG API 连接** - 文件聊天功能
- **自定义端点** - 配置自定义 AI 端点
- **其他高级配置选项** - 更多自定义选项

这将使您能够使用可选功能自定义 LibreChat 体验。

### 相关文档

- [用户认证系统设置](https://www.librechat.ai/docs/configuration/authentication)
- [AI 设置](https://www.librechat.ai/docs/configuration/ai_providers)
- [自定义端点与配置](https://www.librechat.ai/docs/quick_start/custom_endpoints)

## 🐛 常见问题

### 端口已被占用

如果 3080 端口已被占用，您可以在 `.env` 文件中修改 `PORT` 环境变量。

### MongoDB 连接失败

请确保：
- MongoDB 服务正在运行
- `MONGO_URI` 配置正确
- 网络连接正常（如果使用 MongoDB Atlas）

### 构建错误

如果遇到构建错误，请尝试：
1. 删除 `node_modules` 文件夹
2. 删除 `package-lock.json`（如果存在）
3. 重新运行 `npm ci`

## 📚 更多资源

- **官方文档：** <https://www.librechat.ai/docs>
- **GitHub 仓库：** <https://github.com/danny-avila/LibreChat>
- **Discord 社区：** <https://discord.librechat.ai>

---

**需要帮助？** 查看我们的 [完整文档](https://www.librechat.ai/docs) 或加入 [Discord 社区](https://discord.librechat.ai) 获取支持。

