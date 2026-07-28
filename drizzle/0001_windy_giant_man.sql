CREATE TABLE `admin_login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`succeeded` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_login_ip_created_idx` ON `admin_login_attempts` (`ip`,`created_at`);