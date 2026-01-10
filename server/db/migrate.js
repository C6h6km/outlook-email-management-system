/**
 * 数据迁移脚本
 * 从 Vercel Blob/JSON 迁移数据到 PostgreSQL
 * 
 * 使用方法: npm run migrate:data
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { getDb, isDatabaseAvailable, schema } = require('./index');
const { readJSONBlob } = require('../utils/blob-store');
const config = require('../config');

/**
 * 从本地 JSON 文件读取邮箱数据
 */
async function readFromLocalFile() {
    try {
        const filePath = path.join(config.dataDir, 'mailboxes.json');
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Migrate] No local mailboxes.json found');
            return [];
        }
        throw error;
    }
}

/**
 * 从 Blob 存储读取邮箱数据
 */
async function readFromBlob() {
    try {
        if (!config.blobToken) {
            console.log('[Migrate] Blob token not configured, skipping blob read');
            return [];
        }
        const data = await readJSONBlob(config.blobMailboxesKey || 'mailboxes/mailboxes.json');
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.log('[Migrate] Failed to read from Blob:', error.message);
        return [];
    }
}

/**
 * 转换邮箱数据格式（JSON -> DB）
 */
function transformMailboxData(mailbox) {
    return {
        id: mailbox.id,
        email: mailbox.email,
        password: mailbox.password,
        clientId: mailbox.client_id,
        refreshToken: mailbox.refresh_token,
        isActive: mailbox.is_active !== false,
        source: mailbox.source || 'manual',
        createdAt: mailbox.created_at ? new Date(mailbox.created_at) : new Date(),
        updatedAt: mailbox.updated_at ? new Date(mailbox.updated_at) : new Date(),
    };
}

/**
 * 主迁移函数
 */
async function migrate() {
    console.log('='.repeat(50));
    console.log('[Migrate] Starting data migration to PostgreSQL...');
    console.log('='.repeat(50));

    // 检查数据库连接
    if (!isDatabaseAvailable()) {
        console.error('[Migrate] ERROR: Database is not available.');
        console.error('[Migrate] Please set DATABASE_URL in your .env file');
        process.exit(1);
    }

    const db = getDb();

    // 读取现有数据（优先 Blob，其次本地文件）
    console.log('\n[Migrate] Step 1: Reading existing data...');

    let mailboxes = await readFromBlob();
    if (mailboxes.length === 0) {
        console.log('[Migrate] No data in Blob, trying local file...');
        mailboxes = await readFromLocalFile();
    }

    if (mailboxes.length === 0) {
        console.log('[Migrate] No existing data to migrate.');
        console.log('[Migrate] Migration complete (no data).');
        return;
    }

    // 过滤活跃的邮箱
    const activeMailboxes = mailboxes.filter(m => m.is_active !== false);
    console.log(`[Migrate] Found ${mailboxes.length} total mailboxes, ${activeMailboxes.length} active`);

    // 插入数据
    console.log('\n[Migrate] Step 2: Inserting data into PostgreSQL...');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const mailbox of activeMailboxes) {
        try {
            const transformedData = transformMailboxData(mailbox);

            // 使用 upsert (on conflict update)
            await db.insert(schema.mailboxes)
                .values(transformedData)
                .onConflictDoUpdate({
                    target: schema.mailboxes.email,
                    set: {
                        password: transformedData.password,
                        clientId: transformedData.clientId,
                        refreshToken: transformedData.refreshToken,
                        isActive: transformedData.isActive,
                        source: transformedData.source,
                        updatedAt: new Date(),
                    },
                });

            successCount++;
            if (successCount % 10 === 0) {
                console.log(`[Migrate] Progress: ${successCount}/${activeMailboxes.length}`);
            }
        } catch (error) {
            if (error.message.includes('duplicate key')) {
                skipCount++;
            } else {
                errorCount++;
                console.error(`[Migrate] Error inserting ${mailbox.email}:`, error.message);
            }
        }
    }

    // 输出结果
    console.log('\n' + '='.repeat(50));
    console.log('[Migrate] Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${successCount}`);
    console.log(`  ⏭️ Skipped (duplicate): ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (errorCount === 0) {
        console.log('\n[Migrate] ✨ Migration completed successfully!');
    } else {
        console.log('\n[Migrate] ⚠️ Migration completed with some errors.');
    }
}

// 执行迁移
migrate().catch(error => {
    console.error('[Migrate] Fatal error:', error);
    process.exit(1);
});
