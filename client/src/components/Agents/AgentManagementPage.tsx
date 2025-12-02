import { useMemo } from 'react';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { SystemRoles } from 'librechat-data-provider';
import AgentManagementTab from '~/components/Agents/AgentManagementTab';
import { ChatContext, PromptGroupsProvider } from '~/Providers';
import useChatHelpers from '~/hooks/Chat/useChatHelpers';

const AgentManagementPage = () => {
  const localize = useLocalize();
  const { user } = useAuthContext();

  const isAdmin = useMemo(() => user?.role === SystemRoles.ADMIN, [user?.role]);
  const chatHelpers = useChatHelpers(0, 'new');
  if (!user || !isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="text-sm text-text-secondary">{localize('com_agents_no_access')}</p>
      </div>
    );
  }

  return (
    <ChatContext.Provider value={chatHelpers}>
      <PromptGroupsProvider>
        <div className="flex h-full flex-col items-center overflow-y-auto bg-presentation px-4 py-6">
          <div className="w-full max-w-5xl rounded-2xl bg-surface-primary p-6 shadow-xl">
            <h1 className="mb-6 text-2xl font-bold text-text-primary">
              {localize('com_nav_agent_management')}
            </h1>
            <ul className="flex flex-col gap-6">
              <li className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
                <AgentManagementTab />
              </li>
            </ul>
          </div>
        </div>
      </PromptGroupsProvider>
    </ChatContext.Provider>
  );
};

export default AgentManagementPage;
