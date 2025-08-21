const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');


// 加载环境变量
dotenv.config();

// 从环境变量读取 Supabase 配置（生产环境务必在 Vercel 配置）
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase配置不完整：请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// 初始化Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet({
    crossOriginEmbedderPolicy: false,
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
        const { data, error } = await supabase
            .from('mailboxes')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            data: data || []
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

        // 检查邮箱是否已存在
        const { data: existing } = await supabase
            .from('mailboxes')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(409).json({
                success: false,
                error: '邮箱已存在'
            });
        }

        const { data, error } = await supabase
            .from('mailboxes')
            .insert([{
                email,
                password,
                client_id,
                refresh_token
            }])
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json({
            success: true,
            data: data
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

        // 检查重复邮箱
        const emails = mailboxes.map(m => m.email);
        const { data: existing } = await supabase
            .from('mailboxes')
            .select('email')
            .in('email', emails);

        const existingEmails = existing ? existing.map(e => e.email) : [];
        const newMailboxes = mailboxes.filter(m => !existingEmails.includes(m.email));

        if (newMailboxes.length === 0) {
            return res.status(409).json({
                success: false,
                error: '所有邮箱都已存在'
            });
        }

        const { data, error } = await supabase
            .from('mailboxes')
            .insert(newMailboxes)
            .select();

        if (error) {
            throw error;
        }

        res.status(201).json({
            success: true,
            data: data,
            added: newMailboxes.length,
            skipped: existingEmails.length,
            skippedEmails: existingEmails
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

        const { data, error } = await supabase
            .from('mailboxes')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: '邮箱不存在'
            });
        }

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

        const { data, error } = await supabase
            .from('mailboxes')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                error: '邮箱不存在'
            });
        }

        res.json({
            success: true,
            data: data
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
