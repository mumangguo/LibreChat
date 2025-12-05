import React, { useMemo, useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { PermissionTypes, Permissions, EModelEndpoint } from 'librechat-data-provider';
import { Button } from '@librechat/client';
import { useLocalize, useHasAccess } from '~/hooks';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import { AgentPanelProvider, useAgentPanelContext } from '~/Providers/AgentPanelContext';
import { Panel } from '~/common';
import AgentPanel from '~/components/SidePanel/Agents/AgentPanel';
import ActionsPanel from '~/components/SidePanel/Agents/ActionsPanel';
import VersionPanel from '~/components/SidePanel/Agents/Version/VersionPanel';
import AgentMCPPanel from '~/components/SidePanel/Agents/MCPPanel';
import AgentListTable from '~/components/Agents/AgentListTable';
import UserListTable from '~/components/Agents/UserListTable';
import MCPPanelSettings from '~/components/SidePanel/MCP/MCPPanel';
import ModelSelector from '~/components/Chat/Menus/Endpoints/ModelSelector';
import AgentMarketplace from '~/components/Agents/Marketplace';
import ModelConfigManagement from '~/components/Agents/ModelConfigManagement';
import MCPManagement from '~/components/Agents/MCPManagement';

// 定义Tab类型
type TabKey = 'modelConfig' | 'agentManagement' | 'mcpSettings' | 'userManagement' | 'agentMarket';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
    <h3 className="mb-3 text-base font-semibold text-text-primary">{title}</h3>
    <div className="max-h-[60vh] overflow-y-auto pr-1">{children}</div>
  </div>
);

// AgentPanelSwitchWithContext 组件，用于处理智能体ID设置
// 注意：AgentPanelSwitch 内部已经包含了 AgentPanelProvider，所以这里不需要再包一层
const AgentPanelSwitchWithContext = ({
  agentId,
  onClose,
}: {
  agentId?: string;
  onClose: () => void;
}) => {
  const localize = useLocalize();

  return (
    <AgentPanelProvider>
      <AgentPanelSwitchWithAgentId agentId={agentId} onClose={onClose} />
    </AgentPanelProvider>
  );
};

// 内部组件，用于设置 agent_id
const AgentPanelSwitchWithAgentId = ({
  agentId,
  onClose,
}: {
  agentId?: string;
  onClose: () => void;
}) => {
  const localize = useLocalize();
  const { setCurrentAgentId } = useAgentPanelContext();

  useEffect(() => {
    // 立即设置 agent_id，确保编辑模式能正确加载数据
    if (agentId) {
      setCurrentAgentId(agentId);
    } else {
      setCurrentAgentId(undefined);
    }
  }, [agentId, setCurrentAgentId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">
          {agentId ? localize('com_ui_agent_edit') : localize('com_ui_agent_create')}
        </h3>
        <Button variant="submit" onClick={onClose}>
          {localize('com_ui_close')}
        </Button>
      </div>
      <AgentPanelSwitchContent />
    </div>
  );
};

// 修改后的 AgentPanelSwitch，不包含 Provider 和 conversation 依赖
const AgentPanelSwitchContent = () => {
  const { activePanel } = useAgentPanelContext();

  if (activePanel === Panel.actions) {
    return <ActionsPanel />;
  }
  if (activePanel === Panel.version) {
    return <VersionPanel />;
  }
  if (activePanel === Panel.mcp) {
    return <AgentMCPPanel />;
  }
  return <AgentPanel />;
};

const AgentManagementTab = () => {
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();

  // 1. 增加Tab状态管理
  const [activeTab, setActiveTab] = useState<TabKey>('modelConfig');

  // 智能体管理相关状态
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | undefined>(undefined);

  const hasAccessToPrompts = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.USE,
  });
  const hasAccessToAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.USE,
  });
  const hasAccessToCreateAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.CREATE,
  });

  const showAssistantBuilder = useMemo(() => {
    if (!endpointsConfig) {
      return false;
    }
    const assistants = endpointsConfig[EModelEndpoint.assistants];
    const azureAssistants = endpointsConfig[EModelEndpoint.azureAssistants];
    return (
      (assistants && assistants.disableBuilder !== true) ||
      (azureAssistants && azureAssistants.disableBuilder !== true)
    );
  }, [endpointsConfig]);

  const canUseAgentBuilder = useMemo(() => {
    if (!endpointsConfig?.[EModelEndpoint.agents]) {
      return false;
    }
    if (!hasAccessToAgents || !hasAccessToCreateAgents) {
      return false;
    }
    return endpointsConfig[EModelEndpoint.agents].disableBuilder !== true;
  }, [endpointsConfig, hasAccessToAgents, hasAccessToCreateAgents]);

  const showMCPSettings = useMemo(() => {
    if (!startupConfig?.mcpServers) {
      return false;
    }
    return Object.values(startupConfig.mcpServers).some(
      (server: any) =>
        (server.customUserVars && Object.keys(server.customUserVars).length > 0) ||
        server.isOAuth ||
        server.startup === false,
    );
  }, [startupConfig?.mcpServers]);

  // 2. 定义各Tab对应的内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'modelConfig':
        return (
          <div className="flex flex-col gap-4">
            <ModelSelector startupConfig={startupConfig} />
            <ModelConfigManagement />
          </div>
        );
      case 'agentManagement':
        return (
          <div className="flex flex-col gap-4">
            {showAgentBuilder ? (
              <Section title={localize('com_sidepanel_agent_builder') || '智能体构建器'}>
                <AgentPanelSwitchWithContext
                  agentId={editingAgentId}
                  onClose={() => {
                    setShowAgentBuilder(false);
                    setEditingAgentId(undefined);
                  }}
                />
              </Section>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">
                      {localize('com_ui_agent_list')}
                    </h2>
                  </div>
                  {canUseAgentBuilder && (
                    <Button
                      onClick={() => {
                        setEditingAgentId(undefined);
                        setShowAgentBuilder(true);
                      }}
                    >
                      <Plus />
                      {localize('com_ui_agent_create')}
                    </Button>
                  )}
                </div>
                <div className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
                  <AgentListTable
                    onEdit={(agentId) => {
                      setEditingAgentId(agentId);
                      setShowAgentBuilder(true);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      case 'mcpSettings':
        return (
          <div className="flex flex-col gap-4">
            {/*<MCPPanelSettings />*/}
            <MCPManagement />
          </div>
        );
      case 'userManagement':
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">
                {localize('com_nav_user_management')}
              </h2>
            </div>
            <div className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
              <UserListTable onEdit={(userId) => console.log('Edit user:', userId)} />
            </div>
          </div>
        );
      case 'agentMarket':
        return (
          <div className="flex flex-col gap-4">
            <AgentMarketplace className="w-full" />
          </div>
        );
      default:
        return null;
    }
  };

  if (!showAssistantBuilder && !canUseAgentBuilder && !hasAccessToPrompts && !showMCPSettings) {
    return (
      <div className="p-6 text-center text-sm text-text-secondary">
        {localize('com_ui_no_read_access')}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex border-b border-border-light">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'modelConfig'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('modelConfig')}
        >
          {localize('com_sidepanel_model_config')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'agentManagement'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('agentManagement')}
        >
          {localize('com_nav_agent_management')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'mcpSettings'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('mcpSettings')}
        >
          {localize('com_nav_setting_mcp')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'userManagement'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('userManagement')}
        >
          {localize('com_nav_user_management')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'agentMarket'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('agentMarket')}
        >
          {localize('com_agents_marketplace')}
        </button>
      </div>

      {/* 4. 渲染当前Tab的内容 */}
      {renderTabContent()}
    </div>
  );
};

export default AgentManagementTab;
