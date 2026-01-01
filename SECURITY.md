# 安全配置指南

本文档说明项目的安全配置和部署最佳实践。

## 🔐 安全改进总结

本项目已实施以下安全加固措施：

### 已修复的安全问题

✅ **CORS 配置加固** - 移除通配符，默认拒绝未授权来源
✅ **XSS 防护** - 使用 `textContent` 替代 `innerHTML`
✅ **输入验证** - 邮箱格式、字段长度验证
✅ **API 密钥保护** - 前端移除硬编码密钥，由后端管理
✅ **邮件 API 安全** - 密码从前端移除，改为后端代理调用
✅ **CSP 策略** - 移除 `connect-src` 通配符
✅ **Blob 加密** - 支持 AES-256-GCM 加密存储
✅ **HTTP 状态检查** - Proxy 服务检查 HTTP 响应状态和 Content-Type

---

## 📋 环境变量配置

### 必需的环境变量

在 Vercel 后台配置以下环境变量：

#### 1. 数据存储（Vercel Blob）

```bash
# Vercel Blob 读写令牌（必需）
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# 可选：Blob 加密密钥（强烈推荐）
# 生成方法：node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
BLOB_ENCRYPTION_KEY=your-32-byte-key-in-base64
```

#### 2. CORS 白名单

```bash
# 允许的来源（生产环境必须配置）
# 支持通配符子域名，如 *.vercel.app
ALLOWED_ORIGINS=*.vercel.app,https://your-domain.com
```

#### 3. 采购 API 凭证

```bash
# 采购 API 的应用 ID 和密钥
PURCHASE_APP_ID=1097
PURCHASE_APP_KEY=A2380737CA36CC61
```

#### 4. 外部邮件 API 配置（必需）

```bash
# 邮件 API 基础 URL
EXTERNAL_MAIL_API_URL=https://api.1181180.xyz/api

# 邮件 API 密码（如果外部 API 需要密码验证）
EXTERNAL_MAIL_API_PASSWORD=your-mail-api-password
```

⚠️ **安全改进**：邮件 API 的密码现已从前端移除，统一由后端从环境变量读取。这防止了：
- 密码暴露在浏览器 localStorage
- 密码出现在 URL 查询参数中（被日志记录）
- 前端代码泄露 API 凭证

#### 5. 运行环境

```bash
# 环境标识（production 或 development）
NODE_ENV=production
```

### 可选的环境变量

```bash
# 数据目录（本地开发）
DATA_DIR=./data

# 日志级别
LOG_LEVEL=info

# 速率限制配置
RATE_LIMIT_WINDOW_MS=900000  # 15 分钟
RATE_LIMIT_MAX=100            # 最大请求数
```

---

## 🚀 Vercel 部署步骤

### 1. 首次部署

1. 连接 GitHub 仓库到 Vercel
2. 选择项目根目录
3. 配置环境变量（见上文）
4. 点击"Deploy"

### 2. 配置 Blob 存储

```bash
# 在 Vercel 项目设置中启用 Blob
# 自动生成 BLOB_READ_WRITE_TOKEN
# 或手动创建：https://vercel.com/dashboard/stores
```

### 3. 启用加密存储（推荐）

```bash
# 生成 32 字节加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 输出示例：kPz8vX+9fJ2qR7xN... (44个字符)
# 将输出添加到 Vercel 环境变量：
BLOB_ENCRYPTION_KEY=kPz8vX+9fJ2qR7xN...
```

### 4. 配置 CORS

```bash
# 在 Vercel 环境变量中添加：
ALLOWED_ORIGINS=*.vercel.app

# 如果有自定义域名：
ALLOWED_ORIGINS=*.vercel.app,https://yourdomain.com
```

### 5. 重新部署

添加环境变量后，触发重新部署以使配置生效。

---

## 🔒 安全最佳实践

### 1. 密钥管理

- ✅ **永远不要**将 `.env` 文件提交到 Git
- ✅ 使用 Vercel 环境变量存储敏感配置
- ✅ 定期轮换 API 密钥（每 3-6 个月）
- ✅ 为生产和开发环境使用不同的密钥

### 2. CORS 配置

- ✅ 生产环境**必须配置** `ALLOWED_ORIGINS`
- ❌ 生产环境**禁止使用**通配符 `*`
- ✅ 仅允许可信的域名
- ✅ 使用子域名通配符（如 `*.vercel.app`）

### 3. 数据加密

- ✅ 启用 Blob 加密（`BLOB_ENCRYPTION_KEY`）
- ✅ 使用强随机密钥（32 字节）
- ✅ 备份加密密钥（丢失将无法恢复数据）
- ❌ 不要在代码中硬编码加密密钥

### 4. 输入验证

- ✅ 前端和后端都进行验证
- ✅ 验证邮箱格式
- ✅ 限制字符串长度
- ✅ 过滤特殊字符

### 5. API 安全

- ✅ API 密钥仅存储在后端
- ✅ 通过后端代理调用外部 API
- ❌ 前端永远不要直接调用外部 API
- ✅ 记录所有 API 错误日志

---

## 🛡️ 安全检查清单

部署前请确认：

### 环境变量
- [ ] `BLOB_READ_WRITE_TOKEN` 已配置
- [ ] `BLOB_ENCRYPTION_KEY` 已配置（推荐）
- [ ] `ALLOWED_ORIGINS` 已配置（生产环境必需）
- [ ] `NODE_ENV=production` 已设置
- [ ] `PURCHASE_APP_ID` 和 `PURCHASE_APP_KEY` 已配置

### 代码安全
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 前端代码中无硬编码密钥
- [ ] 所有用户输入已验证
- [ ] 使用 `textContent` 而非 `innerHTML`

### CORS 配置
- [ ] 生产环境不使用通配符 `*`
- [ ] 仅允许可信域名
- [ ] CSP 策略已配置

### Blob 存储
- [ ] Blob 令牌已配置
- [ ] 加密已启用（如果存储敏感数据）
- [ ] 加密密钥已备份

---

## 🔧 故障排查

### 1. CORS 错误

**症状**：浏览器控制台显示 CORS 错误

**解决方法**：
```bash
# 检查 Vercel 环境变量
ALLOWED_ORIGINS=*.vercel.app,https://your-domain.com

# 重新部署项目
vercel --prod
```

### 2. Blob 存储错误

**症状**：`缺少 Blob Token`

**解决方法**：
```bash
# 在 Vercel 添加环境变量
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# 或使用 Vercel 官方环境变量（自动注入）
# 在 Vercel 项目设置 -> Storage -> Blob -> Connect
```

### 3. 加密错误

**症状**：`Blob 解密失败`

**可能原因**：
- 加密密钥不匹配
- 数据未加密但尝试解密
- 密钥格式错误

**解决方法**：
```bash
# 确保密钥格式正确（base64，44个字符）
BLOB_ENCRYPTION_KEY=kPz8vX+9fJ2qR7xN...

# 如果更换密钥，旧数据将无法解密
# 需要导出数据 -> 清空 Blob -> 重新导入
```

### 4. API 密钥错误

**症状**：购买/查询失败，提示认证错误

**解决方法**：
```bash
# 检查后端环境变量
PURCHASE_APP_ID=1097
PURCHASE_APP_KEY=A2380737CA36CC61

# 前端不应发送密钥，确保已更新代码
```

---

## 📞 安全问题报告

如果发现安全漏洞，请：

1. **不要**公开披露
2. 发送邮件至项目维护者
3. 提供漏洞详情和复现步骤
4. 等待修复后再公开

---

## 🔄 密钥轮换指南

### 1. 轮换 Blob 加密密钥

```bash
# 步骤：
1. 导出所有邮箱数据（下载为 JSON）
2. 生成新密钥：
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
3. 更新 Vercel 环境变量 BLOB_ENCRYPTION_KEY
4. 清空 Blob 存储
5. 重新导入数据（自动使用新密钥加密）
```

### 2. 轮换采购 API 密钥

```bash
# 步骤：
1. 在 outlook007.cc 后台生成新密钥
2. 更新 Vercel 环境变量：
   PURCHASE_APP_ID=新ID
   PURCHASE_APP_KEY=新密钥
3. 重新部署项目
4. 测试购买功能
5. 作废旧密钥
```

### 3. 轮换 Blob 令牌

```bash
# 步骤：
1. 在 Vercel Storage 后台创建新 Blob Store
2. 记录新的 BLOB_READ_WRITE_TOKEN
3. 更新环境变量
4. 重新部署
5. 迁移数据到新 Store
6. 删除旧 Store
```

---

## 📚 相关文档

- [Vercel Blob 文档](https://vercel.com/docs/storage/vercel-blob)
- [Vercel 环境变量](https://vercel.com/docs/concepts/projects/environment-variables)
- [Node.js Crypto 模块](https://nodejs.org/api/crypto.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**最后更新**: 2026-01-01
**适用版本**: v2.2.0+
