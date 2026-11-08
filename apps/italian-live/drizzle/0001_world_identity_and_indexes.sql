CREATE TABLE `world_identity_versions` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_maintenance` (
	`id` text PRIMARY KEY NOT NULL,
	`last_cleanup` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `world_friends_a_status_idx` ON `world_friends` (`a`,`status`);--> statement-breakpoint
CREATE INDEX `world_friends_b_status_idx` ON `world_friends` (`b`,`status`);--> statement-breakpoint
CREATE INDEX `world_friends_requester_time_idx` ON `world_friends` (`requester`,`created_at`);