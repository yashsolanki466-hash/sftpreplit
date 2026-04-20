import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { File } from "@shared/schema";

export function useProjectFiles(projectId: number) {
  return useQuery({
    queryKey: ["project-files", projectId],
    queryFn: async () => {
      // NOTE: Using the path defined in routes.ts which is /api/projects/:id/files
      const url = buildUrl(api.files.list.path, { id: projectId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      return api.files.list.responses[200].parse(data);
    },
    enabled: !!projectId,
  });
}

export function useFile(id: number) {
  return useQuery({
    queryKey: [api.files.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.files.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch file");
      const data = await res.json();
      return api.files.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}
