import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Download } from "@shared/schema";

export function useDownloads() {
  return useQuery({
    queryKey: [api.downloads.list.path],
    queryFn: async () => {
      const res = await fetch(api.downloads.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch downloads");
      const data = await res.json();
      return api.downloads.list.responses[200].parse(data);
    },
  });
}
