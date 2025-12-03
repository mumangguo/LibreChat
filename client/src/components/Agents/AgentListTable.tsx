import { Eye } from 'lucide-react';
import {
  Table,
  Button,
  TableRow,
  EditIcon,
  TableHead,
  TableBody,
  TrashIcon,
  TableCell,
  TableHeader,
  TooltipAnchor,
  useToastContext,
  OGDialog,
  OGDialogTrigger,
  OGDialogTemplate,
  OGDialogClose,
  OGDialogContent,
  OGDialogTitle,
  Spinner,
} from '@librechat/client';
import { PermissionBits, EModelEndpoint, SystemRoles } from 'librechat-data-provider';
import type { Agent } from 'librechat-data-provider';
import { useListAgentsQuery, useDeleteAgentMutation, useGetEndpointsQuery } from '~/data-provider';
import { useLocalize, useAuthContext, useAgentCategories } from '~/hooks';
import { EndpointIcon } from '~/components/Endpoints';
import AdminSettingsContent from '~/components/SidePanel/Agents/AdminSettingsContent';

// 包装组件，使用自定义 trigger
const AdminSettingsDialog = ({ trigger }: { trigger: React.ReactNode }) => {
  const localize = useLocalize();
  return (
    <OGDialog>
      <OGDialogTrigger asChild>{trigger}</OGDialogTrigger>
      <OGDialogContent className="border-border-light bg-surface-primary text-text-primary lg:w-1/4">
        <OGDialogTitle>{`${localize('com_ui_admin_settings')} - ${localize('com_ui_agents')}`}</OGDialogTitle>
        <AdminSettingsContent />
      </OGDialogContent>
    </OGDialog>
  );
};

interface AgentListTableProps {
  onEdit: (agentId: string) => void;
}

export default function AgentListTable({ onEdit }: AgentListTableProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { user } = useAuthContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { data: agentsResponse, isLoading } = useListAgentsQuery({
    requiredPermission: PermissionBits.VIEW,
  });
  const { categories } = useAgentCategories();

  const agents = agentsResponse?.data ?? [];

  // 获取类别的 label
  const getCategoryLabel = (categoryValue: string | undefined) => {
    if (!categoryValue) return 'general';
    const category = categories.find((c) => c.value === categoryValue);
    if (category) {
      // 如果 label 是翻译键（以 com_ 开头），则进行本地化
      if (category.label && category.label.startsWith('com_')) {
        return localize(category.label as any);
      }
      return category.label;
    }
    return categoryValue;
  };

  const isAdmin = user?.role === SystemRoles.ADMIN;

  const deleteAgentMutation = useDeleteAgentMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_agent_deleted'),
        status: 'success',
      });
    },
    onError: () => {
      showToast({
        message: localize('com_ui_agent_delete_error'),
        status: 'error',
      });
    },
  });

  const handleDelete = (agentId: string, agentName?: string | null) => {
    deleteAgentMutation.mutate({ agent_id: agentId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-text-secondary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-text-secondary">{localize('com_ui_not_found_agent')}</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border-light">
            <TableHead className="w-[50px] px-4 py-3 text-left text-sm font-medium text-text-primary">
              {/* Avatar column header */}
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
              {localize('com_ui_agent_table_name')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
              {localize('com_ui_agent_table_description')}
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
              {localize('com_ui_agent_table_id')}
            </TableHead>
            <TableHead className="w-[120px] px-4 py-3 text-center text-sm font-medium text-text-primary">
              {localize('com_ui_agent_table_operate')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent: Agent) => (
            <TableRow
              key={agent.id}
              className="hover:bg-surface-secondary/50 border-b border-border-light"
            >
              <TableCell className="px-4 py-4">
                <div className="flex items-center justify-center">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary">
                    {agent.avatar?.filepath ? (
                      <img
                        src={agent.avatar.filepath}
                        alt={agent.name || agent.id}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <EndpointIcon
                        conversation={{
                          agent_id: agent.id,
                          endpoint: EModelEndpoint.agents,
                          iconURL: agent.avatar?.filepath,
                        }}
                        endpointsConfig={endpointsConfig}
                        containerClassName="h-full w-full"
                        context="menu-item"
                        size={40}
                      />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-4">
                <div className="font-semibold text-text-primary">{agent.name || agent.id}</div>
              </TableCell>
              <TableCell className="px-4 py-4">
                <div className="line-clamp-2 text-sm text-text-secondary">
                  {agent.description || '-'}
                </div>
              </TableCell>
              <TableCell className="px-4 py-4">
                <div className="text-xs text-text-secondary">
                  <div className="font-mono">{agent.id}</div>
                  <div className="mt-1">
                    {localize('com_ui_category')}: {getCategoryLabel(agent.category)}
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-4">
                <div className="flex items-center justify-center gap-2">
                  {isAdmin && (
                    <AdminSettingsDialog
                      trigger={
                        <TooltipAnchor description={localize('com_ui_admin_settings')}>
                          <Button
                            variant="ghost"
                            aria-label={localize('com_ui_admin_settings')}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                        </TooltipAnchor>
                      }
                    />
                  )}
                  <TooltipAnchor description={localize('com_ui_edit')}>
                    <Button
                      variant="ghost"
                      aria-label={localize('com_ui_edit')}
                      onClick={() => onEdit(agent.id)}
                      className="h-8 w-8 p-0"
                    >
                      <EditIcon className="h-4 w-4 text-yellow-500" />
                    </Button>
                  </TooltipAnchor>
                  <OGDialog>
                    <OGDialogTrigger asChild>
                      <TooltipAnchor description={localize('com_ui_delete')}>
                        <Button
                          variant="ghost"
                          aria-label={localize('com_ui_delete')}
                          className="h-8 w-8 p-0"
                        >
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </Button>
                      </TooltipAnchor>
                    </OGDialogTrigger>
                    <OGDialogTemplate
                      title={localize('com_ui_agent_delete')}
                      // description={`确定要删除智能体 "${agent.name || agent.id}" 吗？此操作无法撤销。`}
                      description={localize('com_ui_agent_confirm_delete')}
                      selection={{
                        selectHandler: () => handleDelete(agent.id, agent.name),
                        selectText: (
                          <span className="flex items-center gap-2">
                            {deleteAgentMutation.isLoading && <Spinner />}
                            {localize('com_ui_delete')}
                          </span>
                        ),
                        isLoading: deleteAgentMutation.isLoading,
                      }}
                    />
                  </OGDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
