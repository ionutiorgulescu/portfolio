CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker_symbol` text NOT NULL,
	`asset_name` text NOT NULL,
	`quantity` real NOT NULL,
	`price` real NOT NULL,
	`buy_date` text NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`transaction_type` text NOT NULL,
	`portfolio_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_positions_user_id` ON `positions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_positions_portfolio_id` ON `positions` (`portfolio_id`);