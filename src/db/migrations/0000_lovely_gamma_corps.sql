CREATE TABLE `ai_chats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `annual_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`budgeted_amount` real DEFAULT 0 NOT NULL,
	`actual_amount` real DEFAULT 0,
	`due_month` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`month` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`icon` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`imported_at` text DEFAULT (datetime('now')),
	`row_count` integer DEFAULT 0,
	`source` text,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `investments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`fund_name` text NOT NULL,
	`monthly_amount` real DEFAULT 0 NOT NULL,
	`step_up_percent` real DEFAULT 10,
	`step_up_mode` text DEFAULT 'manual',
	`sip_date` integer,
	`platform` text,
	`is_frozen` integer DEFAULT false,
	`current_value` real,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `ltgs_tracker` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`financial_year` text NOT NULL,
	`exemption_limit` real DEFAULT 100000 NOT NULL,
	`used` real DEFAULT 0 NOT NULL,
	`notes` text,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`monthly_amount` real DEFAULT 0 NOT NULL,
	`yearly_amount` real DEFAULT 0 NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`next_due_date` text,
	`is_active` integer DEFAULT true,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `tax_deductions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`financial_year` text NOT NULL,
	`section` text NOT NULL,
	`description` text NOT NULL,
	`limit` real DEFAULT 0 NOT NULL,
	`used` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`category_id` integer,
	`month` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`import_id` integer,
	`notes` text,
	`is_verified` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vault` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`encrypted_data` text NOT NULL,
	`iv` text NOT NULL,
	`auth_tag` text NOT NULL,
	`reminder_date` text,
	`reminder_note` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
