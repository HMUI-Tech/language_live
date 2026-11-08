import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const progress = sqliteTable('progress', {
 userId: text('user_id').primaryKey(),
 data: text('data').notNull(),
 revision: integer('revision').notNull().default(1),
 updatedAt: integer('updated_at').notNull(),
});
