/**
 * 解析 dat-server MCP 响应中的思维链数据
 * 响应格式示例：
 * "--------------------- intent_classification ---------------------\n{...}\n--------------------- sql_generation_reasoning ---------------------\n..."
 */

import { Constants, ContentTypes } from 'librechat-data-provider';

export interface ThoughtChainData {
  intentClassification?: {
    rephrased_question?: string;
    reasoning?: string;
    intent?: string;
  };
  sqlGenerationReasoning?: string;
  sqlGenerate?: string;
  semanticToSql?: string;
  sqlExecute?: string;
  exception?: {
    message?: string;
    [key: string]: unknown;
  };
}

export function parseDatServerResponse(response: string): ThoughtChainData | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  // 处理转义的换行符：将 \n 字符串转换为真正的换行符
  // 先尝试直接解析，如果失败则处理转义
  let normalizedResponse = response;

  // 检查是否包含分隔符
  if (!response.includes('---------------------')) {
    return null;
  }

  // 如果包含 \n 字符串但没有真正的换行符，说明是转义的
  if (response.includes('\\n') && !response.includes('\n')) {
    normalizedResponse = response.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }

  const result: ThoughtChainData = {};

  // 解析 intent_classification - 使用更灵活的正则，支持换行符的多种形式
  const intentMatch = normalizedResponse.match(
    /--------------------- intent_classification ---------------------[\r\n]+([\s\S]*?)(?=---------------------|$)/,
  );
  if (intentMatch && intentMatch[1]) {
    let intentContent = intentMatch[1].trim();
    // 如果内容为空或只包含空白字符，不设置
    if (intentContent && intentContent.length > 0) {
      try {
        // 处理转义的 JSON 字符串：如果内容被双引号包裹，先去掉外层引号
        if (intentContent.startsWith('"') && intentContent.endsWith('"')) {
          try {
            // 先解析外层引号
            intentContent = JSON.parse(intentContent);
            // 如果解析后仍然是字符串，继续解析
            if (typeof intentContent === 'string') {
              intentContent = JSON.parse(intentContent);
            }
          } catch {
            // 如果失败，尝试手动处理转义字符
            try {
              intentContent = JSON.parse(
                intentContent
                  .slice(1, -1) // 去掉首尾引号
                  .replace(/\\"/g, '"') // 处理转义的引号
                  .replace(/\\n/g, '\n') // 处理转义的换行
                  .replace(/\\r/g, '\r') // 处理转义的回车
                  .replace(/\\\\/g, '\\'), // 处理转义的反斜杠
              );
            } catch {
              // 如果都失败，保持原样，稍后尝试直接解析
            }
          }
        }

        // 如果仍然是字符串，尝试直接解析
        if (typeof intentContent === 'string') {
          const intentData = JSON.parse(intentContent);
          // 验证解析后的数据是否有效
          if (intentData && typeof intentData === 'object') {
            result.intentClassification = intentData;
          }
        } else if (typeof intentContent === 'object' && intentContent !== null) {
          result.intentClassification = intentContent;
        }
      } catch (e) {
        // 解析失败，不设置该字段（置为空）
        // 静默处理，不输出错误日志
      }
    }
  }

  // 解析 sql_generation_reasoning
  const reasoningMatch = normalizedResponse.match(
    /--------------------- sql_generation_reasoning ---------------------[\r\n]+([\s\S]*?)(?=---------------------|$)/,
  );
  if (reasoningMatch && reasoningMatch[1]) {
    const reasoningContent = reasoningMatch[1].trim();
    // 如果内容为空或只包含空白字符，不设置
    if (reasoningContent && reasoningContent.length > 0) {
      result.sqlGenerationReasoning = reasoningContent;
    }
  }

  // 解析 sql_generate
  const sqlMatch = normalizedResponse.match(
    /--------------------- sql_generate ---------------------[\r\n]+([\s\S]*?)(?=---------------------|$)/,
  );
  if (sqlMatch && sqlMatch[1]) {
    const sqlContent = sqlMatch[1].trim();
    // 如果内容为空或只包含空白字符，不设置
    if (sqlContent && sqlContent.length > 0) {
      // 移除 "Semantic SQL:" 前缀（如果存在）
      result.sqlGenerate = sqlContent.replace(/^Semantic SQL:\s*/i, '');
    }
  }

  // 解析 semantic_to_sql
  const semanticMatch = normalizedResponse.match(
    /--------------------- semantic_to_sql ---------------------[\r\n]+([\s\S]*?)(?=---------------------|$)/,
  );
  if (semanticMatch && semanticMatch[1]) {
    let semanticContent = semanticMatch[1].trim();
    // 如果内容为空或只包含空白字符，不设置
    if (semanticContent && semanticContent.length > 0) {
      // 处理转义的 JSON 字符串
      if (semanticContent.startsWith('"') && semanticContent.endsWith('"')) {
        try {
          semanticContent = JSON.parse(semanticContent);
          if (typeof semanticContent !== 'string') {
            semanticContent = JSON.stringify(semanticContent);
          }
        } catch {
          // 如果失败，保持原样
        }
      }

      // 尝试解析 JSON，如果失败则作为字符串存储
      try {
        const semanticData = JSON.parse(semanticContent);
        // 如果解析成功但包含错误，检查是否有 error 字段
        if (semanticData && typeof semanticData === 'object' && semanticData.error) {
          // 如果有错误，存储错误信息
          result.semanticToSql = `错误: ${semanticData.error}`;
        } else {
          // 如果没有错误，提取 Query SQL 或直接存储
          result.semanticToSql =
            semanticData.QuerySQL || semanticData.query_sql || semanticContent;
        }
      } catch (e) {
        // 不是 JSON，检查是否包含 "Query SQL:" 前缀
        if (semanticContent.startsWith('Query SQL:')) {
          result.semanticToSql = semanticContent.replace(/^Query SQL:\s*/i, '');
        } else {
          // 直接作为字符串存储
          result.semanticToSql = semanticContent;
        }
      }
    }
  }

  // 解析 sql_execute
  const sqlExecuteMatch = normalizedResponse.match(
    /--------------------- sql_execute ---------------------[\r\n]+([\s\S]*?)(?=---------------------|$)/,
  );
  if (sqlExecuteMatch && sqlExecuteMatch[1]) {
    let executeContent = sqlExecuteMatch[1].trim();
    // 如果内容为空或只包含空白字符，不设置
    if (executeContent && executeContent.length > 0) {
      // 移除 "Query Results:" 前缀（如果存在）
      executeContent = executeContent.replace(/^Query Results:\s*/i, '').trim();

      // 简化处理：直接存储原始内容，让 formatSqlExecuteResult 来处理解析
      // 这样可以避免在解析阶段就丢失信息
      result.sqlExecute = executeContent;
    }
  }

  // 解析 exception
  const exceptionMatch = normalizedResponse.match(
    /--------------------- exception ---------------------[\r\n]+([\s\S]*?)(?=---------------------|$)/,
  );
  if (exceptionMatch && exceptionMatch[1]) {
    let exceptionContent = exceptionMatch[1].trim();
    // 如果内容为空或只包含空白字符，不设置
    if (exceptionContent && exceptionContent.length > 0) {
      try {
        // 处理转义的 JSON 字符串
        if (exceptionContent.startsWith('"') && exceptionContent.endsWith('"')) {
          try {
            exceptionContent = JSON.parse(exceptionContent);
            if (typeof exceptionContent !== 'string') {
              exceptionContent = JSON.stringify(exceptionContent);
            }
          } catch {
            // 如果失败，保持原样
          }
        }

        const exceptionData = JSON.parse(exceptionContent);
        // 验证解析后的数据是否有效
        if (exceptionData && typeof exceptionData === 'object') {
          result.exception = exceptionData;
        }
      } catch (e) {
        // 解析失败，不设置该字段（置为空）
        // 静默处理
      }
    }
  }

  // 如果没有任何有效数据，返回 null
  if (
    !result.intentClassification &&
    !result.sqlGenerationReasoning &&
    !result.sqlGenerate &&
    !result.semanticToSql &&
    !result.sqlExecute &&
    !result.exception
  ) {
    return null;
  }

  return result;
}

/**
 * 从消息中提取所有 dat-server 工具调用的思维链数据
 * 返回按时间顺序排列的思维链数组（从旧到新）
 */
export function extractAllDatServerThoughtChains(messages: any[]): ThoughtChainData[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  const thoughtChains: ThoughtChainData[] = [];

  // 从旧到新遍历所有消息，收集所有思维链
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message || !message.content || !Array.isArray(message.content)) {
      continue;
    }

    // 遍历消息内容，查找工具调用
    for (const part of message.content) {
      if (!part || part.type !== ContentTypes.TOOL_CALL) {
        continue;
      }

      // 工具调用数据存储在 part[ContentTypes.TOOL_CALL] 中
      const toolCall = part[ContentTypes.TOOL_CALL] || part.tool_call;
      if (!toolCall) {
        continue;
      }

      // 检查工具调用的格式，可能是 function 属性或直接包含 name
      const functionData = toolCall.function || toolCall;
      if (!functionData || !functionData.name) {
        continue;
      }

      // 检查是否是 dat-server 的工具调用
      const toolName = functionData.name || '';

      // 检查是否是 dat-server 的工具调用
      let isDatServerTool = false;
      if (toolName.includes(Constants.mcp_delimiter)) {
        const [, serverName] = toolName.split(Constants.mcp_delimiter);
        if (serverName === 'dat-server') {
          isDatServerTool = true;
        }
      } else if (toolName.includes('dat-server')) {
        // Fallback: check if tool name contains dat-server
        isDatServerTool = true;
      }

      if (!isDatServerTool) {
        continue;
      }

      // 提取输出 - 可能在 function.output 或 toolCall.output
      const output = functionData.output || toolCall.output;
      if (output && typeof output === 'string') {
        const thoughtChain = parseDatServerResponse(output);
        if (thoughtChain) {
          thoughtChains.push(thoughtChain);
          console.log('✅ 成功解析 dat-server 思维链数据:', Object.keys(thoughtChain));
        }
      }
    }
  }

  return thoughtChains;
}

/**
 * 从消息中提取 dat-server 工具调用的思维链数据（仅返回最新的一个，保持向后兼容）
 * @deprecated 使用 extractAllDatServerThoughtChains 获取所有思维链
 */
export function extractDatServerThoughtChain(messages: any[]): ThoughtChainData | null {
  const allChains = extractAllDatServerThoughtChains(messages);
  return allChains.length > 0 ? allChains[allChains.length - 1] : null;
}

/**
 * 调试函数：测试解析功能
 * 在浏览器控制台运行：window.testParseDatServerResponse(outputString)
 */
export function testParseDatServerResponse(response: string) {
  console.log('=== 测试解析 dat-server 响应 ===');
  console.log('输入长度:', response.length);
  console.log('包含分隔符:', response.includes('---------------------'));
  console.log('包含 \\n:', response.includes('\\n'));
  console.log('包含真正的换行符:', response.includes('\n'));
  console.log('前200字符:', response.substring(0, 200));

  const result = parseDatServerResponse(response);
  console.log('解析结果:', result);
  console.log('解析成功:', !!result);

  return result;
}

// 在全局对象上添加测试函数（仅在开发环境）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testParseDatServerResponse = testParseDatServerResponse;
}
