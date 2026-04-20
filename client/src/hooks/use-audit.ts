import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { AuditLog } from "@shared/schema";

export function useAuditLogs() {
  return useQuery({
    queryKey: [api.audit.list.path],
    queryFn: async () => {
      const res = await fetch(api.audit.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const data = await res.json();
      return api.audit.list.responses[200].parse(data);
    },
  });
}
