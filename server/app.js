/**
 * Express应用配置
 * 使用新的架构：路由 -> 控制器 -> 服务层
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
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
            "connect-src": ["'self'", `http://localhost:${config.port}`, "*"]
        }
    }
}));

// CORS配置（支持通配符 *.vercel.app / '*'）
function isOriginAllowed(origin) {
    if (!origin) return true; // 无 Origin 的请求（curl/file://）放行
    const list = config.corsOrigins || [];
    if (list.length === 0) return true; // 未配置即放行
    if (list.includes('*')) return true; // 显式允许所有
    try {
        const url = new URL(origin);
        const host = url.hostname;
        for (const pat of list) {
            if (!pat) continue;
            if (pat === '*') return true;
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
    } catch (_) {
        // 解析失败时采用保守策略：不放行
    }
    // 始终允许本地调试
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
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

// 静态文件服务
app.use(express.static('public'));

// ==================== 路由注册 ====================

// API路由
app.use('/api', routes);

// ==================== 错误处理 ====================

// 404处理 - 使用统一的错误处理中间件
app.use(notFoundHandler);

// 全局错误处理中间件 - 必须放在最后
app.use(errorHandler);

module.exports = app;

