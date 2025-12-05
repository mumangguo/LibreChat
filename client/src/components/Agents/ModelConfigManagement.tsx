import React, { useState } from 'react';
import { Plus, EditIcon, TrashIcon } from 'lucide-react';
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
import { useLocalize } from '~/hooks';
import {
  useGetCustomEndpointsQuery,
  useCreateCustomEndpointMutation,
  useUpdateCustomEndpointMutation,
  useDeleteCustomEndpointMutation,
} from '~/data-provider';

interface CustomEndpoint {
  name: string;
  apiKey: string;
  baseURL: string;
  models: {
    default: string[];
    fetch?: boolean;
  };
  titleConvo?: boolean;
  titleModel?: string;
  modelDisplayLabel?: string;
  [key: string]: any;
}

interface EndpointFormData {
  name: string;
  apiKey: string;
  baseURL: string;
  models: {
    default: string[];
    fetch: boolean;
  };
  titleConvo: boolean;
  titleModel: string;
  modelDisplayLabel: string;
}

const defaultFormData: EndpointFormData = {
  name: '',
  apiKey: '',
  baseURL: '',
  models: {
    default: [],
    fetch: false,
  },
  titleConvo: true,
  titleModel: 'current_model',
  modelDisplayLabel: '',
};

export default function ModelConfigManagement() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data, isLoading } = useGetCustomEndpointsQuery();
  const createMutation = useCreateCustomEndpointMutation({
    onSuccess: () => {
      showToast({
        message: '创建成功',
        status: 'success',
      });
      setEditingIndex(-1);
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
  const updateMutation = useUpdateCustomEndpointMutation({
    onSuccess: () => {
      showToast({
        message: '更新成功',
        status: 'success',
      });
      setEditingIndex(-1);
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
  const deleteMutation = useDeleteCustomEndpointMutation({
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [formData, setFormData] = useState<EndpointFormData>(defaultFormData);

  const endpoints = data?.data || [];

  const handleCreate = () => {
    setEditingIndex(-1);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleEdit = (index: number) => {
    const endpoint = endpoints[index] as CustomEndpoint;
    setEditingIndex(index);
    setFormData({
      name: endpoint.name || '',
      apiKey: endpoint.apiKey || '',
      baseURL: endpoint.baseURL || '',
      models: {
        default: endpoint.models?.default || [],
        fetch: endpoint.models?.fetch || false,
      },
      titleConvo: endpoint.titleConvo ?? true,
      titleModel: endpoint.titleModel || 'current_model',
      modelDisplayLabel: endpoint.modelDisplayLabel || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (index: number) => {
    deleteMutation.mutate(index);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.baseURL) {
      showToast({
        message: '名称和Base URL是必填项',
        status: 'error',
      });
      return;
    }

    const payload: any = {
      name: formData.name,
      apiKey: formData.apiKey,
      baseURL: formData.baseURL,
      models: {
        default: formData.models.default.filter((m) => m.trim()),
        fetch: formData.models.fetch,
      },
      titleConvo: formData.titleConvo,
      titleModel: formData.titleModel,
      modelDisplayLabel: formData.modelDisplayLabel,
    };

    if (editingIndex >= 0) {
      updateMutation.mutate({ index: editingIndex, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleModelsChange = (value: string) => {
    const models = value
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    setFormData({
      ...formData,
      models: {
        ...formData.models,
        default: models,
      },
    });
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
          {localize('com_ui_model_management')}
        </h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {localize('com_ui_model_management_create')}
        </Button>
      </div>

      <div className="bg-surface-secondary/40 rounded-xl border border-border-light p-4">
        {endpoints.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-text-secondary">{localize('com_ui_not_found')}</div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border-light">
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_model_table_name')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_model_table_base_url')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_model_table_model_list')}
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                    {localize('com_ui_model_table_tag')}
                  </TableHead>
                  <TableHead className="w-[120px] px-4 py-3 text-center text-sm font-medium text-text-primary">
                    {localize('com_ui_model_table_operate')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((endpoint: CustomEndpoint, index: number) => (
                  <TableRow
                    key={index}
                    className="hover:bg-surface-secondary/50 border-b border-border-light"
                  >
                    <TableCell className="px-4 py-4">
                      <div className="font-semibold text-text-primary">{endpoint.name}</div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="text-sm text-text-secondary">{endpoint.baseURL}</div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="text-sm text-text-secondary">
                        {endpoint.models?.default?.join(', ') || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="text-sm text-text-secondary">
                        {endpoint.modelDisplayLabel || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <TooltipAnchor description={localize('com_ui_edit')}>
                          <Button
                            variant="ghost"
                            aria-label={localize('com_ui_edit')}
                            onClick={() => handleEdit(index)}
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
                            title={localize('com_ui_model_form_delete')}
                            description={localize('com_ui_model_form_confirm_delete')}
                            selection={{
                              selectHandler: () => handleDelete(index),
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
            {editingIndex >= 0
              ? localize('com_ui_model_form_edit')
              : localize('com_ui_model_form_add')}
          </OGDialogTitle>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{localize('com_ui_model_form_name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={localize('com_ui_model_form_name_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">{localize('com_ui_model_form_apiKey')}</Label>
              <Input
                id="apiKey"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={localize('com_ui_model_form_apiKey_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="baseURL">{localize('com_ui_model_form_baseURL')}</Label>
              <Input
                id="baseURL"
                value={formData.baseURL}
                onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
                placeholder={localize('com_ui_model_form_baseURL_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="models">{localize('com_ui_model_form_models')}</Label>
              <Input
                id="models"
                value={formData.models.default.join(', ')}
                onChange={(e) => handleModelsChange(e.target.value)}
                placeholder={localize('com_ui_model_form_models_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="titleConvo">
                <input
                  type="checkbox"
                  id="titleConvo"
                  checked={formData.titleConvo}
                  onChange={(e) => setFormData({ ...formData, titleConvo: e.target.checked })}
                  className="mr-2"
                />
                {localize('com_ui_model_form_enable_chat_title')}
              </Label>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="titleModel">{localize('com_ui_model_form_chat_title_model')}</Label>
              <Input
                id="titleModel"
                value={formData.titleModel}
                onChange={(e) => setFormData({ ...formData, titleModel: e.target.value })}
                placeholder={localize('com_ui_model_form_chat_title_model_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="modelDisplayLabel">{localize('com_ui_model_form_tag')}</Label>
              <Input
                id="modelDisplayLabel"
                value={formData.modelDisplayLabel}
                onChange={(e) => setFormData({ ...formData, modelDisplayLabel: e.target.value })}
                placeholder={localize('com_ui_model_form_tag_placeholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fetch">
                <input
                  type="checkbox"
                  id="fetch"
                  checked={formData.models.fetch}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      models: { ...formData.models, fetch: e.target.checked },
                    })
                  }
                  className="mr-2"
                />
                {localize('com_ui_model_form_get_models')}
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <OGDialogClose asChild>
                <Button variant="ghost">{localize('com_ui_model_form_cancel')}</Button>
              </OGDialogClose>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isLoading || updateMutation.isLoading}
              >
                {createMutation.isLoading || updateMutation.isLoading ? (
                  <Spinner className="mr-2" />
                ) : null}
                {editingIndex >= 0
                  ? localize('com_ui_model_form_update')
                  : localize('com_ui_model_form_create')}
              </Button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
