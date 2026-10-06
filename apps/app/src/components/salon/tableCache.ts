import type { TableStatus } from "@mangiar/shared";
import type { QueryClient } from "@tanstack/react-query";
import type { FloorPlanTable } from "./FloorPlanCanvas";

/** Patches every cached tables list (the current sector's and any "all tables" list) in one go. */
export function patchTableStatus(queryClient: QueryClient, tableId: string, status: TableStatus): void {
  queryClient.setQueriesData<FloorPlanTable[]>({ queryKey: ["tables"] }, (prev) =>
    prev?.map((table) => (table.id === tableId ? { ...table, status } : table)),
  );
}
