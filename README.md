# 📧 Easy Outlook - 批量令牌邮箱快捷管理系统

一个现代化的 Outlook 邮箱管理系统，支持批量邮箱管理、邮件查看、购买邮箱等功能。

## ✨ 主要功能

- 📬 **邮箱管理**：批量导入和管理 Outlook 邮箱
- 📨 **邮件查看**：支持查看收件箱和垃圾邮件
- 🗑️ **批量操作**：一键清空收件箱或垃圾箱
- 🛒 **邮箱购买**：集成邮箱购买 API
- 💾 **数据持久化**：邮箱数据保存到服务器
- 🔒 **安全性**：后端代理 API 请求，避免 CORS 和凭证泄露

## 🚀 快速开始

### 前置要求

- Node.js 22.x 或更高版本
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 文件为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的参数（可选）。

### 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3001` 启动。

### 生产环境运行

```bash
npm start
```

## 📁 项目结构

```
outlook邮件管理系统/
├── public/              # 前端静态文件
│   └── index.html      # 主页面（包含所有前端代码）
├── api/                # Vercel 无服务器函数
│   └── server.js       # API 入口
├── data/               # 数据存储目录
│   └── mailboxes.json  # 邮箱数据文件
├── server.js           # Express 服务器主文件
├── package.json        # 项目依赖配置
├── vercel.json         # Vercel 部署配置
└── .env.example        # 环境变量示例
```

## 🔧 API 接口说明

### 邮箱管理 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/mailboxes` | GET | 获取所有邮箱列表 |
| `/api/mailboxes` | POST | 添加单个邮箱 |
| `/api/mailboxes/batch` | POST | 批量添加邮箱 |
| `/api/mailboxes/:id` | DELETE | 删除邮箱（软删除） |
| `/api/mailboxes/:id` | PUT | 更新邮箱信息 |

### 外部 API 代理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/proxy/balance` | POST | 查询账户余额 |
| `/api/proxy/stock` | GET | 查询商品库存 |
| `/api/proxy/purchase` | POST | 购买邮箱 |

## 🔐 安全性改进

### ✅ 已解决的 CORS 代理问题

**之前的问题：**
- ❌ 前端直接使用第三方代理 `cors-header-proxy.bdkm656.workers.dev`
- ❌ 存在安全风险和稳定性问题
- ❌ 敏感凭证暴露在前端代码中

**解决方案：**
- ✅ 在后端 `server.js` 中添加了 API 代理路由
- ✅ 前端通过自己的后端服务器转发请求
- ✅ 移除了对第三方 CORS 代理的依赖
- ✅ 提高了安全性和可控性

### 架构图

```
前端 (index.html)
    ↓
    | fetch('/api/proxy/balance')
    ↓
后端 (server.js)
    ↓
    | 代理转发请求
    ↓
外部 API (outlook007.cc)
```

## 📦 部署

### Vercel 部署

1. 在 Vercel 导入项目
2. 配置环境变量（如需要）
3. 点击部署

### 本地服务器部署

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

## 🛠️ 使用说明

### 1. 导入邮箱

- 在"设置"区域填写 API 地址（必填）
- 手动输入或上传包含邮箱配置的文件
- 格式：`email----password----client_id----refresh_token`
- 支持自定义分隔符

### 2. 查看邮件

- 双击邮箱列表中的邮箱进入
- 选择收件箱或垃圾邮件文件夹
- 点击"刷新"加载邮件列表
- 点击邮件查看详细内容

### 3. 购买邮箱（可选）

- 展开"购买邮箱"区域
- 选择仓库和商品类型
- 查询库存和余额
- 输入购买数量后点击购买

## 🔄 更新日志

### v1.1.0 (最新)

- ✅ 修复 CORS 代理问题
- ✅ 添加后端 API 代理路由
- ✅ 提升安全性
- ✅ 修复 UUID 版本依赖问题
- ✅ 添加环境变量配置

### v1.0.0

- 初始版本发布

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC

## 🙏 致谢

- [Express.js](https://expressjs.com/)
- [Outlook API](https://outlook.live.com/)

---

**注意：** 本项目仅供学习和研究使用，请遵守相关法律法规。

