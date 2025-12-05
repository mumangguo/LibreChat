import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';

/**
 * Custom Endpoints Queries
 */
export const useGetCustomEndpointsQuery = (
  config?: UseQueryOptions<{ success: boolean; data: any[] }>,
): QueryObserverResult<{ success: boolean; data: any[] }> => {
  return useQuery<{ success: boolean; data: any[] }>(
    ['config', 'customEndpoints'],
    () => dataService.getCustomEndpoints(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
    },
  );
};

export const useCreateCustomEndpointMutation = (
  options?: UseMutationOptions<{ success: boolean; message: string }, unknown, any>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, unknown, any>(
    (payload) => dataService.createCustomEndpoint(payload),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries(['config', 'customEndpoints']);
        queryClient.invalidateQueries([QueryKeys.endpoints]);
        queryClient.invalidateQueries([QueryKeys.startupConfig]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useUpdateCustomEndpointMutation = (
  options?: UseMutationOptions<{ success: boolean; message: string }, unknown, { index: number; payload: any }>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, unknown, { index: number; payload: any }>(
    ({ index, payload }) => dataService.updateCustomEndpoint(index, payload),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries(['config', 'customEndpoints']);
        queryClient.invalidateQueries([QueryKeys.endpoints]);
        queryClient.invalidateQueries([QueryKeys.startupConfig]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useDeleteCustomEndpointMutation = (
  options?: UseMutationOptions<{ success: boolean; message: string }, unknown, number>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, unknown, number>(
    (index) => dataService.deleteCustomEndpoint(index),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries(['config', 'customEndpoints']);
        queryClient.invalidateQueries([QueryKeys.endpoints]);
        queryClient.invalidateQueries([QueryKeys.startupConfig]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

/**
 * MCP Servers Queries
 */
export const useGetMCPServersQuery = (
  config?: UseQueryOptions<{ success: boolean; data: any[] }>,
): QueryObserverResult<{ success: boolean; data: any[] }> => {
  return useQuery<{ success: boolean; data: any[] }>(
    ['config', 'mcpServers'],
    () => dataService.getMCPServers(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
    },
  );
};

export const useCreateMCPServerMutation = (
  options?: UseMutationOptions<{ success: boolean; message: string }, unknown, any>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, unknown, any>(
    (payload) => dataService.createMCPServer(payload),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries(['config', 'mcpServers']);
        queryClient.invalidateQueries([QueryKeys.startupConfig]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useUpdateMCPServerMutation = (
  options?: UseMutationOptions<{ success: boolean; message: string }, unknown, { name: string; payload: any }>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, unknown, { name: string; payload: any }>(
    ({ name, payload }) => dataService.updateMCPServer(name, payload),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries(['config', 'mcpServers']);
        queryClient.invalidateQueries([QueryKeys.startupConfig]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};

export const useDeleteMCPServerMutation = (
  options?: UseMutationOptions<{ success: boolean; message: string }, unknown, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, unknown, string>(
    (name) => dataService.deleteMCPServer(name),
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries(['config', 'mcpServers']);
        queryClient.invalidateQueries([QueryKeys.startupConfig]);
        options?.onSuccess?.(data, variables, context);
      },
    },
  );
};
