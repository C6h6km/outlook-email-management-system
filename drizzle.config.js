/**
 * Drizzle ORM 配置文件
 * 用于数据库迁移和 schema 生成
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './server/db/schema.js',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
});
