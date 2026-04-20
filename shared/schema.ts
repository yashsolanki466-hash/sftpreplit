import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Export auth models (sessions table is required for Replit Auth)
// This includes the users table with proper structure for Replit Auth
export * from "./models/auth";

// Import users for relations (don't re-export, just use)
import { users } from "./models/auth";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  clientId: text("client_id").references(() => users.id), // Now references varchar ID
  status: text("status").default("active"), // active, archived
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"), // Extra project details
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  name: text("name").notNull(),
  path: text("path").notNull(), // Logical path
  size: integer("size").notNull(), // Bytes
  type: text("type").notNull(), // 'file' or 'directory'
  parentId: integer("parent_id"), // For nesting
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id), // Now references varchar ID
  action: text("action").notNull(), // 'login', 'download', 'upload', 'delete'
  details: text("details"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id),
  userId: text("user_id").references(() => users.id), // Now references varchar ID
  downloadedAt: timestamp("downloaded_at").defaultNow(),
});

// Relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(users, {
    fields: [projects.clientId],
    references: [users.id],
  }),
  files: many(files),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
    relationName: "parentChild",
  }),
  children: many(files, {
    relationName: "parentChild",
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertDownloadSchema = createInsertSchema(downloads).omit({ id: true, downloadedAt: true });

// Types
export type Project = typeof projects.$inferSelect;
export type File = typeof files.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Download = typeof downloads.$inferSelect;
