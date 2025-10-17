/**
 * 日志系统 - 统一的日志管理
 * 支持不同级别的日志输出和日志收集
 */

import { ENV } from './config.js';

// 日志级别
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
};

// 日志级别名称
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// 日志级别颜色
const LEVEL_COLORS = {
    DEBUG: '#999',
    INFO: '#2196F3',
    WARN: '#FF9800',
    ERROR: '#F44336',
};

/**
 * Logger类
 */
class Logger {
    constructor(options = {}) {
        this.level = this.parseLevel(options.level || ENV.logLevel || 'info');
        this.prefix = options.prefix || '[App]';
        this.enableConsole = options.enableConsole !== false;
        this.enableStorage = options.enableStorage || false;
        this.maxStorageSize = options.maxStorageSize || 1000;
        
        // 日志存储
        this.logs = [];
        
        // 错误收集回调
        this.errorHandlers = [];
    }
    
    /**
     * 解析日志级别
     */
    parseLevel(level) {
        if (typeof level === 'number') {
            return level;
        }
        
        const upperLevel = level.toUpperCase();
        return LOG_LEVELS[upperLevel] !== undefined ? 
               LOG_LEVELS[upperLevel] : 
               LOG_LEVELS.INFO;
    }
    
    /**
     * 检查是否应该输出日志
     */
    shouldLog(level) {
        return level >= this.level;
    }
    
    /**
     * 格式化日志消息
     */
    formatMessage(level, args) {
        const timestamp = new Date().toISOString();
        const levelName = LEVEL_NAMES[level] || 'INFO';
        
        return {
            timestamp,
            level: levelName,
            prefix: this.prefix,
            message: args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' '),
        };
    }
    
    /**
     * 输出日志
     */
    log(level, ...args) {
        if (!this.shouldLog(level)) {
            return;
        }
        
        const formattedLog = this.formatMessage(level, args);
        const levelName = formattedLog.level;
        
        // 存储日志
        if (this.enableStorage) {
            this.storeLogs(formattedLog);
        }
        
        // 控制台输出
        if (this.enableConsole) {
            const consoleMethod = this.getConsoleMethod(level);
            const color = LEVEL_COLORS[levelName];
            
            consoleMethod(
                `%c${formattedLog.timestamp} %c${this.prefix} %c[${levelName}]`,
                'color: #999',
                'color: #666; font-weight: bold',
                `color: ${color}; font-weight: bold`,
                ...args
            );
        }
        
        // 错误处理
        if (level >= LOG_LEVELS.ERROR) {
            this.handleError(formattedLog, args);
        }
    }
    
    /**
     * 获取console方法
     */
    getConsoleMethod(level) {
        switch (level) {
            case LOG_LEVELS.DEBUG:
                return console.debug;
            case LOG_LEVELS.INFO:
                return console.info;
            case LOG_LEVELS.WARN:
                return console.warn;
            case LOG_LEVELS.ERROR:
                return console.error;
            default:
                return console.log;
        }
    }
    
    /**
     * 存储日志
     */
    storeLogs(log) {
        this.logs.push(log);
        
        // 限制日志数量
        if (this.logs.length > this.maxStorageSize) {
            this.logs = this.logs.slice(-this.maxStorageSize);
        }
    }
    
    /**
     * 处理错误
     */
    handleError(log, args) {
        this.errorHandlers.forEach(handler => {
            try {
                handler(log, args);
            } catch (e) {
                console.error('Error in error handler:', e);
            }
        });
    }
    
    /**
     * 注册错误处理器
     */
    onError(handler) {
        this.errorHandlers.push(handler);
        
        // 返回取消注册的函数
        return () => {
            const index = this.errorHandlers.indexOf(handler);
            if (index > -1) {
                this.errorHandlers.splice(index, 1);
            }
        };
    }
    
    /**
     * DEBUG级别日志
     */
    debug(...args) {
        this.log(LOG_LEVELS.DEBUG, ...args);
    }
    
    /**
     * INFO级别日志
     */
    info(...args) {
        this.log(LOG_LEVELS.INFO, ...args);
    }
    
    /**
     * WARN级别日志
     */
    warn(...args) {
        this.log(LOG_LEVELS.WARN, ...args);
    }
    
    /**
     * ERROR级别日志
     */
    error(...args) {
        this.log(LOG_LEVELS.ERROR, ...args);
    }
    
    /**
     * 获取所有日志
     */
    getLogs() {
        return this.logs;
    }
    
    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
    }
    
    /**
     * 导出日志（JSON格式）
     */
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
    
    /**
     * 创建子Logger
     */
    createChild(prefix) {
        return new Logger({
            level: this.level,
            prefix: `${this.prefix} ${prefix}`,
            enableConsole: this.enableConsole,
            enableStorage: false, // 子logger不存储，只输出
        });
    }
}

// 创建全局logger实例
const logger = new Logger({
    level: ENV.logLevel,
    prefix: '[EasyOutlook]',
    enableConsole: true,
    enableStorage: ENV.isDevelopment,
});

// 捕获全局错误
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        logger.error('全局错误:', event.error || event.message, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        logger.error('未捕获的Promise拒绝:', event.reason);
    });
}

// 导出
export { Logger, LOG_LEVELS };
export { logger };
export default logger;

