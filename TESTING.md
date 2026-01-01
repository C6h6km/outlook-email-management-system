# 测试指南

本项目使用 Jest 和 Supertest 进行单元测试和集成测试。

## 🧪 测试套件

### 已实现的测试

1. **单元测试**
   - 邮箱服务测试（`server/__tests__/mailbox.service.test.js`）
     - 邮箱格式验证
     - 必填字段验证
     - 字段长度验证
     - 有效邮箱创建

2. **集成测试**
   - API 端点测试（`server/__tests__/api.integration.test.js`）
     - 健康检查端点
     - 邮箱 CRUD 操作
     - CORS 安全性
     - 输入验证

## 📋 运行测试

### 运行所有测试
```bash
npm test
```

### 运行测试并生成覆盖率报告
```bash
npm run test:coverage
```

### 监视模式（开发时使用）
```bash
npm run test:watch
```

## 📊 测试覆盖率

测试覆盖率报告会生成在 `coverage/` 目录下。

查看覆盖率报告：
```bash
# 生成报告
npm run test:coverage

# 在浏览器中查看详细报告
open coverage/lcov-report/index.html  # Mac
start coverage/lcov-report/index.html  # Windows
```

## ✅ 测试最佳实践

### 1. 测试文件命名
- 单元测试：`*.test.js`
- 集成测试：`*.integration.test.js`
- 放在 `__tests__/` 目录或与源文件同目录

### 2. 测试结构
```javascript
describe('功能模块', () => {
    describe('具体功能', () => {
        test('应该...', () => {
            // Arrange: 准备测试数据
            const input = { ... };

            // Act: 执行被测试的功能
            const result = functionUnderTest(input);

            // Assert: 验证结果
            expect(result).toBe(expected);
        });
    });
});
```

### 3. 异步测试
```javascript
test('异步操作应该...', async () => {
    const result = await asyncFunction();
    expect(result).toHaveProperty('id');
});
```

### 4. 错误测试
```javascript
test('应该抛出错误', async () => {
    await expect(functionThatThrows())
        .rejects.toThrow('错误消息');
});
```

## 🎯 测试清单

### 单元测试
- [x] 邮箱格式验证
- [x] 必填字段验证
- [x] 字段长度验证
- [ ] 邮箱重复检测
- [ ] 邮箱更新逻辑
- [ ] 邮箱删除逻辑

### 集成测试
- [x] GET /api/health
- [x] POST /api/mailboxes
- [x] GET /api/mailboxes
- [x] GET /api/mailboxes/stats/summary
- [ ] PUT /api/mailboxes/:id
- [ ] DELETE /api/mailboxes/:id
- [ ] POST /api/mailboxes/batch
- [x] CORS 安全测试
- [x] 输入验证测试

### 安全测试
- [x] CORS 配置
- [x] 输入验证（超长字段）
- [ ] XSS 防护
- [ ] SQL 注入防护（如使用数据库）
- [ ] 速率限制

## 🔧 配置

### Jest 配置（`jest.config.js`）
```javascript
module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/**/*.test.js',
        '!server/**/__tests__/**',
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/*.test.js'
    ],
    verbose: true,
    testTimeout: 10000,
};
```

## 📝 编写新测试

### 示例：添加邮箱更新测试

1. 在 `server/__tests__/mailbox.service.test.js` 添加：
```javascript
describe('updateMailbox', () => {
    test('应该成功更新邮箱', async () => {
        const updated = await mailboxService.updateMailbox('id123', {
            password: 'newpass'
        });
        expect(updated.password).toBe('newpass');
    });
});
```

2. 在 `server/__tests__/api.integration.test.js` 添加：
```javascript
describe('PUT /api/mailboxes/:id', () => {
    test('应该更新邮箱', async () => {
        const response = await request(app)
            .put('/api/mailboxes/id123')
            .send({ password: 'newpass' })
            .expect(200);

        expect(response.body.password).toBe('newpass');
    });
});
```

## 🐛 调试测试

### 运行单个测试文件
```bash
npm test -- mailbox.service.test.js
```

### 运行匹配特定名称的测试
```bash
npm test -- -t "应该拒绝无效的邮箱格式"
```

### 查看详细输出
```bash
npm test -- --verbose
```

## 📚 参考资料

- [Jest 官方文档](https://jestjs.io/)
- [Supertest 文档](https://github.com/visionmedia/supertest)
- [测试最佳实践](https://testingjavascript.com/)

---

**提示**: 在提交代码前运行 `npm run test:coverage` 确保测试通过且覆盖率达标。
