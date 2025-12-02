import { useMemo, useState } from 'react';
import { PermissionTypes, Permissions, EModelEndpoint } from 'librechat-data-provider';
import { useLocalize, useHasAccess } from '~/hooks';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import AgentPanelSwitch from '~/components/SidePanel/Agents/AgentPanelSwitch';
import MCPPanel from '~/components/SidePanel/MCP/MCPPanel';

// 定义Tab类型
type TabKey = 'modelConfig' | 'agentManagement';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
    <h3 className="mb-3 text-base font-semibold text-text-primary">{title}</h3>
    <div className="max-h-[60vh] overflow-y-auto pr-1">{children}</div>
  </div>
);

const AgentManagementTab = () => {
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();

  // 1. 增加Tab状态管理
  const [activeTab, setActiveTab] = useState<TabKey>('agentManagement');

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

  const showAgentBuilder = useMemo(() => {
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

  // 2. 定义各Tab对应的内容（这里假设“模型规格配置”的内容后续补充，先占位）
  const renderTabContent = () => {
    switch (activeTab) {
      case 'modelConfig':
        return (
          <div className="flex flex-col gap-4">
          {/* TODO: 模型规格配置 */}
          </div>
        );
      case 'agentManagement':
        return (
          <div className="flex flex-col gap-4">
            {showAgentBuilder && (
              <Section title={localize('com_sidepanel_agent_builder')}>
                <AgentPanelSwitch />
              </Section>
            )}
            {showMCPSettings && (
              <Section title={localize('com_nav_setting_mcp')}>
                <MCPPanel />
              </Section>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (!showAssistantBuilder && !showAgentBuilder && !hasAccessToPrompts && !showMCPSettings) {
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
      </div>

      {/* 4. 渲染当前Tab的内容 */}
      {renderTabContent()}
    </div>
  );
};

export default AgentManagementTab;
