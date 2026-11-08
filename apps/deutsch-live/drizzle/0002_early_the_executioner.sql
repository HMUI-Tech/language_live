CREATE INDEX `world_blocks_pair_idx` ON `world_blocks` (`blocker`,`blocked`);--> statement-breakpoint
CREATE INDEX `world_members_person_idx` ON `world_members` (`person`);--> statement-breakpoint
CREATE INDEX `world_members_room_idx` ON `world_members` (`room`);--> statement-breakpoint
CREATE INDEX `world_messages_room_time_idx` ON `world_messages` (`room`,`created_at`);--> statement-breakpoint
CREATE INDEX `world_messages_sender_time_idx` ON `world_messages` (`sender`,`created_at`);--> statement-breakpoint
CREATE INDEX `world_reports_status_idx` ON `world_reports` (`resolved`,`created_at`);--> statement-breakpoint
CREATE INDEX `world_reports_message_idx` ON `world_reports` (`message`,`reporter`);