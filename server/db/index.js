/**
 * 数据库连接管理
 * 使用 Neon serverless driver + Drizzle ORM
 */

const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const config = require('../config');
const schema = require('./schema');

/**
 * 创建数据库连接
 * @returns {Object} Drizzle 数据库实例
 */
function createDbConnection() {
    const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.warn('[DB] DATABASE_URL not configured, database features will be unavailable');
        return null;
    }

    try {
        const sql = neon(databaseUrl);
        const db = drizzle(sql, { schema });
        console.log('[DB] Database connection configured successfully');
        return db;
    } catch (error) {
        console.error('[DB] Failed to configure database connection:', error.message);
        return null;
    }
}

// 单例数据库连接
let dbInstance = null;

/**
 * 获取数据库实例（懒加载单例）
 * @returns {Object|null} Drizzle 数据库实例
 */
function getDb() {
    if (!dbInstance) {
        dbInstance = createDbConnection();
    }
    return dbInstance;
}

/**
 * 检查数据库是否可用
 * @returns {boolean}
 */
function isDatabaseAvailable() {
    return getDb() !== null;
}

module.exports = {
    getDb,
    isDatabaseAvailable,
    schema,
};
