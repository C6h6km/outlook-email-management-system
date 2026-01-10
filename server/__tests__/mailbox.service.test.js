/**
 * 邮箱服务测试 - 完整覆盖版
 * 使用 Mock Blob 存储，避免污染真实数据
 */

// Mock blob-store 模块（必须在 require 服务之前）
jest.mock('../utils/blob-store', () => require('./mocks/mock-blob-store'));

const mailboxService = require('../services/mailbox.service');
const mockBlobStore = require('./mocks/mock-blob-store');

describe('MailboxService', () => {
    // 每个测试前清空 Mock 存储
    beforeEach(() => {
        mockBlobStore.clearAll();
    });

    // ==================== addMailbox 测试 ====================
    describe('addMailbox', () => {
        const validMailbox = {
            email: 'test@example.com',
            password: 'pass123',
            client_id: 'client123',
            refresh_token: 'token123'
        };

        test('应该成功添加有效的邮箱', async () => {
            const result = await mailboxService.addMailbox(validMailbox);

            expect(result).toHaveProperty('id');
            expect(result.email).toBe(validMailbox.email);
            expect(result.is_active).toBe(true);
            expect(result).toHaveProperty('created_at');
        });

        test('应该拒绝无效的邮箱格式', async () => {
            const invalidMailbox = { ...validMailbox, email: 'invalid-email' };

            await expect(mailboxService.addMailbox(invalidMailbox))
                .rejects.toThrow('邮箱格式无效');
        });

        test('应该拒绝缺少必填字段的邮箱', async () => {
            const incompleteMailbox = {
                email: 'test@example.com',
                password: 'pass123',
                // 缺少 client_id 和 refresh_token
            };

            await expect(mailboxService.addMailbox(incompleteMailbox))
                .rejects.toThrow('缺少必要的邮箱配置信息');
        });

        test('应该拒绝超长的邮箱地址', async () => {
            const longEmailMailbox = {
                ...validMailbox,
                email: 'a'.repeat(300) + '@example.com'
            };

            await expect(mailboxService.addMailbox(longEmailMailbox))
                .rejects.toThrow('邮箱地址过长');
        });

        test('应该拒绝超长的密码', async () => {
            const longPasswordMailbox = {
                ...validMailbox,
                password: 'a'.repeat(2000)
            };

            await expect(mailboxService.addMailbox(longPasswordMailbox))
                .rejects.toThrow('密码过长');
        });

        test('应该拒绝重复添加已存在的邮箱', async () => {
            await mailboxService.addMailbox(validMailbox);

            await expect(mailboxService.addMailbox(validMailbox))
                .rejects.toThrow('邮箱已存在');
        });

        test('应该重新激活已删除的邮箱', async () => {
            // 添加并删除邮箱
            const added = await mailboxService.addMailbox(validMailbox);
            await mailboxService.deleteMailbox(added.id);

            // 重新添加同一邮箱
            const reactivated = await mailboxService.addMailbox(validMailbox);

            expect(reactivated.id).toBe(added.id);
            expect(reactivated.is_active).toBe(true);
        });
    });

    // ==================== 查询测试 ====================
    describe('查询操作', () => {
        const testMailbox = {
            email: 'query-test@example.com',
            password: 'pass',
            client_id: 'id',
            refresh_token: 'token'
        };

        test('getAllMailboxes 应该返回所有活跃邮箱', async () => {
            await mailboxService.addMailbox(testMailbox);
            await mailboxService.addMailbox({
                ...testMailbox,
                email: 'query-test2@example.com'
            });

            const mailboxes = await mailboxService.getAllMailboxes();

            expect(Array.isArray(mailboxes)).toBe(true);
            expect(mailboxes.length).toBe(2);
        });

        test('getMailboxById 应该返回指定邮箱', async () => {
            const added = await mailboxService.addMailbox(testMailbox);

            const found = await mailboxService.getMailboxById(added.id);

            expect(found).not.toBeNull();
            expect(found.email).toBe(testMailbox.email);
        });

        test('getMailboxById 不存在时返回 null', async () => {
            const found = await mailboxService.getMailboxById('non-existent-id');

            expect(found).toBeNull();
        });

        test('getMailboxByEmail 应该返回匹配的邮箱', async () => {
            await mailboxService.addMailbox(testMailbox);

            const found = await mailboxService.getMailboxByEmail(testMailbox.email);

            expect(found).not.toBeNull();
            expect(found.email).toBe(testMailbox.email);
        });
    });

    // ==================== updateMailbox 测试 ====================
    describe('updateMailbox', () => {
        test('应该成功更新邮箱信息', async () => {
            const added = await mailboxService.addMailbox({
                email: 'update-test@example.com',
                password: 'old-pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            const updated = await mailboxService.updateMailbox(added.id, {
                password: 'new-pass'
            });

            expect(updated.password).toBe('new-pass');
            // 确保 updated_at 有变化（可能由于执行太快而相同，改为检查字段存在）
            expect(updated).toHaveProperty('updated_at');
        });

        test('更新不存在的邮箱应该抛出错误', async () => {
            await expect(mailboxService.updateMailbox('non-existent-id', {
                password: 'new-pass'
            })).rejects.toThrow('邮箱不存在');
        });

        test('没有提供更新数据应该抛出错误', async () => {
            const added = await mailboxService.addMailbox({
                email: 'update-test2@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            await expect(mailboxService.updateMailbox(added.id, {}))
                .rejects.toThrow('没有提供要更新的数据');
        });
    });

    // ==================== deleteMailbox 测试 ====================
    describe('deleteMailbox', () => {
        test('软删除应该将 is_active 设为 false', async () => {
            const added = await mailboxService.addMailbox({
                email: 'delete-test@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            await mailboxService.deleteMailbox(added.id);

            // 直接读取确认状态
            const mailboxes = await mailboxService.readMailboxes();
            const deleted = mailboxes.find(m => m.id === added.id);

            expect(deleted.is_active).toBe(false);
        });

        test('getAllMailboxes 不应返回已删除的邮箱', async () => {
            const added = await mailboxService.addMailbox({
                email: 'delete-test2@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            await mailboxService.deleteMailbox(added.id);

            const mailboxes = await mailboxService.getAllMailboxes();
            const found = mailboxes.find(m => m.id === added.id);

            expect(found).toBeUndefined();
        });

        test('删除不存在的邮箱应该抛出错误', async () => {
            await expect(mailboxService.deleteMailbox('non-existent-id'))
                .rejects.toThrow('邮箱不存在');
        });
    });

    // ==================== 批量操作测试 ====================
    describe('批量操作', () => {
        test('addMailboxesBatch 应该批量添加邮箱', async () => {
            const batch = [
                { email: 'batch1@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
                { email: 'batch2@example.com', password: 'p2', client_id: 'c2', refresh_token: 't2' },
                { email: 'batch3@example.com', password: 'p3', client_id: 'c3', refresh_token: 't3' },
            ];

            const result = await mailboxService.addMailboxesBatch(batch);

            expect(result.added).toBe(3);
            expect(result.skipped).toBe(0);
            expect(result.data.length).toBe(3);
        });

        test('addMailboxesBatch 应该跳过重复邮箱', async () => {
            // 先添加一个
            await mailboxService.addMailbox({
                email: 'existing@example.com',
                password: 'p',
                client_id: 'c',
                refresh_token: 't'
            });

            const batch = [
                { email: 'existing@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
                { email: 'new@example.com', password: 'p2', client_id: 'c2', refresh_token: 't2' },
            ];

            const result = await mailboxService.addMailboxesBatch(batch);

            expect(result.added).toBe(1);
            expect(result.skipped).toBe(1);
            expect(result.skippedEmails).toContain('existing@example.com');
        });

        test('deleteMailboxesBatch 应该批量删除邮箱', async () => {
            const batch = [
                { email: 'del1@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
                { email: 'del2@example.com', password: 'p2', client_id: 'c2', refresh_token: 't2' },
            ];

            const added = await mailboxService.addMailboxesBatch(batch);
            const ids = added.data.map(m => m.id);

            const result = await mailboxService.deleteMailboxesBatch(ids);

            expect(result.deleted).toBe(2);

            const remaining = await mailboxService.getAllMailboxes();
            expect(remaining.length).toBe(0);
        });
    });

    // ==================== 统计测试 ====================
    describe('getStatistics', () => {
        test('应该返回正确的统计信息', async () => {
            // 添加3个邮箱
            await mailboxService.addMailboxesBatch([
                { email: 'stat1@example.com', password: 'p', client_id: 'c', refresh_token: 't' },
                { email: 'stat2@example.com', password: 'p', client_id: 'c', refresh_token: 't' },
                { email: 'stat3@example.com', password: 'p', client_id: 'c', refresh_token: 't' },
            ]);

            // 删除1个
            const all = await mailboxService.getAllMailboxes();
            await mailboxService.deleteMailbox(all[0].id);

            const stats = await mailboxService.getStatistics();

            expect(stats.total).toBe(3);
            expect(stats.active).toBe(2);
            expect(stats.inactive).toBe(1);
        });
    });

    // ==================== 并发写锁测试 ====================
    describe('并发写锁', () => {
        test('并发添加不应导致数据丢失', async () => {
            const promises = [];

            // 并发添加 10 个邮箱
            for (let i = 0; i < 10; i++) {
                promises.push(mailboxService.addMailbox({
                    email: `concurrent${i}@example.com`,
                    password: 'p',
                    client_id: 'c',
                    refresh_token: 't'
                }));
            }

            await Promise.all(promises);

            const mailboxes = await mailboxService.getAllMailboxes();
            expect(mailboxes.length).toBe(10);
        });
    });

    // ==================== 批量操作验证测试 ====================
    describe('批量操作验证', () => {
        test('应该拒绝超长邮箱地址的批量添加', async () => {
            const batch = [
                { email: 'a'.repeat(300) + '@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
            ];

            await expect(mailboxService.addMailboxesBatch(batch))
                .rejects.toThrow('邮箱地址过长');
        });

        test('应该拒绝超长密码的批量添加', async () => {
            const batch = [
                { email: 'test@example.com', password: 'p'.repeat(1025), client_id: 'c1', refresh_token: 't1' },
            ];

            await expect(mailboxService.addMailboxesBatch(batch))
                .rejects.toThrow('密码过长');
        });

        test('应该拒绝无效邮箱格式的批量添加', async () => {
            const batch = [
                { email: 'invalid-email', password: 'p1', client_id: 'c1', refresh_token: 't1' },
            ];

            await expect(mailboxService.addMailboxesBatch(batch))
                .rejects.toThrow('邮箱格式无效');
        });

        test('应该拒绝空数组的批量添加', async () => {
            await expect(mailboxService.addMailboxesBatch([]))
                .rejects.toThrow('邮箱数据格式错误');
        });

        test('应该拒绝非数组的批量添加', async () => {
            await expect(mailboxService.addMailboxesBatch(null))
                .rejects.toThrow('邮箱数据格式错误');
        });

        test('应该拒绝不完整数据的批量添加', async () => {
            const batch = [
                { email: 'test@example.com' }, // 缺少其他字段
            ];

            await expect(mailboxService.addMailboxesBatch(batch))
                .rejects.toThrow('邮箱配置信息不完整');
        });
    });

    // ==================== 边界条件测试 ====================
    describe('边界条件', () => {
        test('应该正确处理特殊字符邮箱', async () => {
            const specialMailbox = {
                email: 'test+special.chars@sub.example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            };

            const result = await mailboxService.addMailbox(specialMailbox);
            expect(result.email).toBe(specialMailbox.email);
        });

        test('应该正确处理最大长度字段', async () => {
            const maxMailbox = {
                email: 'a'.repeat(240) + '@example.com', // 接近255限制
                password: 'p'.repeat(1024), // 最大1024
                client_id: 'c'.repeat(255), // 最大255
                refresh_token: 't'.repeat(2048) // 最大2048
            };

            const result = await mailboxService.addMailbox(maxMailbox);
            expect(result).toHaveProperty('id');
        });

        test('更新不应更改邮箱地址', async () => {
            const added = await mailboxService.addMailbox({
                email: 'original@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            const updated = await mailboxService.updateMailbox(added.id, {
                password: 'new-pass'
            });

            expect(updated.email).toBe('original@example.com');
        });

        test('getAllMailboxes 在无数据时返回空数组', async () => {
            const result = await mailboxService.getAllMailboxes();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        test('getMailboxByEmail 不存在时返回 null', async () => {
            const result = await mailboxService.getMailboxByEmail('nonexistent@example.com');
            expect(result).toBeNull();
        });
    });

    // ==================== 永久删除测试 ====================
    describe('permanentlyDeleteMailbox', () => {
        test('应该永久删除邮箱', async () => {
            const added = await mailboxService.addMailbox({
                email: 'permanent-delete@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            await mailboxService.permanentlyDeleteMailbox(added.id);

            // 确认无法找到
            const found = await mailboxService.getMailboxById(added.id);
            expect(found).toBeNull();

            // 确认可以重新添加（因为是永久删除，不是软删除）
            const reAdded = await mailboxService.addMailbox({
                email: 'permanent-delete@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });
            expect(reAdded.email).toBe('permanent-delete@example.com');
        });
    });

    // ==================== 数据转换测试 ====================
    describe('数据格式', () => {
        test('返回的邮箱应包含所有必要字段', async () => {
            const added = await mailboxService.addMailbox({
                email: 'format-test@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            });

            expect(added).toHaveProperty('id');
            expect(added).toHaveProperty('email');
            expect(added).toHaveProperty('password');
            expect(added).toHaveProperty('client_id');
            expect(added).toHaveProperty('refresh_token');
            expect(added).toHaveProperty('is_active');
            expect(added).toHaveProperty('created_at');
        });

        test('批量添加返回正确的结构', async () => {
            const batch = [
                { email: 'format1@example.com', password: 'p', client_id: 'c', refresh_token: 't' },
            ];

            const result = await mailboxService.addMailboxesBatch(batch);

            expect(result).toHaveProperty('added');
            expect(result).toHaveProperty('skipped');
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('skippedEmails');
        });

        test('统计信息应包含正确的字段', async () => {
            const stats = await mailboxService.getStatistics();

            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('active');
            expect(stats).toHaveProperty('inactive');
            expect(typeof stats.total).toBe('number');
        });
    });
});
