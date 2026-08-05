CREATE TABLE `manual_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`material_version_id` text NOT NULL,
	`product_entry` text NOT NULL,
	`salutation` text NOT NULL,
	`phone` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`storage_key` text,
	`download_filename` text,
	`mime_type` text,
	`file_size` integer,
	`checksum` text,
	`generated_at` integer,
	`archive_at` integer,
	`archived_at` integer,
	`archive_storage_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_version_created_idx` ON `manual_generations` (`material_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `manual_archive_idx` ON `manual_generations` (`status`,`archive_at`);