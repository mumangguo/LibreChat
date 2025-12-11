import { useEffect, useState, useRef } from 'react';
import { useChatContext } from '~/Providers';
import { extractAllDatServerThoughtChains } from '~/utils/parseDatServerResponse';
import type { ThoughtChainData } from '~/utils/parseDatServerResponse';

/**
 * Hook可从当前消息中提取所有dat服务器的思维链
 * 返回所有思维链的数组并支持分页
 */
export function useDatServerThoughtChains(): {
  thoughtChains: ThoughtChainData[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  currentThoughtChain: ThoughtChainData | null;
  hasNext: boolean;
  hasPrevious: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
} {
  const { getMessages } = useChatContext();
  const [thoughtChains, setThoughtChains] = useState<ThoughtChainData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const lastMessagesRef = useRef<string>('');

  const lastThoughtChainsRef = useRef<ThoughtChainData[]>([]);
  const lastThoughtChainsHashRef = useRef<string>('');
  const currentIndexRef = useRef<number>(0);

  // 同步 currentIndex 到 ref
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // 用于检测dat服务器工具调用的消息更新轮询
  useEffect(() => {
    const checkMessages = () => {
      try {
        const messages = getMessages();
        if (!messages || messages.length === 0) {
          if (lastThoughtChainsRef.current.length > 0) {
            setThoughtChains([]);
            setCurrentIndex(0);
            currentIndexRef.current = 0;
            lastThoughtChainsRef.current = [];
            lastThoughtChainsHashRef.current = '';
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

        const extracted = extractAllDatServerThoughtChains(messages);

        // 只在思维链数据真正变化时更新状态
        const extractedHash = JSON.stringify(extracted);

        if (extractedHash !== lastThoughtChainsHashRef.current) {
          const previousLength = lastThoughtChainsRef.current.length;
          lastThoughtChainsHashRef.current = extractedHash;
          setThoughtChains(extracted);

          // 如果有新的思维链，自动切换到最新的（最后一个）
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

          lastThoughtChainsRef.current = extracted;
        }
      } catch (error) {
        console.warn('Error extracting thought chains:', error);
        if (lastThoughtChainsRef.current.length > 0) {
          setThoughtChains([]);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          lastThoughtChainsRef.current = [];
          lastThoughtChainsHashRef.current = '';
        }
      }
    };

    // 立刻检查
    checkMessages();

    // 增加轮询间隔到 1 秒，减少不必要的检查
    const interval = setInterval(checkMessages, 1000);

    return () => clearInterval(interval);
  }, [getMessages]);

  const currentThoughtChain =
    thoughtChains.length > 0 && currentIndex >= 0 && currentIndex < thoughtChains.length
      ? thoughtChains[currentIndex]
      : null;

  const hasNext = currentIndex < thoughtChains.length - 1;
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
    thoughtChains,
    currentIndex,
    setCurrentIndex,
    currentThoughtChain,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
  };
}

/**
 * 向后兼容的 hook，返回最新的思维链
 * @deprecated 使用 useDatServerThoughtChains 获取所有思维链和翻页功能
 */
export function useDatServerThoughtChain(): ThoughtChainData | null {
  const { currentThoughtChain } = useDatServerThoughtChains();
  return currentThoughtChain;
}
