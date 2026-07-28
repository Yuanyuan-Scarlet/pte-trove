import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const materialVersions = sqliteTable("material_versions", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("DRAFT"),
  createdAt: integer("created_at").notNull(),
  publishedAt: integer("published_at"),
  generationDeadline: integer("generation_deadline"),
  expiresAt: integer("expires_at"),
});

export const materialAssets = sqliteTable("material_assets", {
  id: text("id").primaryKey(),
  materialVersionId: text("material_version_id").notNull(),
  materialType: text("material_type").notNull(),
  sourceStorageKey: text("source_storage_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileSize: integer("file_size").notNull(),
  pageCount: integer("page_count").notNull(),
  checksum: text("checksum").notNull(),
  validationStatus: text("validation_status").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("assets_version_type_unique").on(table.materialVersionId, table.materialType)]);

export const productLinks = sqliteTable("product_links", {
  id: text("id").primaryKey(),
  materialVersionId: text("material_version_id").notNull(),
  productEntry: text("product_entry").notNull(),
  tokenCiphertext: text("token_ciphertext").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("product_links_version_entry_unique").on(table.materialVersionId, table.productEntry),
  uniqueIndex("product_links_hash_unique").on(table.tokenHash),
]);

export const buyerBindings = sqliteTable("buyer_bindings", {
  id: text("id").primaryKey(),
  materialVersionId: text("material_version_id").notNull(),
  productEntry: text("product_entry").notNull(),
  phone: text("phone").notNull(),
  orderNumber: text("order_number").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("bindings_phone_unique").on(table.materialVersionId, table.productEntry, table.phone),
  uniqueIndex("bindings_order_unique").on(table.materialVersionId, table.productEntry, table.orderNumber),
]);

export const generationJobs = sqliteTable("generation_jobs", {
  id: text("id").primaryKey(),
  buyerBindingId: text("buyer_binding_id").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
}, (table) => [uniqueIndex("generation_binding_unique").on(table.buyerBindingId)]);

export const generatedFiles = sqliteTable("generated_files", {
  id: text("id").primaryKey(),
  generationJobId: text("generation_job_id").notNull(),
  storageKey: text("storage_key").notNull(),
  downloadFilename: text("download_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum").notNull(),
  generatedAt: integer("generated_at").notNull(),
  archiveAt: integer("archive_at").notNull(),
  archivedAt: integer("archived_at"),
  archiveStorageKey: text("archive_storage_key"),
  status: text("status").notNull(),
}, (table) => [uniqueIndex("generated_job_unique").on(table.generationJobId), index("generated_archive_idx").on(table.status, table.archiveAt)]);

export const buyerSessions = sqliteTable("buyer_sessions", {
  id: text("id").primaryKey(),
  buyerBindingId: text("buyer_binding_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
}, (table) => [uniqueIndex("buyer_session_hash_unique").on(table.tokenHash), index("buyer_session_binding_idx").on(table.buyerBindingId)]);

export const otpChallenges = sqliteTable("otp_challenges", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: text("purpose").notNull(),
  ip: text("ip").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  consumedAt: integer("consumed_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("otp_phone_created_idx").on(table.phone, table.createdAt), index("otp_ip_created_idx").on(table.ip, table.createdAt)]);

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
}, (table) => [uniqueIndex("admin_session_hash_unique").on(table.tokenHash)]);

export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull(),
  succeeded: integer("succeeded").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("admin_login_ip_created_idx").on(table.ip, table.createdAt)]);
