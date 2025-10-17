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

// CORS配置
app.use(cors({
    origin: (origin, callback) => {
        // 允许无Origin（如curl、本地file://）或白名单内的来源
        if (!origin) return callback(null, true);
        if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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

