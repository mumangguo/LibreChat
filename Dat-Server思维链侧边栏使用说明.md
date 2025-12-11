# Dat-Server 思维链侧边栏使用说明

## 功能说明

当智能体调用 `dat-server` MCP 工具时，系统会自动检测并在右侧边栏显示思维链可视化。

## 触发方式

思维链侧边栏会在以下情况自动触发：

1. **自动触发**：当智能体调用 `dat-server` MCP 工具并返回包含思维链数据的响应时，侧边栏会自动显示。

2. **触发条件**：
   - 工具调用名称包含 `dat-server`（通过 `Constants.mcp_delimiter` 分隔符识别）
   - 工具调用的输出包含思维链数据格式（以 `---------------------` 分隔的各个阶段）

## 思维链数据格式

系统会解析以下格式的响应：

```
--------------------- intent_classification ---------------------
{"rephrased_question":"...","reasoning":"...","intent":"..."}
--------------------- sql_generation_reasoning ---------------------
...
--------------------- sql_generate ---------------------
...
--------------------- semantic_to_sql ---------------------
...
--------------------- exception ---------------------
...
```

## 调试方法

如果思维链侧边栏没有显示，可以：

1. **打开浏览器控制台**，查看以下日志：
   - `✅ @ant-design/x and antd loaded successfully` - 依赖加载成功
   - `🔍 找到 dat-server 工具调用输出` - 检测到工具调用
   - `✅ 成功解析思维链数据` - 解析成功

2. **检查工具调用**：
   - 确认工具调用名称包含 `dat-server`
   - 确认工具调用有输出（`output` 字段不为空）
   - 确认输出格式符合要求

3. **手动调试**（开发环境）：
   在浏览器控制台运行：
   ```javascript
   // 获取当前消息
   const messages = window.getMessages?.() || [];
   // 调试思维链提取
   window.debugThoughtChain?.(messages);
   ```

## 显示内容

思维链侧边栏会显示以下信息：

1. **意图分类 (Intent Classification)**
   - 重述问题
   - 推理过程
   - 意图类型

2. **SQL 生成推理 (SQL Generation Reasoning)**
   - 详细的推理步骤

3. **生成的 SQL (Generated SQL)**
   - 生成的 SQL 语句

4. **语义 SQL 转换 (Semantic to SQL)**
   - 转换结果或错误信息

5. **异常信息 (Exception)**
   - 错误消息（如果有）

## 注意事项

1. 思维链侧边栏会在检测到 dat-server 工具调用时自动显示
2. 如果同时有 Artifacts 和思维链，两者会并排显示
3. 思维链数据会在工具调用完成后显示（需要 `output` 字段有值）
4. 如果未安装 `@ant-design/x`，会使用降级 UI 显示

## 故障排除

如果侧边栏没有显示：

1. 确认 `@ant-design/x` 和 `antd` 已正确安装
2. 检查浏览器控制台是否有错误
3. 确认工具调用名称格式正确（应包含 `dat-server`）
4. 确认工具调用输出格式正确

