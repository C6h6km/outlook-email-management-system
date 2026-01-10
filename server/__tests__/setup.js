/**
 * Jest 测试全局设置
 * 在所有测试运行前设置环境变量
 */

// 设置 Blob Token 让服务使用 blob 存储模式（会被 Mock 拦截）
process.env.BLOB_READ_WRITE_TOKEN = 'mock-token-for-testing';
process.env.outlook_READ_WRITE_TOKEN = 'mock-token-for-testing';

// 禁止使用数据库（确保使用 blob 模式）
delete process.env.DATABASE_URL;

// 使用旧存储模式
process.env.USE_LEGACY_STORAGE = 'true';
