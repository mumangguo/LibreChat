import { useRef, useEffect, memo } from 'react';
import { ResizableHandleAlt, ResizablePanel } from '@librechat/client';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import DatServerThoughtChain from './DatServerThoughtChain';
import type { ThoughtChainData } from '~/utils/parseDatServerResponse';

interface ThoughtChainPanelProps {
  thoughtChainData: ThoughtChainData | null;
  currentIndex: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  currentLayout: number[];
  minSizeMain: number;
  shouldRender: boolean;
  onRenderChange: (shouldRender: boolean) => void;
}

/**
 * ThoughtChainPanel 组件 - 在侧面板显示服务器思维链
 * 类似于ArtifactsPanel，但用于思维链可视化
 */
const ThoughtChainPanel = memo(function ThoughtChainPanel({
  thoughtChainData,
  currentIndex,
  totalCount,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  currentLayout,
  minSizeMain,
  shouldRender,
  onRenderChange,
}: ThoughtChainPanelProps) {
  const thoughtChainPanelRef = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    if (thoughtChainData != null) {
      onRenderChange(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          thoughtChainPanelRef.current?.expand();
        });
      });
    } else if (shouldRender) {
      onRenderChange(false);
    }
  }, [thoughtChainData, shouldRender, onRenderChange]);

  if (!shouldRender || !thoughtChainData) {
    return null;
  }

  // 计算布局中的面板索引
  // 布局顺序: [main, artifacts?, thoughtChain, nav]
  const panelIndex = currentLayout.length > 2 ? currentLayout.length - 2 : 1;
  const defaultSize = currentLayout[panelIndex] || 30;

  return (
    <>
      {thoughtChainData != null && (
        <ResizableHandleAlt withHandle className="bg-border-medium text-text-primary" />
      )}
      <ResizablePanel
        ref={thoughtChainPanelRef}
        defaultSize={thoughtChainData != null ? defaultSize : 0}
        minSize={minSizeMain}
        maxSize={70}
        collapsible={true}
        collapsedSize={0}
        order={thoughtChainData != null ? (currentLayout.length > 2 ? 3 : 2) : 2}
        id="thought-chain-panel"
      >
        <div className="h-full min-w-[400px] overflow-hidden">
          <DatServerThoughtChain
            data={thoughtChainData}
            currentIndex={currentIndex}
            totalCount={totalCount}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
            onNext={onNext}
            onPrevious={onPrevious}
          />
        </div>
      </ResizablePanel>
    </>
  );
});

ThoughtChainPanel.displayName = 'ThoughtChainPanel';

export default ThoughtChainPanel;
