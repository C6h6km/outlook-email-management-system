/**
 * API 端点集成测试
 */

const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
    describe('GET /api/health', () => {
        test('应该返回健康状态', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
        });
    });

    describe('POST /api/mailboxes', () => {
        test('应该拒绝无效的邮箱格式', async () => {
            const invalidMailbox = {
                email: 'invalid-email',
                password: 'pass123',
                client_id: 'client123',
                refresh_token: 'token123'
            };

            const response = await request(app)
                .post('/api/mailboxes')
                .send(invalidMailbox)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('邮箱格式无效');
        });

        test('应该拒绝缺少必填字段', async () => {
            const incompleteMailbox = {
                email: 'test@example.com',
                // 缺少 password
            };

            const response = await request(app)
                .post('/api/mailboxes')
                .send(incompleteMailbox)
                .expect(400);

            expect(response.body.error).toContain('缺少');
        });

        test('应该成功创建有效的邮箱', async () => {
            const validMailbox = {
                email: `test${Date.now()}@example.com`,  // 避免重复
                password: 'pass123',
                client_id: 'client123',
                refresh_token: 'token123'
            };

            const response = await request(app)
                .post('/api/mailboxes')
                .send(validMailbox)
                .expect('Content-Type', /json/)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.email).toBe(validMailbox.email);
        });
    });

    describe('GET /api/mailboxes', () => {
        test('应该返回邮箱列表', async () => {
            const response = await request(app)
                .get('/api/mailboxes')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('GET /api/mailboxes/stats/summary', () => {
        test('应该返回统计摘要', async () => {
            const response = await request(app)
                .get('/api/mailboxes/stats/summary')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('total');
            expect(response.body.data).toHaveProperty('active');
        });
    });

    describe('CORS 安全测试', () => {
        test('应该拒绝未授权的来源', async () => {
            const response = await request(app)
                .get('/api/health')
                .set('Origin', 'https://evil.com')
                .expect(200);

            // CORS 头不应包含 evil.com
            expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.com');
        });
    });

    describe('输入验证测试', () => {
        test('应该拒绝超长的邮箱地址', async () => {
            const mailboxWithLongEmail = {
                email: 'a'.repeat(300) + '@example.com',
                password: 'pass',
                client_id: 'id',
                refresh_token: 'token'
            };

            const response = await request(app)
                .post('/api/mailboxes')
                .send(mailboxWithLongEmail)
                .expect(400);

            expect(response.body.error).toContain('过长');
        });

        test('应该拒绝超长的密码', async () => {
            const mailboxWithLongPassword = {
                email: 'test@example.com',
                password: 'a'.repeat(2000),
                client_id: 'id',
                refresh_token: 'token'
            };

            const response = await request(app)
                .post('/api/mailboxes')
                .send(mailboxWithLongPassword)
                .expect(400);

            expect(response.body.error).toContain('过长');
        });
    });
});
