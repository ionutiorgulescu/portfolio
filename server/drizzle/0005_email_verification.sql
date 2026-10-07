CREATE TABLE `email_verification_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_email_verification_codes_expires_at` ON `email_verification_codes` (`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` integer;--> statement-breakpoint
-- Accounts that existed before email verification are trusted.
UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;
