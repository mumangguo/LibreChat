import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import { useUserKeyQuery } from 'librechat-data-provider/react-query';
import { ResizableHandleAlt, ResizablePanel, useMediaQuery } from '@librechat/client';
import type { TEndpointsConfig, TInterfaceConfig } from 'librechat-data-provider';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useLocalStorage, useLocalize } from '~/hooks';
import { useGetEndpointsQuery } from '~/data-provider';
import NavToggle from '~/components/Nav/NavToggle';
import { useSidePanelContext } from '~/Providers';
import { useToolCallsWithThoughtChains } from '~/hooks/useToolCallsWithThoughtChains';
import { cn } from '~/utils';
import ThoughtChainPanel from './ThoughtChainPanel';

const defaultMinSize = 20;

const SidePanel = ({
  defaultSize,
  panelRef,
  navCollapsedSize = 3,
  hasArtifacts,
  minSize,
  setMinSize,
  collapsedSize,
  setCollapsedSize,
  isCollapsed,
  setIsCollapsed,
  fullCollapse,
  setFullCollapse,
  interfaceConfig,
  onClosePanel,
}: {
  defaultSize?: number;
  hasArtifacts: boolean;
  navCollapsedSize?: number;
  minSize: number;
  setMinSize: React.Dispatch<React.SetStateAction<number>>;
  collapsedSize: number;
  setCollapsedSize: React.Dispatch<React.SetStateAction<number>>;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  fullCollapse: boolean;
  setFullCollapse: React.Dispatch<React.SetStateAction<boolean>>;
  panelRef: React.RefObject<ImperativePanelHandle>;
  interfaceConfig: TInterfaceConfig;
  onClosePanel?: () => void;
}) => {
  const localize = useLocalize();
  const { endpoint } = useSidePanelContext();
  const [isHovering, setIsHovering] = useState(false);
  const [newUser, setNewUser] = useLocalStorage('newUser', true);
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();

  const isSmallScreen = useMediaQuery('(max-width: 767px)');

  // 获取所有工具调用数据（包括有思维链和没有思维链的）
  const {
    toolCalls,
    currentIndex,
    setCurrentIndex,
    currentToolCall,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
  } = useToolCallsWithThoughtChains();

  const [shouldRenderThoughtChain, setShouldRenderThoughtChain] = useState(false);

  // 当侧边栏打开时，即使没有工具调用也应该显示内容（显示"暂无"）
  useEffect(() => {
    if (!isCollapsed && !fullCollapse) {
      setShouldRenderThoughtChain(true);
    } else {
      setShouldRenderThoughtChain(false);
    }
  }, [isCollapsed, fullCollapse]);

  const hidePanel = useCallback(() => {
    if (onClosePanel) {
      onClosePanel();
    } else {
      setIsCollapsed(true);
      setCollapsedSize(0);
      setMinSize(defaultMinSize);
      setFullCollapse(true);
      localStorage.setItem('fullPanelCollapse', 'true');
      panelRef.current?.collapse();
    }
  }, [panelRef, setMinSize, setIsCollapsed, setFullCollapse, setCollapsedSize, onClosePanel]);

  const toggleNavVisible = useCallback(() => {
    if (newUser) {
      setNewUser(false);
    }
    setIsCollapsed((prev: boolean) => {
      if (prev) {
        setMinSize(defaultMinSize);
        setCollapsedSize(navCollapsedSize);
        setFullCollapse(false);
        localStorage.setItem('fullPanelCollapse', 'false');
      }
      return !prev;
    });
    if (!isCollapsed) {
      panelRef.current?.collapse();
    } else {
      panelRef.current?.expand();
    }
  }, [
    newUser,
    panelRef,
    setNewUser,
    setMinSize,
    isCollapsed,
    setIsCollapsed,
    setFullCollapse,
    setCollapsedSize,
    navCollapsedSize,
  ]);

  return (
    <>
      <div
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="relative flex w-px items-center justify-center"
      >
        <NavToggle
          navVisible={!isCollapsed}
          isHovering={isHovering}
          onToggle={toggleNavVisible}
          onHide={hidePanel}
          setIsHovering={setIsHovering}
          className={cn(
            'fixed top-1/2',
            (isCollapsed && (minSize === 0 || collapsedSize === 0)) || fullCollapse
              ? 'mr-9'
              : 'mr-16',
          )}
          translateX={false}
          side="right"
        />
      </div>
      {(!isCollapsed || minSize > 0) && !isSmallScreen && !fullCollapse && (
        <ResizableHandleAlt withHandle className="bg-transparent text-text-primary" />
      )}
      <ResizablePanel
        tagName="nav"
        id="controls-nav"
        order={hasArtifacts ? 3 : 2}
        aria-label={localize('com_ui_controls')}
        role="navigation"
        collapsedSize={collapsedSize}
        defaultSize={defaultSize}
        collapsible={true}
        minSize={minSize}
        maxSize={40}
        ref={panelRef}
        style={{
          overflowY: 'auto',
          transition: 'width 0.2s ease, visibility 0s linear 0.2s',
        }}
        onExpand={() => {
          if (isCollapsed && (fullCollapse || collapsedSize === 0)) {
            return;
          }
          setIsCollapsed(false);
          localStorage.setItem('react-resizable-panels:collapsed', 'false');
        }}
        onCollapse={() => {
          setIsCollapsed(true);
          localStorage.setItem('react-resizable-panels:collapsed', 'true');
        }}
        className={cn(
          'sidenav hide-scrollbar border-l border-border-light bg-background py-1 transition-opacity',
          isCollapsed ? 'min-w-[50px]' : 'min-w-[340px] sm:min-w-[352px]',
          (isSmallScreen && isCollapsed && (minSize === 0 || collapsedSize === 0)) || fullCollapse
            ? 'hidden min-w-0'
            : 'opacity-100',
        )}
      >
        <ThoughtChainPanel
          toolCallData={currentToolCall}
          currentIndex={currentIndex}
          totalCount={toolCalls.length}
          hasNext={hasNext}
          hasPrevious={hasPrevious}
          onNext={goToNext}
          onPrevious={goToPrevious}
          shouldRender={shouldRenderThoughtChain}
          onRenderChange={setShouldRenderThoughtChain}
        />
      </ResizablePanel>
    </>
  );
};

export default memo(SidePanel);
