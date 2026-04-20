import { z } from "zod";
import { insertProjectSchema, projects, files, auditLogs, downloads } from "./schema";
import { users } from "./models/auth";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// File entry from FTP/SFTP
export const fileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory"]),
  size: z.number(),
  modifiedAt: z.string().nullable(),
});

export const api = {
  auth: {
    me: {
      method: "GET" as const,
      path: "/api/user",
      responses: {
        200: z.custom<typeof users.$inferSelect>().nullable(),
      }
    },
    status: {
      method: "GET" as const,
      path: "/api/auth/status",
      responses: {
        200: z.object({
          authenticated: z.boolean(),
          connectionType: z.enum(["ftp", "sftp", "none"]).optional(),
          host: z.string().optional(),
          user: z.custom<typeof users.$inferSelect>().nullable(),
        }),
      }
    }
  },
  ftp: {
    connect: {
      method: "POST" as const,
      path: "/api/ftp/connect",
      input: z.object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        password: z.string(),
        type: z.enum(["ftp", "sftp"]),
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: errorSchemas.validation,
      }
    },
    disconnect: {
      method: "POST" as const,
      path: "/api/ftp/disconnect",
      responses: {
        200: z.object({ success: z.boolean() }),
      }
    },
    list: {
      method: "GET" as const,
      path: "/api/ftp/files",
      input: z.object({
        path: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(fileEntrySchema),
        401: errorSchemas.notFound,
      }
    },
    download: {
      method: "GET" as const,
      path: "/api/ftp/download",
      input: z.object({
        path: z.string(),
      }),
      responses: {
        200: z.any(), // Binary file
        404: errorSchemas.notFound,
      }
    },
  },
  projects: {
    list: {
      method: "GET" as const,
      path: "/api/projects",
      responses: {
        200: z.array(z.custom<typeof projects.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/projects/:id",
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/projects",
      input: insertProjectSchema,
      responses: {
        201: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  files: {
    list: {
      method: "GET" as const,
      path: "/api/projects/:id/files",
      responses: {
        200: z.array(z.custom<typeof files.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/files/:id",
      responses: {
        200: z.custom<typeof files.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  audit: {
    list: {
      method: "GET" as const,
      path: "/api/audit-logs",
      responses: {
        200: z.array(z.custom<typeof auditLogs.$inferSelect>()),
      },
    },
  },
  downloads: {
    list: {
      method: "GET" as const,
      path: "/api/downloads",
      responses: {
        200: z.array(z.custom<typeof downloads.$inferSelect>()),
      },
    },
  },
  dashboard: {
    stats: {
      method: "GET" as const,
      path: "/api/dashboard/stats",
      responses: {
        200: z.object({
          totalFiles: z.number(),
          totalSize: z.number(),
          totalDownloads: z.number(),
          recentActivity: z.array(z.object({
            action: z.string(),
            details: z.string().nullable(),
            timestamp: z.string(),
          })),
        }),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
