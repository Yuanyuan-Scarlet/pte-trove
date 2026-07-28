CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_session_hash_unique` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `buyer_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`material_version_id` text NOT NULL,
	`product_entry` text NOT NULL,
	`phone` text NOT NULL,
	`order_number` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bindings_phone_unique` ON `buyer_bindings` (`material_version_id`,`product_entry`,`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `bindings_order_unique` ON `buyer_bindings` (`material_version_id`,`product_entry`,`order_number`);--> statement-breakpoint
CREATE TABLE `buyer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_binding_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_session_hash_unique` ON `buyer_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `buyer_session_binding_idx` ON `buyer_sessions` (`buyer_binding_id`);--> statement-breakpoint
CREATE TABLE `generated_files` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_job_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`download_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`checksum` text NOT NULL,
	`generated_at` integer NOT NULL,
	`archive_at` integer NOT NULL,
	`archived_at` integer,
	`archive_storage_key` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generated_job_unique` ON `generated_files` (`generation_job_id`);--> statement-breakpoint
CREATE INDEX `generated_archive_idx` ON `generated_files` (`status`,`archive_at`);--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_binding_id` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_binding_unique` ON `generation_jobs` (`buyer_binding_id`);--> statement-breakpoint
CREATE TABLE `material_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`material_version_id` text NOT NULL,
	`material_type` text NOT NULL,
	`source_storage_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`file_size` integer NOT NULL,
	`page_count` integer NOT NULL,
	`checksum` text NOT NULL,
	`validation_status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_version_type_unique` ON `material_assets` (`material_version_id`,`material_type`);--> statement-breakpoint
CREATE TABLE `material_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	`generation_deadline` integer,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `otp_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`ip` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `otp_phone_created_idx` ON `otp_challenges` (`phone`,`created_at`);--> statement-breakpoint
CREATE INDEX `otp_ip_created_idx` ON `otp_challenges` (`ip`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_links` (
	`id` text PRIMARY KEY NOT NULL,
	`material_version_id` text NOT NULL,
	`product_entry` text NOT NULL,
	`token_ciphertext` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_links_version_entry_unique` ON `product_links` (`material_version_id`,`product_entry`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_links_hash_unique` ON `product_links` (`token_hash`);