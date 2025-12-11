/**
 * 调试工具：用于在控制台查看消息格式和工具调用
 * 在浏览器控制台中使用：window.debugThoughtChain()
 */

import { extractDatServerThoughtChain } from './parseDatServerResponse';

export function debugThoughtChain(messages: any[]) {
  console.log('=== 调试思维链提取 ===');
  console.log('消息总数:', messages?.length || 0);

  if (!messages || messages.length === 0) {
    console.log('没有消息');
    return;
  }

  // 查找所有工具调用
  const toolCalls: any[] = [];
  messages.forEach((message, msgIndex) => {
    if (!message?.content || !Array.isArray(message.content)) {
      return;
    }

    message.content.forEach((part: any, partIndex: number) => {
      if (part?.type === 'tool_call' || part?.type?.includes('tool_call')) {
        toolCalls.push({
          messageIndex: msgIndex,
          partIndex,
          part,
          toolCall: part.tool_call || part[part.type],
        });
      }
    });
  });

  console.log('找到的工具调用:', toolCalls.length);
  toolCalls.forEach((tc, index) => {
    console.log(`工具调用 ${index + 1}:`, {
      name: tc.toolCall?.function?.name || tc.toolCall?.name,
      hasOutput: !!tc.toolCall?.function?.output || !!tc.toolCall?.output,
      outputLength: (tc.toolCall?.function?.output || tc.toolCall?.output || '').length,
      isDatServer: (tc.toolCall?.function?.name || tc.toolCall?.name || '').includes('dat-server'),
    });
  });

  // 尝试提取思维链
  const thoughtChain = extractDatServerThoughtChain(messages);
  console.log('提取的思维链:', thoughtChain);

  return { toolCalls, thoughtChain };
}

// 在全局对象上添加调试函数（仅在开发环境）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugThoughtChain = debugThoughtChain;
}
