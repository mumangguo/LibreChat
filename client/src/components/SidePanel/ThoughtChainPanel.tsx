import { useEffect, memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@librechat/client';
import { useChatContext } from '~/Providers';
import DatServerThoughtChain from './DatServerThoughtChain';
import ToolCall from '~/components/Chat/Messages/Content/ToolCall';
import type { ToolCallWithThoughtChain } from '~/utils/parseDatServerResponse';
import { mapAttachments } from '~/utils';

interface ThoughtChainPanelProps {
  toolCallData: ToolCallWithThoughtChain | null;
  currentIndex: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  shouldRender: boolean;
  onRenderChange: (shouldRender: boolean) => void;
}

/**
 * ThoughtChainPanel 组件 - 在侧面板显示工具调用和思维链
 * 每个思维链都对应一个 ToolCall，但不是每个 ToolCall 都有思维链
 */
const ThoughtChainPanel = memo(function ThoughtChainPanel({
  toolCallData,
  currentIndex,
  totalCount,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  shouldRender,
  onRenderChange,
}: ThoughtChainPanelProps) {
  const { getMessages, isSubmitting } = useChatContext();

  // 获取所有消息的附件
  const attachmentsMap = useMemo(() => {
    const messages = getMessages();
    if (!messages || messages.length === 0) {
      return {};
    }

    const allAttachments: any[] = [];
    messages.forEach((message: any) => {
      if (message.attachments && Array.isArray(message.attachments)) {
        allAttachments.push(...message.attachments);
      }
    });

    return mapAttachments(allAttachments);
  }, [getMessages]);

  // 获取当前 ToolCall 的附件
  const currentAttachments = useMemo(() => {
    if (!toolCallData?.toolCall?.id) {
      return undefined;
    }
    return attachmentsMap[toolCallData.toolCall.id];
  }, [toolCallData, attachmentsMap]);

  // 通知父组件是否有数据需要渲染
  useEffect(() => {
    if (toolCallData != null) {
      onRenderChange(true);
    }
  }, [toolCallData, onRenderChange]);

  // 如果侧边栏没有打开，不渲染
  if (!shouldRender) {
    return null;
  }

  // 如果没有数据，显示"暂无"提示
  if (!toolCallData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-text-secondary">
          <p className="text-sm">暂无</p>
        </div>
      </div>
    );
  }

  const { thoughtChain, toolCall } = toolCallData;

  // 只有在有多个 ToolCall 时才显示翻页控件
  const showPagination = totalCount > 1;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 翻页控件 - 在顶部显示，用于在多个 ToolCall 之间切换 */}
      {showPagination && (
        <div className="flex items-center justify-between border-b border-border-light bg-background px-4 py-3">
          <div className="text-sm font-medium text-text-primary">工具调用</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-text-secondary">
              {currentIndex + 1} / {totalCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={!hasNext}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="flex h-full flex-col">
          {/* ToolCall 组件 - 显示工具调用信息 */}
          {toolCall && (
            <div className="border-b border-border-light p-4">
              <ToolCall
                initialProgress={toolCall.progress ?? 0.1}
                isSubmitting={isSubmitting}
                name={toolCall.name}
                args={toolCall.args}
                output={toolCall.output}
                attachments={currentAttachments}
                auth={toolCall.auth}
                expires_at={toolCall.expires_at}
                isLast={true}
              />
            </div>
          )}

          {/* 思维链组件 - 如果有思维链数据则显示 */}
          {thoughtChain && (
            <div className="flex-1 overflow-hidden">
              <DatServerThoughtChain
                data={thoughtChain}
                currentIndex={0}
                totalCount={1}
                hasNext={false}
                hasPrevious={false}
                onNext={() => {}}
                onPrevious={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ThoughtChainPanel.displayName = 'ThoughtChainPanel';

export default ThoughtChainPanel;
