/**
 * 邮箱服务层 - 业务逻辑抽象
 * 
 * 存储后端优先级：
 * 1. 如果 USE_LEGACY_STORAGE=true，使用旧存储（Blob/JSON）
 * 2. 如果 DATABASE_URL 已配置，使用 PostgreSQL
 * 3. 否则回退到 Blob/JSON
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { eq, and } = require('drizzle-orm');
const config = require('../config');
const { readJSONBlob, writeJSONBlob } = require('../utils/blob-store');
const { getDb, isDatabaseAvailable, schema } = require('../db');
const { mailboxes } = schema;

class MailboxService {
    constructor() {
        this.dataDir = config.dataDir;
        this.mailboxesFile = config.mailboxesFile;
        this.blobKey = config.blobMailboxesKey || 'mailboxes/mailboxes.json';

        // 确定存储模式
        this._determineStorageMode();

        // 并发控制（仅用于旧存储模式）
        this.writeLock = Promise.resolve();
    }

    /**
     * 确定使用哪种存储模式
     * @private
     */
    _determineStorageMode() {
        // 强制使用旧存储
        if (config.useLegacyStorage) {
            this.storageMode = config.blobToken ? 'blob' : 'file';
            console.log(`[MailboxService] Using legacy storage mode: ${this.storageMode}`);
            return;
        }

        // 优先使用 PostgreSQL
        if (config.databaseUrl && isDatabaseAvailable()) {
            this.storageMode = 'postgres';
            console.log('[MailboxService] Using PostgreSQL storage');
            return;
        }

        // 回退到 Blob 或本地文件
        this.storageMode = config.blobToken ? 'blob' : 'file';
        console.log(`[MailboxService] Falling back to ${this.storageMode} storage`);
    }

    /**
     * 检查是否使用 PostgreSQL
     */
    isUsingDatabase() {
        return this.storageMode === 'postgres';
    }

    // ============================================================
    // 旧存储模式方法（Blob/JSON）
    // ============================================================

    /**
     * 获取写锁，确保写操作串行执行（仅用于旧存储）
     * @private
     */
    async _acquireWriteLock(operation) {
        const previousLock = this.writeLock;
        let releaseLock;
        this.writeLock = new Promise(resolve => {
            releaseLock = resolve;
        });

        try {
            await previousLock;
            return await operation();
        } finally {
            releaseLock();
        }
    }

    /**
     * 确保数据文件存在（仅用于文件模式）
     */
    async ensureDataFile() {
        if (this.storageMode !== 'file') return;

        try {
            await fs.access(this.dataDir);
        } catch {
            try {
                await fs.mkdir(this.dataDir, { recursive: true });
            } catch (err) {
                console.warn('无法创建数据目录:', err.message);
                return;
            }
        }

        try {
            await fs.access(this.mailboxesFile);
        } catch {
            try {
                await fs.writeFile(this.mailboxesFile, JSON.stringify([]));
            } catch (err) {
                console.warn('无法创建数据文件:', err.message);
            }
        }
    }

    /**
     * 读取邮箱列表（旧存储模式）
     * @private
     */
    async _readMailboxesLegacy() {
        if (this.storageMode === 'blob') {
            const data = await readJSONBlob(this.blobKey);
            return Array.isArray(data) ? data : [];
        }

        await this.ensureDataFile();
        try {
            const content = await fs.readFile(this.mailboxesFile, 'utf8');
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.warn('读取邮箱文件失败:', err.message);
            return [];
        }
    }

    /**
     * 写入邮箱列表（旧存储模式）
     * @private
     */
    async _writeMailboxesLegacy(mailboxes) {
        if (this.storageMode === 'blob') {
            await writeJSONBlob(this.blobKey, mailboxes);
            return;
        }

        await this.ensureDataFile();
        try {
            await fs.writeFile(this.mailboxesFile, JSON.stringify(mailboxes, null, 2));
        } catch (err) {
            console.error('写入邮箱文件失败:', err.message);
            throw new Error('无法保存邮箱数据');
        }
    }

    // ============================================================
    // 数据转换方法
    // ============================================================

    /**
     * 数据库行转换为 JSON 格式
     * @private
     */
    _dbRowToJson(row) {
        return {
            id: row.id,
            email: row.email,
            password: row.password,
            client_id: row.clientId,
            refresh_token: row.refreshToken,
            is_active: row.isActive,
            source: row.source,
            created_at: row.createdAt?.toISOString(),
            updated_at: row.updatedAt?.toISOString(),
        };
    }

    /**
     * JSON 格式转换为数据库插入值
     * @private
     */
    _jsonToDbValues(data) {
        return {
            email: data.email,
            password: data.password,
            clientId: data.client_id,
            refreshToken: data.refresh_token,
            isActive: data.is_active !== false,
            source: data.source || 'manual',
        };
    }

    // ============================================================
    // 公共 API 方法
    // ============================================================

    /**
     * 获取所有活跃邮箱
     */
    async getAllMailboxes() {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const rows = await db.select().from(mailboxes).where(eq(mailboxes.isActive, true));
            return rows.map(row => this._dbRowToJson(row));
        }

        const data = await this._readMailboxesLegacy();
        return data.filter(m => m.is_active !== false);
    }

    /**
     * 根据ID获取邮箱
     */
    async getMailboxById(id) {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const rows = await db.select().from(mailboxes).where(eq(mailboxes.id, id));
            return rows.length > 0 ? this._dbRowToJson(rows[0]) : null;
        }

        const data = await this._readMailboxesLegacy();
        return data.find(m => m.id === id) || null;
    }

    /**
     * 根据邮箱地址获取邮箱
     */
    async getMailboxByEmail(email) {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const rows = await db.select().from(mailboxes)
                .where(and(eq(mailboxes.email, email), eq(mailboxes.isActive, true)));
            return rows.length > 0 ? this._dbRowToJson(rows[0]) : null;
        }

        const data = await this._readMailboxesLegacy();
        return data.find(m => m.email === email && m.is_active !== false) || null;
    }

    /**
     * 添加单个邮箱
     */
    async addMailbox(mailboxData) {
        const { email, password, client_id, refresh_token } = mailboxData;
        const source = mailboxData.source || 'manual';

        // 验证必填字段
        if (!email || !password || !client_id || !refresh_token) {
            throw new Error('缺少必要的邮箱配置信息');
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('邮箱格式无效');
        }

        // 验证字段长度
        if (email.length > 255) throw new Error('邮箱地址过长（最大 255 字符）');
        if (password.length > 1024) throw new Error('密码过长（最大 1024 字符）');
        if (client_id.length > 255) throw new Error('客户端 ID 过长（最大 255 字符）');
        if (refresh_token.length > 2048) throw new Error('刷新令牌过长（最大 2048 字符）');

        if (this.storageMode === 'postgres') {
            const db = getDb();

            // 检查是否已存在
            const existing = await db.select().from(mailboxes).where(eq(mailboxes.email, email));

            if (existing.length > 0) {
                const row = existing[0];
                if (row.isActive) {
                    throw new Error('邮箱已存在');
                }
                // 重新激活已删除的邮箱
                const [updated] = await db.update(mailboxes)
                    .set({
                        password,
                        clientId: client_id,
                        refreshToken: refresh_token,
                        isActive: true,
                        updatedAt: new Date(),
                    })
                    .where(eq(mailboxes.id, row.id))
                    .returning();
                return this._dbRowToJson(updated);
            }

            // 创建新邮箱
            const [inserted] = await db.insert(mailboxes)
                .values({
                    email,
                    password,
                    clientId: client_id,
                    refreshToken: refresh_token,
                    isActive: true,
                    source,
                })
                .returning();
            return this._dbRowToJson(inserted);
        }

        // 旧存储模式
        return this._acquireWriteLock(async () => {
            const allMailboxes = await this._readMailboxesLegacy();
            const existing = allMailboxes.find(m => m.email === email);

            if (existing && existing.is_active !== false) {
                throw new Error('邮箱已存在');
            }

            const now = new Date().toISOString();
            let mailbox;

            if (existing && existing.is_active === false) {
                existing.password = password;
                existing.client_id = client_id;
                existing.refresh_token = refresh_token;
                existing.is_active = true;
                existing.updated_at = now;
                existing.source = existing.source || source;
                mailbox = existing;
            } else {
                mailbox = {
                    id: uuidv4(),
                    email,
                    password,
                    client_id,
                    refresh_token,
                    is_active: true,
                    source,
                    created_at: now,
                    updated_at: now,
                };
                allMailboxes.push(mailbox);
            }

            await this._writeMailboxesLegacy(allMailboxes);
            return mailbox;
        });
    }

    /**
     * 批量添加邮箱
     */
    async addMailboxesBatch(mailboxesData) {
        if (!Array.isArray(mailboxesData) || mailboxesData.length === 0) {
            throw new Error('邮箱数据格式错误');
        }

        // 验证每个邮箱的数据完整性和字段长度
        for (const mailbox of mailboxesData) {
            if (!mailbox.email || !mailbox.password || !mailbox.client_id || !mailbox.refresh_token) {
                throw new Error('邮箱配置信息不完整');
            }
            // 字段长度校验
            if (mailbox.email.length > 255) {
                throw new Error(`邮箱地址过长: ${mailbox.email.substring(0, 50)}...`);
            }
            if (mailbox.password.length > 1024) {
                throw new Error('密码过长（超过1024字符）');
            }
            if (mailbox.client_id.length > 255) {
                throw new Error('client_id 过长');
            }
            if (mailbox.refresh_token.length > 2048) {
                throw new Error('refresh_token 过长');
            }
            // 邮箱格式校验
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(mailbox.email)) {
                throw new Error(`邮箱格式无效: ${mailbox.email}`);
            }
        }

        if (this.storageMode === 'postgres') {
            const db = getDb();
            const added = [];
            const reactivated = [];
            const skipped = [];

            for (const data of mailboxesData) {
                const source = data.source || 'manual';
                const existing = await db.select().from(mailboxes).where(eq(mailboxes.email, data.email));

                if (existing.length === 0) {
                    // 新邮箱
                    const [inserted] = await db.insert(mailboxes)
                        .values({
                            email: data.email,
                            password: data.password,
                            clientId: data.client_id,
                            refreshToken: data.refresh_token,
                            isActive: true,
                            source,
                        })
                        .returning();
                    added.push(this._dbRowToJson(inserted));
                } else if (!existing[0].isActive) {
                    // 重新激活
                    const [updated] = await db.update(mailboxes)
                        .set({
                            password: data.password,
                            clientId: data.client_id,
                            refreshToken: data.refresh_token,
                            isActive: true,
                            updatedAt: new Date(),
                        })
                        .where(eq(mailboxes.id, existing[0].id))
                        .returning();
                    reactivated.push(this._dbRowToJson(updated));
                } else {
                    skipped.push(data.email);
                }
            }

            return {
                data: [...added, ...reactivated],
                added: added.length,
                reactivated: reactivated.length,
                skipped: skipped.length,
                skippedEmails: skipped,
            };
        }

        // 旧存储模式
        return this._acquireWriteLock(async () => {
            const existingMailboxes = await this._readMailboxesLegacy();
            const now = new Date().toISOString();
            const emailMap = new Map(existingMailboxes.map(m => [m.email, m]));

            const added = [];
            const reactivated = [];
            const skipped = [];

            for (const mailboxData of mailboxesData) {
                const current = emailMap.get(mailboxData.email);
                const source = mailboxData.source || 'manual';

                if (!current) {
                    const newMailbox = {
                        id: uuidv4(),
                        email: mailboxData.email,
                        password: mailboxData.password,
                        client_id: mailboxData.client_id,
                        refresh_token: mailboxData.refresh_token,
                        is_active: true,
                        source,
                        created_at: now,
                        updated_at: now,
                    };
                    existingMailboxes.push(newMailbox);
                    emailMap.set(newMailbox.email, newMailbox);
                    added.push(newMailbox);
                } else if (current.is_active === false) {
                    current.password = mailboxData.password;
                    current.client_id = mailboxData.client_id;
                    current.refresh_token = mailboxData.refresh_token;
                    current.is_active = true;
                    current.updated_at = now;
                    current.source = current.source || source;
                    reactivated.push(current);
                } else {
                    skipped.push(mailboxData.email);
                }
            }

            await this._writeMailboxesLegacy(existingMailboxes);

            return {
                data: [...added, ...reactivated],
                added: added.length,
                reactivated: reactivated.length,
                skipped: skipped.length,
                skippedEmails: skipped,
            };
        });
    }

    /**
     * 更新邮箱
     */
    async updateMailbox(id, updateData) {
        const { email, password, client_id, refresh_token } = updateData;

        const data = {};
        if (email) data.email = email;
        if (password) data.password = password;
        if (client_id) data.clientId = client_id;
        if (refresh_token) data.refreshToken = refresh_token;

        if (Object.keys(data).length === 0) {
            throw new Error('没有提供要更新的数据');
        }

        if (this.storageMode === 'postgres') {
            const db = getDb();
            data.updatedAt = new Date();

            const [updated] = await db.update(mailboxes)
                .set(data)
                .where(eq(mailboxes.id, id))
                .returning();

            if (!updated) {
                throw new Error('邮箱不存在');
            }
            return this._dbRowToJson(updated);
        }

        // 旧存储模式
        return this._acquireWriteLock(async () => {
            const allMailboxes = await this._readMailboxesLegacy();
            const mailbox = allMailboxes.find(m => m.id === id);

            if (!mailbox) {
                throw new Error('邮箱不存在');
            }

            // 转换字段名
            if (data.clientId) { data.client_id = data.clientId; delete data.clientId; }
            if (data.refreshToken) { data.refresh_token = data.refreshToken; delete data.refreshToken; }

            Object.assign(mailbox, data, { updated_at: new Date().toISOString() });

            await this._writeMailboxesLegacy(allMailboxes);
            return mailbox;
        });
    }

    /**
     * 删除邮箱（软删除）
     */
    async deleteMailbox(id) {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const [updated] = await db.update(mailboxes)
                .set({ isActive: false, updatedAt: new Date() })
                .where(eq(mailboxes.id, id))
                .returning();

            if (!updated) {
                throw new Error('邮箱不存在');
            }
            return { message: '邮箱删除成功' };
        }

        // 旧存储模式
        return this._acquireWriteLock(async () => {
            const allMailboxes = await this._readMailboxesLegacy();
            const mailbox = allMailboxes.find(m => m.id === id);

            if (!mailbox) {
                throw new Error('邮箱不存在');
            }

            mailbox.is_active = false;
            mailbox.updated_at = new Date().toISOString();

            await this._writeMailboxesLegacy(allMailboxes);
            return { message: '邮箱删除成功' };
        });
    }

    /**
     * 批量删除邮箱（软删除）
     */
    async deleteMailboxesBatch(ids = []) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error('缺少要删除的邮箱ID列表');
        }

        if (this.storageMode === 'postgres') {
            const db = getDb();
            let deleted = 0;

            for (const id of ids) {
                const result = await db.update(mailboxes)
                    .set({ isActive: false, updatedAt: new Date() })
                    .where(and(eq(mailboxes.id, id), eq(mailboxes.isActive, true)))
                    .returning();
                if (result.length > 0) deleted++;
            }

            return { message: '批量删除完成', deleted, total: ids.length };
        }

        // 旧存储模式
        return this._acquireWriteLock(async () => {
            const allMailboxes = await this._readMailboxesLegacy();
            let deleted = 0;
            const now = new Date().toISOString();

            for (const id of ids) {
                const mailbox = allMailboxes.find(m => m.id === id);
                if (mailbox && mailbox.is_active !== false) {
                    mailbox.is_active = false;
                    mailbox.updated_at = now;
                    deleted++;
                }
            }

            await this._writeMailboxesLegacy(allMailboxes);
            return { message: '批量删除完成', deleted, total: ids.length };
        });
    }

    /**
     * 永久删除邮箱（物理删除）
     */
    async permanentlyDeleteMailbox(id) {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const result = await db.delete(mailboxes).where(eq(mailboxes.id, id)).returning();

            if (result.length === 0) {
                throw new Error('邮箱不存在');
            }
            return { message: '邮箱永久删除成功' };
        }

        // 旧存储模式
        const allMailboxes = await this._readMailboxesLegacy();
        const index = allMailboxes.findIndex(m => m.id === id);

        if (index === -1) {
            throw new Error('邮箱不存在');
        }

        allMailboxes.splice(index, 1);
        await this._writeMailboxesLegacy(allMailboxes);
        return { message: '邮箱永久删除成功' };
    }

    /**
     * 获取邮箱统计信息
     */
    async getStatistics() {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const all = await db.select().from(mailboxes);
            const active = all.filter(m => m.isActive);
            return {
                total: all.length,
                active: active.length,
                inactive: all.length - active.length,
            };
        }

        const allMailboxes = await this._readMailboxesLegacy();
        return {
            total: allMailboxes.length,
            active: allMailboxes.filter(m => m.is_active !== false).length,
            inactive: allMailboxes.filter(m => m.is_active === false).length,
        };
    }

    /**
     * 按来源校验邮箱，外部 API 返回 500 时视为失效并软删除
     * @param {string[]} ids 可选，仅校验指定ID
     * @param {string|null} source 指定来源（如 'purchase'）；为 null 时校验所有来源
     * @param {number} concurrency 并发数，默认 10
     */
    async validateMailboxesBySource(ids = [], source = 'purchase', concurrency = 10) {
        // 获取目标邮箱
        const allMailboxes = await this.getAllMailboxes();
        const target = allMailboxes.filter(m => {
            if (source && m.source !== source) return false;
            if (ids.length > 0 && !ids.includes(m.id)) return false;
            return true;
        });

        let checked = 0;
        let removed = 0;
        const removedEmails = [];
        const removedIds = [];
        const errors = [];

        // 并发检测函数
        const checkMailbox = async (mailbox) => {
            try {
                await require('./proxy.service').getMailboxEmails(mailbox, 'inbox');
                return { status: 'valid', mailbox };
            } catch (err) {
                const status = err.status || (err.message && err.message.includes('HTTP 500') ? 500 : null);
                if (status === 500) {
                    return { status: 'invalid', mailbox };
                } else {
                    return { status: 'error', mailbox, error: err.message };
                }
            }
        };

        // 分批并发处理
        for (let i = 0; i < target.length; i += concurrency) {
            const batch = target.slice(i, i + concurrency);
            const results = await Promise.all(batch.map(checkMailbox));

            for (const result of results) {
                if (result.status === 'valid') {
                    checked++;
                } else if (result.status === 'invalid') {
                    removedIds.push(result.mailbox.id);
                    removedEmails.push(result.mailbox.email);
                    removed++;
                } else if (result.status === 'error') {
                    errors.push({ email: result.mailbox.email, error: result.error });
                }
            }
        }

        // 批量软删除所有失效的邮箱
        if (removedIds.length > 0) {
            await this.deleteMailboxesBatch(removedIds);
        }

        // 返回剩余的活跃邮箱
        const remaining = await this.getAllMailboxes();

        return {
            checked,
            removed,
            removedEmails,
            errors,
            data: remaining,
        };
    }

    // ============================================================
    // 兼容旧 API（用于测试和迁移）
    // ============================================================

    /**
     * 读取邮箱列表（兼容旧 API）
     * @deprecated 使用 getAllMailboxes() 替代
     */
    async readMailboxes() {
        if (this.storageMode === 'postgres') {
            const db = getDb();
            const rows = await db.select().from(mailboxes);
            return rows.map(row => this._dbRowToJson(row));
        }
        return this._readMailboxesLegacy();
    }

    /**
     * 写入邮箱列表（兼容旧 API，仅用于测试）
     * @deprecated 使用具体的 CRUD 方法替代
     */
    async writeMailboxes(data) {
        if (this.storageMode === 'postgres') {
            console.warn('[MailboxService] writeMailboxes() not supported in postgres mode');
            return;
        }
        return this._writeMailboxesLegacy(data);
    }
}

// 创建单例
const mailboxService = new MailboxService();

module.exports = mailboxService;
