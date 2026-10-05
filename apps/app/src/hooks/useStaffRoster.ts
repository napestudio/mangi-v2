import type { StaffRosterItem } from "@mangiar/shared";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "../lib/api-client";

export function useStaffRoster(): UseQueryResult<StaffRosterItem[]> {
  return useQuery({
    queryKey: ["staff-roster"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<StaffRosterItem[]>>("/users/roster");
      return data.data;
    },
  });
}
