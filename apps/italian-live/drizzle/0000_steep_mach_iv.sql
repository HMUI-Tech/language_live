CREATE TABLE `progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_bans` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker` text NOT NULL,
	`blocked` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_blocks_pair_idx` ON `world_blocks` (`blocker`,`blocked`);--> statement-breakpoint
CREATE TABLE `world_friends` (
	`id` text PRIMARY KEY NOT NULL,
	`a` text NOT NULL,
	`b` text NOT NULL,
	`requester` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`person` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_members_person_idx` ON `world_members` (`person`);--> statement-breakpoint
CREATE INDEX `world_members_room_idx` ON `world_members` (`room`);--> statement-breakpoint
CREATE TABLE `world_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`sender` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_messages_room_time_idx` ON `world_messages` (`room`,`created_at`);--> statement-breakpoint
CREATE INDEX `world_messages_sender_time_idx` ON `world_messages` (`sender`,`created_at`);--> statement-breakpoint
CREATE TABLE `world_people` (
	`id` text PRIMARY KEY NOT NULL,
	`age_band` text NOT NULL,
	`alias` text NOT NULL,
	`invite` text NOT NULL,
	`invite_expires` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `world_people_invite_unique` ON `world_people` (`invite`);--> statement-breakpoint
CREATE TABLE `world_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`reporter` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_reports_status_idx` ON `world_reports` (`resolved`,`created_at`);--> statement-breakpoint
CREATE INDEX `world_reports_message_idx` ON `world_reports` (`message`,`reporter`);--> statement-breakpoint
CREATE TABLE `world_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text,
	`age_band` text NOT NULL,
	`title` text NOT NULL,
	`invite` text,
	`invite_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `world_rooms_invite_unique` ON `world_rooms` (`invite`);