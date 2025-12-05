import React, { useState } from 'react';
import { Plus, EditIcon, TrashIcon, RefreshCw } from 'lucide-react';
import {
  Table,
  Button,
  TableRow,
  TableHead,
  TableBody,
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
  Input,
  Label,
} from '@librechat/client';
import { useLocalize, useMCPConnectionStatus } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import {
  useGetMCPServersQuery,
  useCreateMCPServerMutation,
  useUpdateMCPServerMutation,
  useDeleteMCPServerMutation,
} from '~/data-provider';
import { useReinitializeMCPServerMutation } from 'librechat-data-provider/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';

interface MCPServer {
  name: string;
  type?: string;
  url?: string;
  timeout?: number;
  headers?: Record<string, string>;
  chatMenu?: boolean;

  [key: string]: any;
}

interface MCPServerFormData {
  name: string;
  type: string;
  url: string;
  timeout: number;
  headers: Record<string, string>;
  chatMenu: boolean;
}

const defaultFormData: MCPServerFormData = {
  name: '',
  type: 'sse',
  url: '',
  timeout: 60000,
  headers: {},
  chatMenu: false,
};

export default function MCPManagement() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMCPServersQuery();
  const { data: startupConfig } = useGetStartupConfig();
  const { connectionStatus } = useMCPConnectionStatus({
    enabled: !!startupConfig?.mcpServers && Object.keys(startupConfig.mcpServers).length > 0,
  });
  const createMutation = useCreateMCPServerMutation({
    onSuccess: () => {
      showToast({
        message: '创建成功',
        status: 'success',
      });
      setEditingName('');
      setFormData(defaultFormData);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      showToast({
        message: error?.message || '操作失败',
        status: 'error',
      });
    },
  });
  const updateMutation = useUpdateMCPServerMutation({
    onSuccess: () => {
      showToast({
        message: '更新成功',
        status: 'success',
      });
      setEditingName('');
      setFormData(defaultFormData);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      showToast({
        message: error?.message || '操作失败',
        status: 'error',
      });
    },
  });
  const deleteMutation = useDeleteMCPServerMutation({
    onSuccess: () => {
      showToast({
        message: '删除成功',
        status: 'success',
      });
    },
    onError: (error: any) => {
      showToast({
        message: error?.message || '操作失败',
        status: 'error',
      });
    },
  });
  const reinitializeMutation = useReinitializeMCPServerMutation({
    onSuccess: async (data, serverName) => {
      setInitializingServer(null);
      if (data.oauthRequired && data.oauthUrl) {
        showToast({
          message: '需要OAuth认证，请在新窗口中完成认证',
          status: 'info',
        });
        window.open(data.oauthUrl, '_blank', 'noopener,noreferrer');
      } else {
        showToast({
          message: `MCP服务器 "${serverName}" 初始化成功`,
          status: 'success',
        });
      }
      await queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);
      await queryClient.invalidateQueries([QueryKeys.mcpTools]);
    },
    onError: (error: any, serverName) => {
      setInitializingServer(null);
      showToast({
        message: error?.message || `初始化服务器 "${serverName}" 失败`,
        status: 'error',
      });
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [formData, setFormData] = useState<MCPServerFormData>(defaultFormData);
  const [headersString, setHeadersString] = useState('');
  const [initializingServer, setInitializingServer] = useState<string | null>(null);

  const servers = data?.data || [];

  const handleCreate = () => {
    setEditingName('');
    setFormData(defaultFormData);
    setHeadersString('');
    setIsDialogOpen(true);
  };

  const handleEdit = (server: MCPServer) => {
    setEditingName(server.name);
    setFormData({
      name: server.name,
      type: server.type || 'sse',
      url: server.url || '',
      timeout: server.timeout || 60000,
      headers: server.headers || {},
      chatMenu: server.chatMenu || false,
    });
    setHeadersString(
      server.headers
        ? Object.entries(server.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
        : '',
    );
    setIsDialogOpen(true);
  };

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name);
  };

  const handleReinitialize = (serverName: string) => {
    setInitializingServer(serverName);
    reinitializeMutation.mutate(serverName);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.url) {
      showToast({
        message: '名称和URL是必填项',
        status: 'error',
      });
      return;
    }

    const payload: any = {
      name: formData.name,
      type: formData.type,
      url: formData.url,
      timeout: formData.timeout,
      chatMenu: formData.chatMenu,
    };

    // Parse headers
    if (headersString.trim()) {
      const headers: Record<string, string> = {};
      headersString.split('\n').forEach((line) => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          headers[key.trim()] = valueParts.join(':').trim();
        }
      });
      if (Object.keys(headers).length > 0) {
        payload.headers = headers;
      }
    }

    if (editingName) {
      updateMutation.mutate({ name: editingName, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-primary">
          {localize('com_ui_mcp_management')}
        </h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {localize('com_ui_mcp_create')}
        </Button>
      </div>

      <div className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
        {servers.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-text-secondary">{localize('com_ui_not_found')}</div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border-light">
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_name')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_type')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_url')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_timeout')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_chat_menu')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_status')}
                  </TableHead>
                  <TableHead className="w-[180px] px-4 py-3 text-center text-sm font-medium text-text-primary">
                    {localize('com_ui_mcp_table_operate')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server: MCPServer) => (
                  <TableRow
                    key={server.name}
                    className="hover:bg-surface-secondary/50 border-b border-border-light"
                  >
                    <TableCell className="px-4 py-4">
                      <div className="font-semibold text-text-primary">{server.name}</div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="text-sm text-text-secondary">{server.type || 'sse'}</div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="max-w-xs truncate text-sm text-text-secondary">
                        {server.url || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="text-sm text-text-secondary">
                        {server.timeout ? `${server.timeout}` : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="text-sm text-text-secondary">
                        {server.chatMenu
                          ? localize('com_ui_mcp_table_yes')
                          : localize('com_ui_mcp_table_no')}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      {(() => {
                        const serverStatus = connectionStatus?.[server.name];
                        const isConnected = serverStatus?.connectionState === 'connected';
                        const isInitializing =
                          initializingServer === server.name && reinitializeMutation.isLoading;
                        const connectionState = serverStatus?.connectionState || 'disconnected';

                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-xl px-2 py-0.5 text-xs ${
                                isConnected
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : connectionState === 'error'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                    : connectionState === 'connecting'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {isInitializing
                                ? localize('com_ui_mcp_table_initial')
                                : connectionState}
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {(() => {
                          const serverStatus = connectionStatus?.[server.name];
                          const isConnected = serverStatus?.connectionState === 'connected';
                          const isInitializing =
                            initializingServer === server.name && reinitializeMutation.isLoading;

                          return (
                            <>
                              {!isConnected && (
                                <TooltipAnchor
                                  description={
                                    localize('com_ui_reinitialize') ||
                                    localize('com_ui_mcp_table_reset_initial')
                                  }
                                >
                                  <Button
                                    variant="ghost"
                                    aria-label={
                                      localize('com_ui_reinitialize') ||
                                      localize('com_ui_mcp_table_reset_initial')
                                    }
                                    onClick={() => handleReinitialize(server.name)}
                                    disabled={isInitializing}
                                    className="h-8 w-8 p-0"
                                  >
                                    {isInitializing ? (
                                      <Spinner className="h-4 w-4" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4 text-blue-500" />
                                    )}
                                  </Button>
                                </TooltipAnchor>
                              )}
                              <TooltipAnchor description={localize('com_ui_edit')}>
                                <Button
                                  variant="ghost"
                                  aria-label={localize('com_ui_edit')}
                                  onClick={() => handleEdit(server)}
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
                                  title={localize('com_ui_mcp_table_delete')}
                                  description={localize('com_ui_mcp_table_confirm_delete')}
                                  selection={{
                                    selectHandler: () => handleDelete(server.name),
                                    selectText: (
                                      <span className="flex items-center gap-2">
                                        {deleteMutation.isLoading && <Spinner />}
                                        {localize('com_ui_delete')}
                                      </span>
                                    ),
                                    isLoading: deleteMutation.isLoading,
                                  }}
                                />
                              </OGDialog>
                            </>
                          );
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <OGDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <OGDialogContent className="border-border-light bg-surface-primary text-text-primary lg:max-w-2xl">
          <OGDialogTitle>
            {editingName ? localize('com_ui_mcp_form_edit') : localize('com_ui_mcp_form_create')}
          </OGDialogTitle>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{localize('com_ui_mcp_form_name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如: my-mcp-server"
                disabled={!!editingName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">{localize('com_ui_mcp_form_type')}</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-md border border-border-light bg-surface-primary px-3 py-2 text-text-primary"
              >
                <option value="sse">SSE</option>
                <option value="http">HTTP</option>
                <option value="stdio">STDIO</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">{localize('com_ui_mcp_form_url')}</Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder={localize('com_ui_mcp_form_url_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeout">{localize('com_ui_mcp_form_timeout')}</Label>
              <Input
                id="timeout"
                type="number"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData({ ...formData, timeout: parseInt(e.target.value, 10) || 60000 })
                }
                placeholder="60000"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="headers">{localize('com_ui_mcp_form_header')}</Label>
              <textarea
                id="headers"
                value={headersString}
                onChange={(e) => setHeadersString(e.target.value)}
                className="w-full rounded-md border border-border-light bg-surface-primary px-3 py-2 text-text-primary"
                rows={4}
                placeholder={localize('com_ui_mcp_form_header_url_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="chatMenu">
                <input
                  type="checkbox"
                  id="chatMenu"
                  checked={formData.chatMenu}
                  onChange={(e) => setFormData({ ...formData, chatMenu: e.target.checked })}
                  className="mr-2"
                />
                {localize('com_ui_mcp_form_enable_chat')}
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <OGDialogClose asChild>
                <Button variant="ghost">{localize('com_ui_mcp_form_cancel')}</Button>
              </OGDialogClose>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isLoading || updateMutation.isLoading}
              >
                {createMutation.isLoading || updateMutation.isLoading ? (
                  <Spinner className="mr-2" />
                ) : null}
                {editingName
                  ? localize('com_ui_mcp_form_update')
                  : localize('com_ui_mcp_form_create')}
              </Button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
