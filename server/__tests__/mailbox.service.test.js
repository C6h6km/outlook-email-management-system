/**
 * 邮箱服务测试
 */

const mailboxService = require('../services/mailbox.service');

describe('MailboxService', () => {
    describe('addMailbox', () => {
        test('应该拒绝无效的邮箱格式', async () => {
            const invalidMailbox = {
                email: 'invalid-email',  // 无效格式
                password: 'pass123',
                client_id: 'client123',
                refresh_token: 'token123'
            };

            await expect(mailboxService.addMailbox(invalidMailbox))
                .rejects.toThrow('邮箱格式无效');
        });

        test('应该拒绝缺少必填字段的邮箱', async () => {
            const incompleteMailbox = {
                email: 'test@example.com',
                // 缺少 password
                client_id: 'client123',
                refresh_token: 'token123'
            };

            await expect(mailboxService.addMailbox(incompleteMailbox))
                .rejects.toThrow('缺少必要的邮箱配置信息');
        });

        test('应该拒绝超长的字段', async () => {
            const longEmailMailbox = {
                email: 'a'.repeat(300) + '@example.com',  // 超过 255 字符
                password: 'pass123',
                client_id: 'client123',
                refresh_token: 'token123'
            };

            await expect(mailboxService.addMailbox(longEmailMailbox))
                .rejects.toThrow('邮箱地址过长');
        });

        test('应该接受有效的邮箱', async () => {
            const validMailbox = {
                email: `test${Date.now()}@example.com`,  // 使用时间戳避免重复
                password: 'pass123',
                client_id: 'client123',
                refresh_token: 'token123'
            };

            // 注意：这个测试会实际写入数据，需要清理
            // 实际项目中应该 mock 数据层
            const result = await mailboxService.addMailbox(validMailbox);
            expect(result).toHaveProperty('id');
            expect(result.email).toBe(validMailbox.email);
        });
    });

    describe('validateMailbox', () => {
        test('应该验证邮箱格式', () => {
            const testCases = [
                { email: 'test@example.com', valid: true },
                { email: 'invalid', valid: false },
                { email: 'no@domain', valid: false },
                { email: '@nodomain.com', valid: false },
                { email: 'user@sub.domain.com', valid: true },
            ];

            testCases.forEach(({ email, valid }) => {
                const mailbox = {
                    email,
                    password: 'pass',
                    client_id: 'id',
                    refresh_token: 'token'
                };

                if (valid) {
                    expect(() => mailboxService.addMailbox(mailbox)).not.toThrow('邮箱格式无效');
                } else {
                    expect(() => mailboxService.addMailbox(mailbox)).rejects.toThrow();
                }
            });
        });
    });
});
