import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import throttle from 'lodash/throttle';
import { useRecoilValue } from 'recoil';
import { getConfigDefaults } from 'librechat-data-provider';
import { ResizablePanel, ResizablePanelGroup, useMediaQuery } from '@librechat/client';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useGetStartupConfig } from '~/data-provider';
import { useDatServerThoughtChains } from '~/hooks/useDatServerThoughtChain';
import ArtifactsPanel from './ArtifactsPanel';
import ThoughtChainPanel from './ThoughtChainPanel';
import { normalizeLayout } from '~/utils';
import SidePanel from './SidePanel';
import store from '~/store';

interface SidePanelProps {
  defaultLayout?: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize?: number;
  fullPanelCollapse?: boolean;
  artifacts?: React.ReactNode;
  children: React.ReactNode;
}

const defaultMinSize = 20;
const defaultInterface = getConfigDefaults().interface;

const SidePanelGroup = memo(
  ({
    defaultLayout = [97, 3],
    defaultCollapsed = false,
    fullPanelCollapse = false,
    navCollapsedSize = 3,
    artifacts,
    children,
  }: SidePanelProps) => {
    const { data: startupConfig } = useGetStartupConfig();
    const interfaceConfig = useMemo(
      () => startupConfig?.interface ?? defaultInterface,
      [startupConfig],
    );

    const panelRef = useRef<ImperativePanelHandle>(null);
    const [minSize, setMinSize] = useState(defaultMinSize);
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [fullCollapse, setFullCollapse] = useState(fullPanelCollapse);
    const [collapsedSize, setCollapsedSize] = useState(navCollapsedSize);
    const [shouldRenderArtifacts, setShouldRenderArtifacts] = useState(artifacts != null);

    const isSmallScreen = useMediaQuery('(max-width: 767px)');

    // 通过支持分页的dat服务器工具调用获取所有思维链
    const {
      currentThoughtChain: thoughtChainData,
      currentIndex,
      thoughtChains,
      hasNext,
      hasPrevious,
      goToNext,
      goToPrevious,
    } = useDatServerThoughtChains();
    const totalCount = thoughtChains.length;
    const [shouldRenderThoughtChain, setShouldRenderThoughtChain] = useState(thoughtChainData != null);
    // const hideSidePanel = useRecoilValue(store.hideSidePanel);

    const calculateLayout = useCallback(() => {
      const hasArtifacts = artifacts != null;
      const hasThoughtChain = thoughtChainData != null;

      if (!hasArtifacts && !hasThoughtChain) {
        const navSize = defaultLayout.length === 2 ? defaultLayout[1] : defaultLayout[2];
        return [100 - navSize, navSize];
      } else if (hasArtifacts && hasThoughtChain) {
        // artifacts和思维链: main, artifacts, thought chain, nav
        const navSize = 0;
        const remainingSpace = 100 - navSize;
        const panelSize = Math.floor(remainingSpace / 3);
        const mainSize = remainingSpace - panelSize * 2;
        return [mainSize, panelSize, panelSize, navSize];
      } else if (hasArtifacts) {
        const navSize = 0;
        const remainingSpace = 100 - navSize;
        const newMainSize = Math.floor(remainingSpace / 2);
        const artifactsSize = remainingSpace - newMainSize;
        return [newMainSize, artifactsSize, navSize];
      } else {
        // 思维链
        const navSize = 0;
        const remainingSpace = 100 - navSize;
        const newMainSize = Math.floor(remainingSpace / 2);
        const thoughtChainSize = remainingSpace - newMainSize;
        return [newMainSize, thoughtChainSize, navSize];
      }
    }, [artifacts, thoughtChainData, defaultLayout]);

    const currentLayout = useMemo(() => normalizeLayout(calculateLayout()), [calculateLayout]);

    const throttledSaveLayout = useMemo(
      () =>
        throttle((sizes: number[]) => {
          const normalizedSizes = normalizeLayout(sizes);
          localStorage.setItem('react-resizable-panels:layout', JSON.stringify(normalizedSizes));
        }, 350),
      [],
    );

    useEffect(() => {
      if (isSmallScreen) {
        setIsCollapsed(true);
        setCollapsedSize(0);
        setMinSize(defaultMinSize);
        setFullCollapse(true);
        localStorage.setItem('fullPanelCollapse', 'true');
        panelRef.current?.collapse();
        return;
      } else {
        setIsCollapsed(defaultCollapsed);
        setCollapsedSize(navCollapsedSize);
        setMinSize(defaultMinSize);
      }
    }, [isSmallScreen, defaultCollapsed, navCollapsedSize, fullPanelCollapse]);

    // 当数据发生变化时，更新思维链的可见性
    useEffect(() => {
      if (thoughtChainData != null) {
        setShouldRenderThoughtChain(true);
      } else {
        setShouldRenderThoughtChain(false);
      }
    }, [thoughtChainData]);

    const minSizeMain = useMemo(() => {
      if (artifacts != null || thoughtChainData != null) {
        return 15;
      }
      return 30;
    }, [artifacts, thoughtChainData]);

    /** Memoized close button handler to prevent re-creating it */
    const handleClosePanel = useCallback(() => {
      setIsCollapsed(() => {
        localStorage.setItem('fullPanelCollapse', 'true');
        setFullCollapse(true);
        setCollapsedSize(0);
        setMinSize(0);
        return false;
      });
      panelRef.current?.collapse();
    }, []);

    return (
      <>
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes) => throttledSaveLayout(sizes)}
          className="relative h-full w-full flex-1 overflow-auto bg-presentation"
        >
          <ResizablePanel
            defaultSize={currentLayout[0]}
            minSize={minSizeMain}
            order={1}
            id="messages-view"
          >
            {children}
          </ResizablePanel>

          {!isSmallScreen && (
            <>
              <ArtifactsPanel
                artifacts={artifacts}
                currentLayout={currentLayout}
                minSizeMain={minSizeMain}
                shouldRender={shouldRenderArtifacts}
                onRenderChange={setShouldRenderArtifacts}
              />
              <ThoughtChainPanel
                thoughtChainData={thoughtChainData}
                currentIndex={currentIndex}
                totalCount={totalCount}
                hasNext={hasNext}
                hasPrevious={hasPrevious}
                onNext={goToNext}
                onPrevious={goToPrevious}
                currentLayout={currentLayout}
                minSizeMain={minSizeMain}
                shouldRender={shouldRenderThoughtChain}
                onRenderChange={setShouldRenderThoughtChain}
              />
            </>
          )}

          {/*{!hideSidePanel && interfaceConfig.sidePanel === true && (*/}
          {/*  <SidePanel*/}
          {/*    panelRef={panelRef}*/}
          {/*    minSize={minSize}*/}
          {/*    setMinSize={setMinSize}*/}
          {/*    isCollapsed={isCollapsed}*/}
          {/*    setIsCollapsed={setIsCollapsed}*/}
          {/*    collapsedSize={collapsedSize}*/}
          {/*    setCollapsedSize={setCollapsedSize}*/}
          {/*    fullCollapse={fullCollapse}*/}
          {/*    setFullCollapse={setFullCollapse}*/}
          {/*    interfaceConfig={interfaceConfig}*/}
          {/*    hasArtifacts={shouldRenderArtifacts}*/}
          {/*    defaultSize={currentLayout[currentLayout.length - 1]}*/}
          {/*  />*/}
          {/*)}*/}
        </ResizablePanelGroup>
        {artifacts != null && isSmallScreen && (
          <div className="fixed inset-0 z-[100]">{artifacts}</div>
        )}
        <button
          aria-label="Close right side panel"
          className={`nav-mask ${!isCollapsed ? 'active' : ''}`}
          onClick={handleClosePanel}
        />
      </>
    );
  },
);

SidePanelGroup.displayName = 'SidePanelGroup';

export default SidePanelGroup;
