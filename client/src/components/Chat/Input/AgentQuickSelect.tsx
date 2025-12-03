import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from '@librechat/client';
import { EModelEndpoint } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { useChatContext, useAgentsMapContext } from '~/Providers';
import { cn, getAgentAvatarUrl } from '~/utils';

const AgentQuickSelect = () => {
  const localize = useLocalize();
  const { conversation, setConversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const agents: t.Agent[] = useMemo(() => (agentsMap ? Object.values(agentsMap) : []), [agentsMap]);
  const isLoading = !agentsMap;
  const selectedAgentId = conversation?.agent_id ?? '';
  const [isApplyingDefault, setIsApplyingDefault] = useState(false);
  const lastConversationId = useRef<string | null>(null);

  const applyAgentSelection = useCallback(
    (agent: t.Agent | undefined) => {
      if (!agent) {
        return;
      }
      setConversation((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          endpoint: EModelEndpoint.agents,
          endpointType: EModelEndpoint.agents,
          agent_id: agent.id,
          assistant_id: undefined,
          model: agent.model ?? prev.model,
          spec: null,
          iconURL: agent.avatar?.filepath ?? prev.iconURL ?? null,
        };
      });
    },
    [setConversation],
  );

  const handleSelect = useCallback(
    (agentId: string) => {
      const agent = agents.find((item) => item.id === agentId);
      applyAgentSelection(agent);
    },
    [agents, applyAgentSelection],
  );

  useEffect(() => {
    const convoId = conversation?.conversationId ?? null;
    if (convoId && convoId !== lastConversationId.current) {
      lastConversationId.current = convoId;
      setIsApplyingDefault(false);
    }
  }, [conversation?.conversationId]);

  useEffect(() => {
    if (selectedAgentId || isApplyingDefault) {
      return;
    }
    if (agents.length === 0 || !conversation) {
      return;
    }
    setIsApplyingDefault(true);
    handleSelect(agents[0].id);
  }, [agents, conversation, handleSelect, isApplyingDefault, selectedAgentId]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  const label = selectedAgent?.name ?? localize('com_ui_agent');

  return (
    <div className="flex flex-col gap-1 text-xs text-text-secondary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="my-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={agents.length === 0 && !isLoading}
            aria-label={localize('com_ui_select_agent')}
          >
            {isLoading ? (
              <Spinner className="size-3.5 flex-shrink-0" />
            ) : (
              <>
                <img
                  src={getAgentAvatarUrl(selectedAgent) ?? '/assets/agent.svg'}
                  alt={label}
                  className="h-4 w-4 flex-shrink-0 rounded-full object-cover"
                />
                <span className="max-w-[150px] flex-grow truncate text-left">{label}</span>
                <ChevronsUpDown className="size-3 flex-shrink-0 text-text-secondary" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="max-h-64 w-56 overflow-y-auto rounded-xl border border-border-light bg-surface-secondary"
          align="start"
          sideOffset={4}
        >
          {agents.length === 0 && !isLoading ? (
            <div className="px-3 py-2 text-xs text-text-secondary">
              {localize('com_agents_empty_state_heading')}
            </div>
          ) : (
            agents.map((agent) => {
              const avatarUrl = getAgentAvatarUrl(agent);
              return (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => handleSelect(agent.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary',
                    'text-text-primary',
                    selectedAgentId === agent.id && 'bg-surface-tertiary',
                  )}
                >
                  <img
                    src={avatarUrl ?? '/assets/agent.svg'}
                    alt={agent.name ?? agent.id}
                    className="h-4 w-4 flex-shrink-0 rounded-full object-cover"
                  />
                  <span className="truncate">{agent.name ?? agent.id}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default AgentQuickSelect;
