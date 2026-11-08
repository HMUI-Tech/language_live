import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const progress = sqliteTable('progress', {
 userId: text('user_id').primaryKey(),
 data: text('data').notNull(),
 revision: integer('revision').notNull().default(1),
 updatedAt: integer('updated_at').notNull(),
});

// Social records are scoped to this language edition and never expose account identities.
export const worldPeople = sqliteTable('world_people', {
 id: text('id').primaryKey(),
 ageBand: text('age_band').notNull(),
 alias: text('alias').notNull(),
 invite: text('invite').notNull().unique(),
 inviteExpires: integer('invite_expires').notNull(),
 enabled: integer('enabled').notNull().default(1),
 createdAt: integer('created_at').notNull(),
});
export const worldFriends = sqliteTable('world_friends', {
 id: text('id').primaryKey(), a: text('a').notNull(), b: text('b').notNull(),
 requester: text('requester').notNull(), status: text('status').notNull(),
 createdAt: integer('created_at').notNull(),
});
export const worldBlocks = sqliteTable('world_blocks', {
 id: text('id').primaryKey(), blocker: text('blocker').notNull(), blocked: text('blocked').notNull(),
},t=>[index('world_blocks_pair_idx').on(t.blocker,t.blocked)]);
export const worldRooms = sqliteTable('world_rooms', {
 id: text('id').primaryKey(), owner: text('owner'), ageBand: text('age_band').notNull(),
 title: text('title').notNull(), invite: text('invite').unique(), inviteExpires: integer('invite_expires'),
});
export const worldMembers = sqliteTable('world_members', {
 id: text('id').primaryKey(), room: text('room').notNull(), person: text('person').notNull(),
},t=>[index('world_members_person_idx').on(t.person),index('world_members_room_idx').on(t.room)]);
export const worldMessages = sqliteTable('world_messages', {
 id: text('id').primaryKey(), room: text('room').notNull(), sender: text('sender').notNull(),
 text: text('text').notNull(), createdAt: integer('created_at').notNull(), hidden: integer('hidden').notNull().default(0),
},t=>[index('world_messages_room_time_idx').on(t.room,t.createdAt),index('world_messages_sender_time_idx').on(t.sender,t.createdAt)]);
export const worldReports = sqliteTable('world_reports', {
 id: text('id').primaryKey(), message: text('message').notNull(), reporter: text('reporter').notNull(),
 reason: text('reason').notNull(), createdAt: integer('created_at').notNull(), resolved: integer('resolved').notNull().default(0),
},t=>[index('world_reports_status_idx').on(t.resolved,t.createdAt),index('world_reports_message_idx').on(t.message,t.reporter)]);
export const worldBans = sqliteTable('world_bans', { id: text('id').primaryKey(), createdAt: integer('created_at').notNull() });
