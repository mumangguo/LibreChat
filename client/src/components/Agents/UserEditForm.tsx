import { useState } from 'react';
import { Button, Input, Label } from '@librechat/client';
import { SystemRoles } from 'librechat-data-provider';
import type { TUser } from 'librechat-data-provider';
import { useCreateUserMutation, useUpdateUserByIdMutation } from '~/data-provider';
import { useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface UserEditFormProps {
  user?: TUser | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UserEditForm({ user, onClose, onSuccess }: UserEditFormProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isEditing = !!user;

  const [formData, setFormData] = useState({
    email: user?.email || '',
    username: user?.username || '',
    name: user?.name || '',
    password: '',
    role: user?.role || SystemRoles.USER,
  });

  const createUserMutation = useCreateUserMutation({
    onSuccess: () => {
      showToast({
        message: '用户创建成功',
        status: 'success',
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      showToast({
        message: error.message || '创建用户失败',
        status: 'error',
      });
    },
  });

  const updateUserMutation = useUpdateUserByIdMutation({
    onSuccess: () => {
      showToast({
        message: '用户更新成功',
        status: 'success',
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      showToast({
        message: error.message || '更新用户失败',
        status: 'error',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateUserMutation.mutate({
        user_id: user!.id,
        ...formData,
        // Only include password if it's not empty
        ...(formData.password ? { password: formData.password } : {}),
      });
    } else {
      if (!formData.password) {
        showToast({
          message: '创建用户需要设置密码',
          status: 'error',
        });
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">{localize('com_ui_user_table_email')} *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={isEditing}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="username">{localize('com_ui_user_table_username')}</Label>
        <Input
          id="username"
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="name">{localize('com_ui_user_table_nickname')}</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="password">
          {isEditing
            ? localize('com_ui_user_form_new_password')
            : localize('com_ui_user_form_password')}
        </Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!isEditing}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="role">{localize('com_ui_user_table_role')}</Label>
        <select
          id="role"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="mt-1 flex h-10 w-full rounded-md border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value={SystemRoles.USER}>{localize('com_ui_user_form_user')}</option>
          <option value={SystemRoles.ADMIN}>{localize('com_ui_user_form_admin')}</option>
        </select>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {localize('com_ui_user_form_cancel')}
        </Button>
        <Button disabled={createUserMutation.isLoading || updateUserMutation.isLoading}>
          {isEditing ? localize('com_ui_user_form_update') : localize('com_ui_user_form_create')}
        </Button>
      </div>
    </form>
  );
}
