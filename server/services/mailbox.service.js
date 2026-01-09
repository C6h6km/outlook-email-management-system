/**
 * 邮箱服务层 - 业务逻辑抽象
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { readJSONBlob, writeJSONBlob } = require('../utils/blob-store');

class MailboxService {
    constructor() {
        this.dataDir = config.dataDir;
        this.mailboxesFile = config.mailboxesFile;
        // 在 Blob 中使用固定键存储
        this.blobKey = process.env.BLOB_MAILBOXES_KEY || 'mailboxes/mailboxes.json';
        // 优先使用 Vercel 自动注入的环境变量，兼容自定义变量名
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.outlook_READ_WRITE_TOKEN;
        this.useBlob = !!blobToken; // 有 Token 则启用 Blob

        // 并发控制：防止同时读写导致数据覆盖
        this.writeLock = Promise.resolve();
    }

    /**
     * 获取写锁，确保写操作串行执行
     * @private
     */
    async _acquireWriteLock(operation) {
        // 等待之前的写操作完成
        const previousLock = this.writeLock;

        // 创建新的锁（当前操作完成后释放）
        let releaseLock;
        this.writeLock = new Promise(resolve => {
            releaseLock = resolve;
        });

        try {
            // 等待之前的锁释放
            await previousLock;
            // 执行当前操作
            return await operation();
        } finally {
            // 释放当前锁
            releaseLock();
        }
    }

    /**
     * 确保数据文件存在
     */
    async ensureDataFile() {
        // 如果使用 Blob 存储，无需本地文件
        if (this.useBlob) return;

        try {
            await fs.access(this.dataDir);
        } catch {
            // 在只读环境无法创建目录时，不抛出错误
            try {
                await fs.mkdir(this.dataDir, { recursive: true });
            } catch (err) {
                console.warn('无法创建数据目录，可能在只读环境:', err.message);
                return; // 跳过，后续读取时会返回空数组
            }
        }

        try {
            await fs.access(this.mailboxesFile);
        } catch {
            try {
                await fs.writeFile(this.mailboxesFile, JSON.stringify([]));
            } catch (err) {
                console.warn('无法创建数据文件，可能在只读环境:', err.message);
            }
        }
    }

    /**
     * 读取邮箱列表
     */
    async readMailboxes() {
        if (this.useBlob) {
            const data = await readJSONBlob(this.blobKey);
            return Array.isArray(data) ? data : [];
        }

        await this.ensureDataFile();

        try {
            const content = await fs.readFile(this.mailboxesFile, 'utf8');
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            // 文件不存在或解析失败时返回空数组
            console.warn('读取邮箱文件失败，返回空数组:', err.message);
            return [];
        }
    }

    /**
     * 写入邮箱列表
     */
    async writeMailboxes(mailboxes) {
        if (this.useBlob) {
            await writeJSONBlob(this.blobKey, mailboxes);
            return;
        }

        await this.ensureDataFile();

        try {
            await fs.writeFile(this.mailboxesFile, JSON.stringify(mailboxes, null, 2));
        } catch (err) {
            console.error('写入邮箱文件失败（可能在只读环境）:', err.message);
            throw new Error('无法保存邮箱数据，请配置 outlook_READ_WRITE_TOKEN 使用 Vercel Blob 存储');
        }
    }

    /**
     * 获取所有活跃邮箱
     */
    async getAllMailboxes() {
        const mailboxes = await this.readMailboxes();
        return mailboxes.filter(m => m.is_active !== false);
    }

    /**
     * 根据ID获取邮箱
     */
    async getMailboxById(id) {
        const mailboxes = await this.readMailboxes();
        return mailboxes.find(m => m.id === id);
    }

    /**
     * 根据邮箱地址获取邮箱
     */
    async getMailboxByEmail(email) {
        const mailboxes = await this.readMailboxes();
        return mailboxes.find(m => m.email === email && m.is_active !== false);
    }

    /**
     * 添加单个邮箱
     */
    async addMailbox(mailboxData) {
        return this._acquireWriteLock(async () => {
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
            if (email.length > 255) {
                throw new Error('邮箱地址过长（最大 255 字符）');
            }
            if (password.length > 1024) {
                throw new Error('密码过长（最大 1024 字符）');
            }
            if (client_id.length > 255) {
                throw new Error('客户端 ID 过长（最大 255 字符）');
            }
            if (refresh_token.length > 2048) {
                throw new Error('刷新令牌过长（最大 2048 字符）');
            }

            const mailboxes = await this.readMailboxes();
            const existing = mailboxes.find(m => m.email === email);

            if (existing && existing.is_active !== false) {
                throw new Error('邮箱已存在');
            }

            const now = new Date().toISOString();
            let mailbox;

            if (existing && existing.is_active === false) {
                // 重新激活已存在但被删除的邮箱
                existing.password = password;
                existing.client_id = client_id;
                existing.refresh_token = refresh_token;
                existing.is_active = true;
                existing.updated_at = now;
                existing.source = existing.source || source;
                mailbox = existing;
            } else {
                // 创建新邮箱
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
                mailboxes.push(mailbox);
            }

            await this.writeMailboxes(mailboxes);
            return mailbox;
        });
    }

    /**
     * 批量添加邮箱
     */
    async addMailboxesBatch(mailboxesData) {
        return this._acquireWriteLock(async () => {
            if (!Array.isArray(mailboxesData) || mailboxesData.length === 0) {
                throw new Error('邮箱数据格式错误');
            }

            // 验证每个邮箱的数据完整性
            for (const mailbox of mailboxesData) {
                if (!mailbox.email || !mailbox.password || !mailbox.client_id || !mailbox.refresh_token) {
                    throw new Error('邮箱配置信息不完整');
                }
            }

            const existingMailboxes = await this.readMailboxes();
            const now = new Date().toISOString();

            const emailMap = new Map(existingMailboxes.map(m => [m.email, m]));

            const added = [];
            const reactivated = [];
            const skipped = [];

            for (const mailboxData of mailboxesData) {
                const current = emailMap.get(mailboxData.email);
                const source = mailboxData.source || 'manual';

                if (!current) {
                    // 新邮箱
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
                    // 重新激活
                    current.password = mailboxData.password;
                    current.client_id = mailboxData.client_id;
                    current.refresh_token = mailboxData.refresh_token;
                    current.is_active = true;
                    current.updated_at = now;
                    current.source = current.source || source;
                    reactivated.push(current);
                } else {
                    // 跳过已存在的
                    skipped.push(mailboxData.email);
                }
            }

            await this.writeMailboxes(existingMailboxes);

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
        return this._acquireWriteLock(async () => {
            const { email, password, client_id, refresh_token } = updateData;

            const data = {};
            if (email) data.email = email;
            if (password) data.password = password;
            if (client_id) data.client_id = client_id;
            if (refresh_token) data.refresh_token = refresh_token;

            if (Object.keys(data).length === 0) {
                throw new Error('没有提供要更新的数据');
            }

            const mailboxes = await this.readMailboxes();
            const mailbox = mailboxes.find(m => m.id === id);

            if (!mailbox) {
                throw new Error('邮箱不存在');
            }

            Object.assign(mailbox, data, { updated_at: new Date().toISOString() });

            await this.writeMailboxes(mailboxes);
            return mailbox;
        });
    }

    /**
     * 删除邮箱（软删除）
     */
    async deleteMailbox(id) {
        return this._acquireWriteLock(async () => {
            const mailboxes = await this.readMailboxes();
            const mailbox = mailboxes.find(m => m.id === id);

            if (!mailbox) {
                throw new Error('邮箱不存在');
            }

            mailbox.is_active = false;
            mailbox.updated_at = new Date().toISOString();

            await this.writeMailboxes(mailboxes);
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

        return this._acquireWriteLock(async () => {
            const mailboxes = await this.readMailboxes();
            let deleted = 0;

            const now = new Date().toISOString();

            for (const id of ids) {
                const mailbox = mailboxes.find(m => m.id === id);
                if (mailbox && mailbox.is_active !== false) {
                    mailbox.is_active = false;
                    mailbox.updated_at = now;
                    deleted++;
                }
            }

            await this.writeMailboxes(mailboxes);

            return {
                message: '批量删除完成',
                deleted,
                total: ids.length
            };
        });
    }

    /**
     * 永久删除邮箱（物理删除）
     */
    async permanentlyDeleteMailbox(id) {
        const mailboxes = await this.readMailboxes();
        const index = mailboxes.findIndex(m => m.id === id);

        if (index === -1) {
            throw new Error('邮箱不存在');
        }

        mailboxes.splice(index, 1);
        await this.writeMailboxes(mailboxes);

        return { message: '邮箱永久删除成功' };
    }

    /**
     * 获取邮箱统计信息
     */
    async getStatistics() {
        const mailboxes = await this.readMailboxes();

        return {
            total: mailboxes.length,
            active: mailboxes.filter(m => m.is_active !== false).length,
            inactive: mailboxes.filter(m => m.is_active === false).length,
        };
    }

    /**
     * 按来源校验邮箱，外部 API 返回 500 时视为失效并软删除
     * @param {string[]} ids 可选，仅校验指定ID
     * @param {string|null} source 指定来源（如 'purchase'）；为 null 时校验所有来源
     * @param {number} concurrency 并发数，默认 10
     */
    async validateMailboxesBySource(ids = [], source = 'purchase', concurrency = 10) {
        return this._acquireWriteLock(async () => {
            const mailboxes = await this.readMailboxes();
            const activeMailboxes = mailboxes.filter(m => m.is_active !== false);

            const target = activeMailboxes.filter(m => {
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
                const now = new Date().toISOString();
                for (const id of removedIds) {
                    const mailbox = mailboxes.find(m => m.id === id);
                    if (mailbox) {
                        mailbox.is_active = false;
                        mailbox.updated_at = now;
                    }
                }
                await this.writeMailboxes(mailboxes);
            }

            // 返回剩余的活跃邮箱
            const remaining = mailboxes.filter(m => m.is_active !== false);

            return {
                checked,
                removed,
                removedEmails,
                errors,
                data: remaining,
            };
        });
    }
}

// 创建单例
const mailboxService = new MailboxService();

module.exports = mailboxService;



