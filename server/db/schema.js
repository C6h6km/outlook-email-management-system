/**
 * Drizzle 表结构定义
 * 定义 mailboxes 表及其字段
 */

const { pgTable, uuid, varchar, boolean, timestamp, index } = require('drizzle-orm/pg-core');

/**
 * 邮箱表结构
 */
const mailboxes = pgTable('mailboxes', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 1024 }).notNull(),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    refreshToken: varchar('refresh_token', { length: 2048 }).notNull(),
    isActive: boolean('is_active').default(true),
    source: varchar('source', { length: 50 }).default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('idx_mailboxes_email').on(table.email),
    index('idx_mailboxes_is_active').on(table.isActive),
    index('idx_mailboxes_source').on(table.source),
]);

module.exports = { mailboxes };
