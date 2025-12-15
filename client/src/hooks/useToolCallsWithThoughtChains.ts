import { useEffect, useState, useRef } from 'react';
import { useChatContext } from '~/Providers';
import { extractAllToolCalls } from '~/utils/parseDatServerResponse';
import type { ToolCallWithThoughtChain } from '~/utils/parseDatServerResponse';

/**
 * Hook 从当前消息中提取所有工具调用（包括有思维链和没有思维链的）
 * 返回所有工具调用的数组并支持分页
 */
export function useToolCallsWithThoughtChains(): {
  toolCalls: ToolCallWithThoughtChain[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  currentToolCall: ToolCallWithThoughtChain | null;
  hasNext: boolean;
  hasPrevious: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
} {
  const { getMessages } = useChatContext();
  const [toolCalls, setToolCalls] = useState<ToolCallWithThoughtChain[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const lastMessagesRef = useRef<string>('');

  const lastToolCallsRef = useRef<ToolCallWithThoughtChain[]>([]);
  const lastToolCallsHashRef = useRef<string>('');
  const currentIndexRef = useRef<number>(0);

  // 同步 currentIndex 到 ref
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // 用于检测工具调用的消息更新轮询
  useEffect(() => {
    const checkMessages = () => {
      try {
        const messages = getMessages();
        if (!messages || messages.length === 0) {
          if (lastToolCallsRef.current.length > 0) {
            setToolCalls([]);
            setCurrentIndex(0);
            currentIndexRef.current = 0;
            lastToolCallsRef.current = [];
            lastToolCallsHashRef.current = '';
            lastMessagesRef.current = '';
          }
          return;
        }

        // 创建消息的简单哈希来检测变化（避免不必要的解析）
        const messagesHash = JSON.stringify(
          messages.map((m: any) => ({
            id: m.messageId,
            contentLength: m.content?.length || 0,
            lastContentType: m.content?.[m.content.length - 1]?.type,
          })),
        );

        // 如果消息没有变化，跳过解析
        if (messagesHash === lastMessagesRef.current) {
          return;
        }

        lastMessagesRef.current = messagesHash;

        const extracted = extractAllToolCalls(messages);

        // 只在工具调用数据真正变化时更新状态
        const extractedHash = JSON.stringify(extracted);

        if (extractedHash !== lastToolCallsHashRef.current) {
          const previousLength = lastToolCallsRef.current.length;
          lastToolCallsHashRef.current = extractedHash;
          setToolCalls(extracted);

          // 如果有新的工具调用，自动切换到最新的（最后一个）
          if (extracted.length > 0 && extracted.length > previousLength) {
            const newIndex = extracted.length - 1;
            setCurrentIndex(newIndex);
            currentIndexRef.current = newIndex;
          } else if (extracted.length > 0 && currentIndexRef.current >= extracted.length) {
            // 如果当前索引超出范围，调整到最后一个
            const newIndex = extracted.length - 1;
            setCurrentIndex(newIndex);
            currentIndexRef.current = newIndex;
          } else if (extracted.length === 0) {
            setCurrentIndex(0);
            currentIndexRef.current = 0;
          }

          lastToolCallsRef.current = extracted;
        }
      } catch (error) {
        console.warn('Error extracting tool calls:', error);
        if (lastToolCallsRef.current.length > 0) {
          setToolCalls([]);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          lastToolCallsRef.current = [];
          lastToolCallsHashRef.current = '';
        }
      }
    };

    // 立刻检查
    checkMessages();

    // 增加轮询间隔到 1 秒，减少不必要的检查
    const interval = setInterval(checkMessages, 1000);

    return () => clearInterval(interval);
  }, [getMessages]);

  const currentToolCall =
    toolCalls.length > 0 && currentIndex >= 0 && currentIndex < toolCalls.length
      ? toolCalls[currentIndex]
      : null;

  const hasNext = currentIndex < toolCalls.length - 1;
  const hasPrevious = currentIndex > 0;

  const goToNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return {
    toolCalls,
    currentIndex,
    setCurrentIndex,
    currentToolCall,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
  };
}