import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TUser } from 'librechat-data-provider';

export interface DeleteUserBody {
  user_id: string;
}

export interface CreateUserBody {
  email: string;
  username?: string;
  name?: string;
  password?: string;
  role?: string;
}

export interface UpdateUserBody {
  user_id: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  password?: string;
}

export interface DeleteUserMutationOptions {
  onSuccess?: (data: void, variables: DeleteUserBody, context: unknown) => void;
  onError?: (error: Error, variables: DeleteUserBody, context: unknown) => void;
}

export interface CreateUserMutationOptions {
  onSuccess?: (data: TUser, variables: CreateUserBody, context: unknown) => void;
  onError?: (error: Error, variables: CreateUserBody, context: unknown) => void;
}

export interface UpdateUserMutationOptions {
  onSuccess?: (data: TUser, variables: UpdateUserBody, context: unknown) => void;
  onError?: (error: Error, variables: UpdateUserBody, context: unknown) => void;
}

/**
 * Hook for creating a user (admin only)
 */
export const useCreateUserMutation = (
  options?: CreateUserMutationOptions,
): UseMutationResult<TUser, Error, CreateUserBody> => {
  const queryClient = useQueryClient();
  return useMutation(
    (variables: CreateUserBody) => {
      return dataService.createUser(variables);
    },
    {
      onError: (error, variables, context) => options?.onError?.(error, variables, context),
      onSuccess: (data, variables, context) => {
        // Invalidate users list query
        queryClient.invalidateQueries(['users']);
        return options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

/**
 * Hook for updating a user by ID (admin only)
 */
export const useUpdateUserByIdMutation = (
  options?: UpdateUserMutationOptions,
): UseMutationResult<TUser, Error, UpdateUserBody> => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ user_id, ...data }: UpdateUserBody) => {
      return dataService.updateUserById({ user_id, data });
    },
    {
      onError: (error, variables, context) => options?.onError?.(error, variables, context),
      onSuccess: (data, variables, context) => {
        // Invalidate users list query
        queryClient.invalidateQueries(['users']);
        return options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

/**
 * Hook for deleting a user by ID (admin only)
 * Note: This is different from useDeleteUserMutation in Auth/mutations.ts which deletes the current user
 */
export const useDeleteUserByIdMutation = (
  options?: DeleteUserMutationOptions,
): UseMutationResult<void, Error, DeleteUserBody> => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ user_id }: DeleteUserBody) => {
      return dataService.deleteUserById({ user_id });
    },
    {
      onError: (error, variables, context) => options?.onError?.(error, variables, context),
      onSuccess: (_data, variables, context) => {
        // Invalidate users list query
        queryClient.invalidateQueries(['users']);
        return options?.onSuccess?.(_data, variables, context);
      },
    },
  );
};

