/**
 * 服务器配置管理
 */

const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

const config = {
    // 环境
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    
    // 服务器配置
    port: parseInt(process.env.PORT, 10) || 3001,
    host: process.env.HOST || '0.0.0.0',
    
    // 数据存储
    dataDir: process.env.DATA_DIR || path.join(__dirname, '../../data'),
    mailboxesFile: process.env.MAILBOXES_FILE || path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'mailboxes.json'),
    
    // CORS配置（支持通配符）示例："*,https://yourdomain.com,*.vercel.app"
    corsOrigins: (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    
    // 采购API配置
    purchaseLibraries: {
        '1': 'https://outlook007.cc/api',
        '2': 'https://outlook007.cc/api1',
    },

    // 采购API凭证（从环境变量读取，避免前端暴露）
    purchaseCredentials: {
        appId: process.env.PURCHASE_APP_ID || '1097',
        appKey: process.env.PURCHASE_APP_KEY || 'A2380737CA36CC61',
    },

    // 外部邮件 API 配置（从环境变量读取，避免前端暴露）
    externalMailApi: {
        baseUrl: process.env.EXTERNAL_MAIL_API_URL || 'https://api.1181180.xyz/api',
        password: process.env.EXTERNAL_MAIL_API_PASSWORD || '',
    },

    // 日志配置
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // 安全配置
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15分钟
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // 最多100个请求
    },
};

module.exports = config;



