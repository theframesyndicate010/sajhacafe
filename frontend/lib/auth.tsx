"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type User } from "@/lib/api/client";
export const authQueryKey = ["auth", "me"] as const;
export function useAuth() {
  const queryClient = useQueryClient();
  const query = useQuery<User>({ queryKey: authQueryKey, queryFn: api.auth.me, retry: false, staleTime: 60_000 });
  return { ...query, user: query.data, hasPermission: (permission: string) => query.data?.permissions.includes(permission) ?? false, logout: async () => { await api.auth.logout(); queryClient.clear(); }, switchTenant: async (tenantId: string) => { const user = await api.auth.switchTenant(tenantId); queryClient.clear(); queryClient.setQueryData(authQueryKey, user); return user; } };
}
