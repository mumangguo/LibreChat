import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';

export interface UserListResponse {
  data: t.TUser[];
}

/**
 * Hook for listing all users (admin only)
 */
export const useListUsersQuery = <TData = UserListResponse>(
  config?: UseQueryOptions<UserListResponse, unknown, TData>,
): QueryObserverResult<TData> => {
  return useQuery<UserListResponse, unknown, TData>(
    ['users'],
    () => dataService.listUsers(),
    {
      staleTime: 1000 * 5,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      ...config,
    },
  );
};

