/**
 * Winston 日志系统配置
 * 提供统一的日志管理，替换 console.log
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// 定义日志级别
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// 根据环境确定日志级别
const level = () => {
    const env = config.env || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : config.logLevel || 'info';
};

// 定义颜色
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// 定义日志格式
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf((info) => {
        const { timestamp, level, message, stack, ...meta } = info;

        let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

        // 添加额外的元数据
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }

        // 添加堆栈跟踪（仅错误）
        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// 定义控制台输出格式（带颜色）
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
        const { timestamp, level, message } = info;
        return `[${timestamp}] ${level}: ${message}`;
    })
);

// 定义日志传输方式
const transports = [
    // 控制台输出（所有环境）
    new winston.transports.Console({
        format: consoleFormat,
        level: level(),
    }),
];

// 生产环境添加文件输出（仅在可写环境）
if (config.isProduction) {
    const fs = require('fs');
    const logsDir = path.join(__dirname, '../../logs');

    // 检查日志目录是否可写
    let canWriteLogs = false;
    try {
        // 尝试创建日志目录
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        // 测试写入权限
        const testFile = path.join(logsDir, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        canWriteLogs = true;
    } catch (err) {
        // Vercel 等只读环境无法写入，仅使用控制台日志
        console.warn('⚠️  日志目录不可写，仅使用控制台日志:', err.message);
    }

    if (canWriteLogs) {
        // 错误日志文件
        transports.push(
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                format,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            })
        );

        // 综合日志文件
        transports.push(
            new winston.transports.File({
                filename: path.join(logsDir, 'combined.log'),
                format,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            })
        );
    }
}

// 创建 Logger 实例
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
    exitOnError: false,
});

// 仅在可写环境添加异常和拒绝处理器
if (config.isProduction) {
    const fs = require('fs');
    const logsDir = path.join(__dirname, '../../logs');

    try {
        if (fs.existsSync(logsDir) && fs.statSync(logsDir).isDirectory()) {
            logger.exceptions.handle(
                new winston.transports.File({
                    filename: path.join(logsDir, 'exceptions.log'),
                })
            );
            logger.rejections.handle(
                new winston.transports.File({
                    filename: path.join(logsDir, 'rejections.log'),
                })
            );
        }
    } catch (err) {
        // 忽略错误，使用默认控制台处理
    }
}

// 添加辅助方法
logger.logRequest = (req, statusCode, message = '') => {
    const meta = {
        method: req.method,
        path: req.path,
        statusCode,
        ip: req.headers['x-forwarded-for'] || req.ip,
        userAgent: req.headers['user-agent'],
    };

    if (statusCode >= 500) {
        logger.error(`${message || 'Server error'}`, meta);
    } else if (statusCode >= 400) {
        logger.warn(`${message || 'Client error'}`, meta);
    } else {
        logger.http(`${req.method} ${req.path} - ${statusCode}`, meta);
    }
};

logger.logBlobOperation = (operation, key, success, details = {}) => {
    const message = `[Blob] ${operation}: ${key}`;
    if (success) {
        logger.info(`✅ ${message}`, details);
    } else {
        logger.error(`❌ ${message}`, details);
    }
};

// 开发环境提示
if (config.isDevelopment) {
    logger.debug('📝 Logger initialized in development mode');
}

module.exports = logger;
