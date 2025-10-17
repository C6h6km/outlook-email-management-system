const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');


// 加载环境变量
dotenv.config();

// 在 Vercel（无服务器，磁盘只读）环境下使用 /tmp 作为可写目录
const IS_VERCEL = !!process.env.VERCEL;
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.DATA_DIR || (IS_VERCEL ? '/tmp/easy-outlook-data' : DEFAULT_DATA_DIR);
const MAILBOXES_FILE = process.env.MAILBOXES_FILE || path.join(DATA_DIR, 'mailboxes.json');

async function ensureDataFile() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }

    try {
        await fs.access(MAILBOXES_FILE);
    } catch {
        await fs.writeFile(MAILBOXES_FILE, JSON.stringify([]));
    }
}

async function readMailboxes() {
    await ensureDataFile();
    const content = await fs.readFile(MAILBOXES_FILE, 'utf8');
    try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeMailboxes(mailboxes) {
    await ensureDataFile();
    await fs.writeFile(MAILBOXES_FILE, JSON.stringify(mailboxes, null, 2));
}

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            // 允许页面中的内联脚本与事件处理（开发/本地场景需要）
            "script-src": ["'self'", "'unsafe-inline'"],
            "script-src-attr": ["'unsafe-inline'"],
            // 样式仍允许内联
            "style-src": ["'self'", "https:", "'unsafe-inline'"],
            // 允许本地图片与 data URI
            "img-src": ["'self'", "data:"],
            // 允许从本机与任意地址发起网络请求（前端会访问外部API与代理）
            "connect-src": ["'self'", "http://localhost:" + (process.env.PORT || 3001), "*"]
        }
    }
}));

// 安全的CORS配置（支持白名单与 file:// 无 Origin 的情况）
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // 允许无 Origin（如 curl、本地 file://）或白名单内的来源
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());
app.use(express.static('public'));

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 获取所有邮箱
app.get('/api/mailboxes', async (req, res) => {
    try {
        const mailboxes = await readMailboxes();
        const activeMailboxes = mailboxes.filter(m => m.is_active !== false);

        res.json({
            success: true,
            data: activeMailboxes
        });
    } catch (error) {
        console.error('获取邮箱列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取邮箱列表失败',
            details: error.message
        });
    }
});

// 添加单个邮箱
app.post('/api/mailboxes', async (req, res) => {
    try {
        const { email, password, client_id, refresh_token } = req.body;

        if (!email || !password || !client_id || !refresh_token) {
            return res.status(400).json({
                success: false,
                error: '缺少必要的邮箱配置信息'
            });
        }

        const mailboxes = await readMailboxes();
        const existing = mailboxes.find(m => m.email === email);

        if (existing && existing.is_active !== false) {
            return res.status(409).json({ success: false, error: '邮箱已存在' });
        }

        const now = new Date().toISOString();
        let mailbox;

        if (existing && existing.is_active === false) {
            existing.password = password;
            existing.client_id = client_id;
            existing.refresh_token = refresh_token;
            existing.is_active = true;
            existing.updated_at = now;
            mailbox = existing;
        } else {
            mailbox = {
                id: uuidv4(),
                email,
                password,
                client_id,
                refresh_token,
                is_active: true,
                created_at: now,
                updated_at: now
            };
            mailboxes.push(mailbox);
        }

        await writeMailboxes(mailboxes);

        res.status(201).json({
            success: true,
            data: mailbox
        });
    } catch (error) {
        console.error('添加邮箱失败:', error);
        res.status(500).json({
            success: false,
            error: '添加邮箱失败',
            details: error.message
        });
    }
});

// 批量添加邮箱
app.post('/api/mailboxes/batch', async (req, res) => {
    try {
        const { mailboxes } = req.body;

        if (!Array.isArray(mailboxes) || mailboxes.length === 0) {
            return res.status(400).json({
                success: false,
                error: '邮箱数据格式错误'
            });
        }

        // 验证每个邮箱的数据完整性
        for (const mailbox of mailboxes) {
            if (!mailbox.email || !mailbox.password || !mailbox.client_id || !mailbox.refresh_token) {
                return res.status(400).json({
                    success: false,
                    error: '邮箱配置信息不完整'
                });
            }
        }

        const existingMailboxes = await readMailboxes();
        const now = new Date().toISOString();

        const emailMap = new Map(existingMailboxes.map(m => [m.email, m]));

        const added = [];
        const reactivated = [];
        const skipped = [];

        for (const mailbox of mailboxes) {
            const current = emailMap.get(mailbox.email);
            if (!current) {
                const newMailbox = {
                    id: uuidv4(),
                    email: mailbox.email,
                    password: mailbox.password,
                    client_id: mailbox.client_id,
                    refresh_token: mailbox.refresh_token,
                    is_active: true,
                    created_at: now,
                    updated_at: now
                };
                existingMailboxes.push(newMailbox);
                emailMap.set(newMailbox.email, newMailbox);
                added.push(newMailbox);
            } else if (current.is_active === false) {
                current.password = mailbox.password;
                current.client_id = mailbox.client_id;
                current.refresh_token = mailbox.refresh_token;
                current.is_active = true;
                current.updated_at = now;
                reactivated.push(current);
            } else {
                skipped.push(mailbox.email);
            }
        }

        await writeMailboxes(existingMailboxes);

        res.status(201).json({
            success: true,
            data: [...added, ...reactivated],
            added: added.length,
            reactivated: reactivated.length,
            skipped: skipped.length,
            skippedEmails: skipped
        });
    } catch (error) {
        console.error('批量添加邮箱失败:', error);
        res.status(500).json({
            success: false,
            error: '批量添加邮箱失败',
            details: error.message
        });
    }
});

// 删除邮箱（软删除）
app.delete('/api/mailboxes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const mailboxes = await readMailboxes();
        const mailbox = mailboxes.find(m => m.id === id);

        if (!mailbox) {
            return res.status(404).json({
                success: false,
                error: '邮箱不存在'
            });
        }

        mailbox.is_active = false;
        mailbox.updated_at = new Date().toISOString();

        await writeMailboxes(mailboxes);

        res.json({
            success: true,
            message: '邮箱删除成功'
        });
    } catch (error) {
        console.error('删除邮箱失败:', error);
        res.status(500).json({
            success: false,
            error: '删除邮箱失败',
            details: error.message
        });
    }
});

// 更新邮箱信息
app.put('/api/mailboxes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, client_id, refresh_token } = req.body;

        const updateData = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;
        if (client_id) updateData.client_id = client_id;
        if (refresh_token) updateData.refresh_token = refresh_token;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有提供要更新的数据'
            });
        }

        const mailboxes = await readMailboxes();
        const mailbox = mailboxes.find(m => m.id === id);

        if (!mailbox) {
            return res.status(404).json({
                success: false,
                error: '邮箱不存在'
            });
        }

        Object.assign(mailbox, updateData, { updated_at: new Date().toISOString() });

        await writeMailboxes(mailboxes);

        res.json({
            success: true,
            data: mailbox
        });
    } catch (error) {
        console.error('更新邮箱失败:', error);
        res.status(500).json({
            success: false,
            error: '更新邮箱失败',
            details: error.message
        });
    }
});

// ==================== 外部 API 代理路由 ====================
// 采购 API 配置
const PURCHASE_LIBRARIES = {
    '1': 'https://outlook007.cc/api',
    '2': 'https://outlook007.cc/api1'
};

// 代理：查询余额
app.post('/api/proxy/balance', async (req, res) => {
    try {
        const { app_id, app_key, library = '1' } = req.body;
        
        if (!app_id || !app_key) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const baseUrl = PURCHASE_LIBRARIES[library];
        if (!baseUrl) {
            return res.status(400).json({
                success: false,
                error: '无效的库选择'
            });
        }

        const params = new URLSearchParams({
            app_id,
            app_key
        });

        const response = await fetch(`${baseUrl}/login.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('查询余额失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 代理：查询库存
app.get('/api/proxy/stock', async (req, res) => {
    try {
        const { commodity_id, library = '1' } = req.query;
        
        if (!commodity_id) {
            return res.status(400).json({
                success: false,
                error: '缺少商品ID'
            });
        }

        const baseUrl = PURCHASE_LIBRARIES[library];
        if (!baseUrl) {
            return res.status(400).json({
                success: false,
                error: '无效的库选择'
            });
        }

        const response = await fetch(`${baseUrl}/getStock.php?commodity_id=${commodity_id}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('查询库存失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 代理：购买邮箱
app.post('/api/proxy/purchase', async (req, res) => {
    try {
        const { app_id, app_key, commodity_id, num, library = '1' } = req.body;
        
        if (!app_id || !app_key || !commodity_id || !num) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const baseUrl = PURCHASE_LIBRARIES[library];
        if (!baseUrl) {
            return res.status(400).json({
                success: false,
                error: '无效的库选择'
            });
        }

        const params = new URLSearchParams({
            app_id,
            app_key,
            commodity_id,
            num: num.toString()
        });

        const response = await fetch(`${baseUrl}/getEmail.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('购买邮箱失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在'
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`服务器运行在端口 ${PORT}`);
        console.log(`健康检查: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;
