/**
 * Express应用配置
 * 使用新的架构：路由 -> 控制器 -> 服务层
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const logger = require('./utils/logger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ==================== 中间件配置 ====================

// Helmet安全中间件
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "https:", "'unsafe-inline'"],
            "img-src": ["'self'", "data:"],
            // 移除通配符 "*"，只允许特定域名和本地开发
            "connect-src": ["'self'",
                `http://localhost:${config.port}`,
                "https://*.vercel.app",
                "https://api.1181180.xyz",
                "https://outlook007.cc",
                "https://*.supabase.co"
            ]
        }
    }
}));

// CORS配置（安全加固版本）
function isOriginAllowed(origin) {
    // 无 Origin 的请求（服务端调用、curl等）默认拒绝，防止凭证泄露
    if (!origin) return false;

    const list = config.corsOrigins || [];

    // 未配置时默认拒绝（安全优先）
    // 生产环境必须配置 ALLOWED_ORIGINS 环境变量
    if (list.length === 0) {
        // 仅开发环境允许本地访问
        if (config.isDevelopment &&
            (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
            return true;
        }
        logger.warn('[CORS] 未配置 ALLOWED_ORIGINS，拒绝来源', { origin });
        return false;
    }

    // 检查是否显式配置了通配符（仅用于开发环境）
    if (list.includes('*')) {
        if (!config.isDevelopment) {
            logger.error('[CORS] 生产环境不允许使用通配符 "*"');
            return false;
        }
        return true;
    }

    try {
        const url = new URL(origin);
        const host = url.hostname;

        for (const pat of list) {
            if (!pat) continue;

            // 支持通配符子域名，如 *.vercel.app
            if (pat.startsWith('*.')) {
                const suffix = pat.slice(1); // 如 '.vercel.app'
                if (host.endsWith(suffix)) return true;
            }

            // 精确匹配（去除末尾斜杠）
            const normOrigin = origin.replace(/\/$/, '');
            const normPat = pat.replace(/\/$/, '');
            if (normOrigin === normPat) return true;

            // 常见场景：允许 vercel.app 子域
            if (pat === 'vercel.app' && host.endsWith('.vercel.app')) return true;
        }
    } catch (err) {
        // 解析失败时采用保守策略：不放行
        logger.warn('[CORS] Origin 解析失败', { origin, error: err.message });
        return false;
    }

    // 始终允许本地调试（开发环境）
    if (config.isDevelopment &&
        (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
        return true;
    }

    return false;
}

app.use(cors({
    origin: (origin, callback) => {
        const allowed = isOriginAllowed(origin);
        // 不再抛出错误导致500，直接返回不允许（浏览器拦截CORS）
        return callback(null, allowed);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
}));

// 解析JSON请求体
app.use(express.json());

// 解析URL编码请求体
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        error: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true, // 返回 `RateLimit-*` 头
    legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
    handler: (req, res) => {
        logger.warn('速率限制触发', {
            ip: req.headers['x-forwarded-for'] || req.ip,
            path: req.path,
        });
        res.status(429).json({
            success: false,
            error: '请求过于频繁，请稍后再试'
        });
    }
});

// 对 API 路由应用速率限制
app.use('/api', limiter);

// 禁用直接访问 index-optimized.html（仅根路径提供优化版）
// 必须放在静态文件中间件之前，以免被 public 目录命中
app.get('/index-optimized.html', (req, res) => {
    res.status(404).send('Not Found');
});

// 静态文件服务（不自动响应根目录）
app.use(express.static('public', { index: false }));

// 前端入口路由：默认使用优化版页面，旧版移到 /old
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index-optimized.html'));
});
app.get('/old', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================== 路由注册 ====================

// API路由
app.use('/api', routes);

// ==================== 错误处理 ====================

// 404处理 - 使用统一的错误处理中间件
app.use(notFoundHandler);

// 全局错误处理中间件 - 必须放在最后
app.use(errorHandler);

module.exports = app;
