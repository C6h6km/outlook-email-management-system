/**
 * API 端点集成测试 - 完整覆盖版
 * 使用 Mock Blob 存储，避免污染真实数据
 */

// Mock blob-store 模块
jest.mock('../utils/blob-store', () => require('./mocks/mock-blob-store'));

const request = require('supertest');
const app = require('../app');
const mockBlobStore = require('./mocks/mock-blob-store');

describe('API Endpoints', () => {
    // 每个测试前清空 Mock 存储
    beforeEach(() => {
        mockBlobStore.clearAll();
    });

    // ==================== 健康检查 ====================
    describe('GET /api/health', () => {
        test('应该返回健康状态', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
        });
    });

    // ==================== 创建邮箱 ====================
    describe('POST /api/mailboxes', () => {
        const validMailbox = {
            email: 'test@example.com',
            password: 'pass123',
            client_id: 'client123',
            refresh_token: 'token123'
        };

        test('应该成功创建有效的邮箱', async () => {
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

        test('应该拒绝无效的邮箱格式', async () => {
            const response = await request(app)
                .post('/api/mailboxes')
                .send({ ...validMailbox, email: 'invalid-email' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('邮箱格式无效');
        });

        test('应该拒绝缺少必填字段', async () => {
            const response = await request(app)
                .post('/api/mailboxes')
                .send({ email: 'test@example.com' })
                .expect(400);

            expect(response.body.error).toContain('缺少');
        });

        test('应该拒绝超长的邮箱地址', async () => {
            const response = await request(app)
                .post('/api/mailboxes')
                .send({ ...validMailbox, email: 'a'.repeat(300) + '@example.com' })
                .expect(400);

            expect(response.body.error).toContain('过长');
        });
    });

    // ==================== 获取邮箱列表 ====================
    describe('GET /api/mailboxes', () => {
        test('应该返回空邮箱列表', async () => {
            const response = await request(app)
                .get('/api/mailboxes')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBe(0);
        });

        test('应该返回已添加的邮箱', async () => {
            // 先添加一个邮箱
            await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'list-test@example.com',
                    password: 'pass',
                    client_id: 'id',
                    refresh_token: 'token'
                });

            const response = await request(app)
                .get('/api/mailboxes')
                .expect(200);

            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].email).toBe('list-test@example.com');
        });
    });

    // ==================== 删除邮箱 ====================
    describe('DELETE /api/mailboxes/:id', () => {
        test('应该成功删除邮箱', async () => {
            // 先添加
            const addResponse = await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'delete-test@example.com',
                    password: 'pass',
                    client_id: 'id',
                    refresh_token: 'token'
                });

            const id = addResponse.body.data.id;

            // 删除
            const deleteResponse = await request(app)
                .delete(`/api/mailboxes/${id}`)
                .expect(200);

            expect(deleteResponse.body).toHaveProperty('success', true);

            // 确认不在列表中
            const listResponse = await request(app).get('/api/mailboxes');
            expect(listResponse.body.data.length).toBe(0);
        });

        test('删除不存在的邮箱应返回错误', async () => {
            const response = await request(app)
                .delete('/api/mailboxes/non-existent-id')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    // ==================== 批量添加 ====================
    describe('POST /api/mailboxes/batch', () => {
        test('应该批量添加邮箱', async () => {
            const batch = {
                mailboxes: [
                    { email: 'batch1@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
                    { email: 'batch2@example.com', password: 'p2', client_id: 'c2', refresh_token: 't2' },
                ]
            };

            const response = await request(app)
                .post('/api/mailboxes/batch')
                .send(batch)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.added).toBe(2);
        });

        test('应该跳过重复的邮箱', async () => {
            // 先添加一个
            await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'existing@example.com',
                    password: 'p',
                    client_id: 'c',
                    refresh_token: 't'
                });

            const batch = {
                mailboxes: [
                    { email: 'existing@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
                    { email: 'new@example.com', password: 'p2', client_id: 'c2', refresh_token: 't2' },
                ]
            };

            const response = await request(app)
                .post('/api/mailboxes/batch')
                .send(batch)
                .expect(201);

            expect(response.body.added).toBe(1);
            expect(response.body.skipped).toBe(1);
        });
    });

    // ==================== 批量删除 ====================
    describe('POST /api/mailboxes/batch-delete', () => {
        test('应该批量删除邮箱', async () => {
            // 添加两个
            const batch = {
                mailboxes: [
                    { email: 'del1@example.com', password: 'p1', client_id: 'c1', refresh_token: 't1' },
                    { email: 'del2@example.com', password: 'p2', client_id: 'c2', refresh_token: 't2' },
                ]
            };

            const addResponse = await request(app)
                .post('/api/mailboxes/batch')
                .send(batch);

            const ids = addResponse.body.data.map(m => m.id);

            // 批量删除
            const deleteResponse = await request(app)
                .post('/api/mailboxes/batch-delete')
                .send({ ids })
                .expect(200);

            expect(deleteResponse.body).toHaveProperty('success', true);
            expect(deleteResponse.body.deleted).toBe(2);

            // 确认列表为空
            const listResponse = await request(app).get('/api/mailboxes');
            expect(listResponse.body.data.length).toBe(0);
        });
    });

    // ==================== 统计接口 ====================
    describe('GET /api/mailboxes/stats/summary', () => {
        test('应该返回正确的统计信息', async () => {
            // 添加邮箱
            const addResponse = await request(app)
                .post('/api/mailboxes/batch')
                .send({
                    mailboxes: [
                        { email: 'stat1@example.com', password: 'p', client_id: 'c', refresh_token: 't' },
                        { email: 'stat2@example.com', password: 'p', client_id: 'c', refresh_token: 't' },
                    ]
                });

            // 删除一个
            const id = addResponse.body.data[0].id;
            await request(app).delete(`/api/mailboxes/${id}`);

            const response = await request(app)
                .get('/api/mailboxes/stats/summary')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.total).toBe(2);
            expect(response.body.data.active).toBe(1);
            expect(response.body.data.inactive).toBe(1);
        });
    });

    // ==================== 404 处理 ====================
    describe('404 处理', () => {
        test('不存在的路由应返回 404', async () => {
            const response = await request(app)
                .get('/api/non-existent-route')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    // ==================== 输入验证测试 ====================
    describe('输入验证', () => {
        test('应该拒绝超长的密码', async () => {
            const response = await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'test@example.com',
                    password: 'p'.repeat(1025),
                    client_id: 'id',
                    refresh_token: 'token'
                })
                .expect(400);

            expect(response.body.error).toContain('过长');
        });

        test('应该拒绝无效的邮箱格式', async () => {
            const invalidEmails = ['invalid', 'no@domain', '@nodomain.com'];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/api/mailboxes')
                    .send({
                        email,
                        password: 'pass',
                        client_id: 'id',
                        refresh_token: 'token'
                    })
                    .expect(400);

                expect(response.body.error).toContain('格式无效');
            }
        });

        test('批量添加应验证每个邮箱', async () => {
            const response = await request(app)
                .post('/api/mailboxes/batch')
                .send({
                    mailboxes: [
                        { email: 'invalid-email', password: 'p', client_id: 'c', refresh_token: 't' }
                    ]
                })
                .expect(400);

            expect(response.body.error).toContain('格式无效');
        });
    });

    // ==================== 更新邮箱 ====================
    describe('PUT /api/mailboxes/:id', () => {
        test('应该成功更新邮箱', async () => {
            // 先添加
            const addResponse = await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'update-api-test@example.com',
                    password: 'old-pass',
                    client_id: 'id',
                    refresh_token: 'token'
                });

            const id = addResponse.body.data.id;

            // 更新
            const updateResponse = await request(app)
                .put(`/api/mailboxes/${id}`)
                .send({ password: 'new-pass' })
                .expect(200);

            expect(updateResponse.body).toHaveProperty('success', true);
            expect(updateResponse.body.data.password).toBe('new-pass');
        });

        test('更新不存在的邮箱应返回 404', async () => {
            const response = await request(app)
                .put('/api/mailboxes/non-existent-id')
                .send({ password: 'new-pass' })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        test('没有更新数据应返回 400', async () => {
            // 先添加
            const addResponse = await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'update-empty@example.com',
                    password: 'pass',
                    client_id: 'id',
                    refresh_token: 'token'
                });

            const id = addResponse.body.data.id;

            const response = await request(app)
                .put(`/api/mailboxes/${id}`)
                .send({})
                .expect(400);

            expect(response.body.details).toContain('没有提供');
        });
    });

    // ==================== 数据安全测试 ====================
    describe('数据安全', () => {
        test('响应不应泄露敏感配置信息', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            // 响应不应包含敏感信息
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toContain('outlook_READ_WRITE_TOKEN');
            expect(responseText).not.toContain('BLOB_ENCRYPTION_KEY');
        });
    });

    // ==================== 边界条件 API 测试 ====================
    describe('边界条件', () => {
        test('批量删除空数组应返回错误', async () => {
            const response = await request(app)
                .post('/api/mailboxes/batch-delete')
                .send({ ids: [] })
                .expect(400);

            expect(response.body.details).toContain('缺少');
        });

        test('GET /api/mailboxes/:id 应返回正确格式', async () => {
            // 先添加
            const addResponse = await request(app)
                .post('/api/mailboxes')
                .send({
                    email: 'get-by-id@example.com',
                    password: 'pass',
                    client_id: 'id',
                    refresh_token: 'token'
                });

            const id = addResponse.body.data.id;

            const response = await request(app)
                .get(`/api/mailboxes/${id}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('email', 'get-by-id@example.com');
        });

        test('GET /api/mailboxes/:id 不存在应返回 404', async () => {
            const response = await request(app)
                .get('/api/mailboxes/non-existent-uuid')
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });
});
