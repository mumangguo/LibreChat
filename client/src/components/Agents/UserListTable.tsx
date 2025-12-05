import { useState } from 'react';
import { Eye, Plus } from 'lucide-react';
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
  OGDialogContent,
  OGDialogTitle,
  OGDialogClose,
  Spinner,
} from '@librechat/client';
import { SystemRoles, EModelEndpoint } from 'librechat-data-provider';
import type { TUser } from 'librechat-data-provider';
import {
  useListUsersQuery,
  useDeleteUserByIdMutation,
  useUpdateUserByIdMutation,
  useGetEndpointsQuery,
} from '~/data-provider';
import { useLocalize, useAuthContext } from '~/hooks';
import { EndpointIcon } from '~/components/Endpoints';
import UserEditForm from './UserEditForm';

interface UserListTableProps {
  onEdit?: (userId: string) => void;
}

export default function UserListTable({ onEdit }: UserListTableProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { user: currentUser } = useAuthContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const isAdmin = currentUser?.role === SystemRoles.ADMIN;
  const {
    data: usersResponse,
    isLoading,
    refetch,
  } = useListUsersQuery({
    enabled: !!isAdmin,
  });
  const users = usersResponse?.data ?? [];

  const [editingUser, setEditingUser] = useState<TUser | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const deleteUserMutation = useDeleteUserByIdMutation({
    onSuccess: () => {
      showToast({
        message: '用户已删除',
        status: 'success',
      });
    },
    onError: () => {
      showToast({
        message: '删除用户失败',
        status: 'error',
      });
    },
  });

  const updateUserMutation = useUpdateUserByIdMutation({
    onSuccess: () => {
      showToast({
        message: '角色更新成功',
        status: 'success',
      });
      refetch();
    },
    onError: (error: Error) => {
      showToast({
        message: error.message || '更新角色失败',
        status: 'error',
      });
    },
  });

  const handleDelete = (userId: string, userName?: string | null) => {
    deleteUserMutation.mutate({ user_id: userId });
  };

  const handleToggleRole = (user: TUser) => {
    const newRole = user.role === SystemRoles.ADMIN ? SystemRoles.USER : SystemRoles.ADMIN;
    updateUserMutation.mutate({
      user_id: user.id,
      role: newRole,
    });
  };

  const handleEdit = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setEditingUser(user);
    }
  };

  const getRoleLabel = (role?: string) => {
    if (!role) return '用户';
    if (role === SystemRoles.ADMIN) {
      return '管理员';
    }
    return '用户';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-text-secondary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <OGDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <OGDialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {localize('com_nav_user_create')}
              </Button>
            </OGDialogTrigger>
            <OGDialogContent className="border-border-light bg-surface-primary text-text-primary lg:w-1/3">
              <OGDialogTitle>{localize('com_nav_user_create')}</OGDialogTitle>
              <UserEditForm
                onClose={() => setShowCreateDialog(false)}
                onSuccess={() => {
                  refetch();
                  setShowCreateDialog(false);
                }}
              />
            </OGDialogContent>
          </OGDialog>
        </div>
      )}

      {editingUser && (
        <OGDialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <OGDialogContent className="border-border-light bg-surface-primary text-text-primary lg:w-1/3">
            <OGDialogTitle>{localize('com_nav_user_edit')}</OGDialogTitle>
            <UserEditForm
              user={editingUser}
              onClose={() => setEditingUser(null)}
              onSuccess={() => {
                refetch();
                setEditingUser(null);
              }}
            />
          </OGDialogContent>
        </OGDialog>
      )}

      {users.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-text-secondary">{localize('com_nav_not_found_user')}</div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border-light">
                <TableHead className="w-[50px] px-4 py-3 text-left text-sm font-medium text-text-primary">
                  {/* Avatar column header */}
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  {localize('com_ui_user_table_nickname')}
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  {localize('com_ui_user_table_username')}
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  {localize('com_ui_user_table_email')}
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                  {localize('com_ui_user_table_role')}
                </TableHead>
                <TableHead className="w-[120px] px-4 py-3 text-center text-sm font-medium text-text-primary">
                  {localize('com_ui_user_table_operate')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: TUser) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-surface-secondary/50 border-b border-border-light"
                >
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center justify-center">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name || user.username || user.email}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <EndpointIcon
                            conversation={{
                              endpoint: EModelEndpoint.openAI,
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
                    <div className="font-semibold text-text-primary">
                      {user.name || user.username || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="text-sm text-text-secondary">{user.username || '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="text-sm text-text-secondary">{user.email || '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="text-sm text-text-secondary">{getRoleLabel(user.role)}</div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {user.id !== currentUser?.id && (
                        <TooltipAnchor
                          description={
                            user.role === SystemRoles.ADMIN
                              ? localize('com_nav_user_setting_user')
                              : localize('com_nav_user_setting_admin')
                          }
                        >
                          <Button
                            variant="ghost"
                            aria-label={
                              user.role === SystemRoles.ADMIN
                                ? localize('com_nav_user_setting_user')
                                : localize('com_nav_user_setting_admin')
                            }
                            onClick={() => handleToggleRole(user)}
                            disabled={updateUserMutation.isLoading}
                            className="h-8 w-8 p-0"
                          >
                            {user.role === SystemRoles.ADMIN ? (
                              <Eye className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </TooltipAnchor>
                      )}
                      {isAdmin && (
                        <>
                          <TooltipAnchor description={localize('com_ui_edit')}>
                            <Button
                              variant="ghost"
                              aria-label={localize('com_ui_edit')}
                              onClick={() => handleEdit(user.id)}
                              className="h-8 w-8 p-0"
                            >
                              <EditIcon className="h-4 w-4 text-yellow-500" />
                            </Button>
                          </TooltipAnchor>
                        </>
                      )}
                      {isAdmin && user.id !== currentUser?.id && (
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
                            title={localize('com_nav_user_delete')}
                            description={localize('com_nav_user_confirm_delete')}
                            selection={{
                              selectHandler: () =>
                                handleDelete(user.id, user.name || user.username),
                              selectText: (
                                <span className="flex items-center gap-2">
                                  {deleteUserMutation.isLoading && <Spinner />}
                                  {localize('com_ui_delete')}
                                </span>
                              ),
                              isLoading: deleteUserMutation.isLoading,
                            }}
                          />
                        </OGDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
