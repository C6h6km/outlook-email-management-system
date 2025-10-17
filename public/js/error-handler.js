/**
 * 统一错误处理模块
 * 提供错误分类、错误边界、错误上报等功能
 */

// ==================== 错误类型定义 ====================

/**
 * 应用错误基类
 */
class AppError extends Error {
    constructor(message, code, statusCode = 500, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational; // 是否为可预期的业务错误
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
        };
    }
}

/**
 * 网络错误
 */
class NetworkError extends AppError {
    constructor(message, originalError = null) {
        super(message, 'NETWORK_ERROR', 0, true);
        this.originalError = originalError;
    }
}

/**
 * API错误
 */
class APIError extends AppError {
    constructor(message, statusCode, response = null) {
        super(message, 'API_ERROR', statusCode, true);
        this.response = response;
    }
}

/**
 * 超时错误
 */
class TimeoutError extends AppError {
    constructor(message = '请求超时', timeout = 0) {
        super(message, 'TIMEOUT_ERROR', 408, true);
        this.timeout = timeout;
    }
}

/**
 * 验证错误
 */
class ValidationError extends AppError {
    constructor(message, fields = []) {
        super(message, 'VALIDATION_ERROR', 400, true);
        this.fields = fields;
    }
}

/**
 * 认证错误
 */
class AuthenticationError extends AppError {
    constructor(message = '认证失败') {
        super(message, 'AUTH_ERROR', 401, true);
    }
}

/**
 * 授权错误
 */
class AuthorizationError extends AppError {
    constructor(message = '无权限访问') {
        super(message, 'AUTHORIZATION_ERROR', 403, true);
    }
}

/**
 * 资源未找到错误
 */
class NotFoundError extends AppError {
    constructor(resource = '资源') {
        super(`${resource}未找到`, 'NOT_FOUND', 404, true);
    }
}

/**
 * 业务逻辑错误
 */
class BusinessError extends AppError {
    constructor(message, code = 'BUSINESS_ERROR') {
        super(message, code, 400, true);
    }
}

// ==================== 错误处理器 ====================

/**
 * 全局错误处理器
 */
class GlobalErrorHandler {
    constructor() {
        this.errorListeners = [];
        this.errorLog = [];
        this.maxLogSize = 100;
        this.isInitialized = false;
    }

    /**
     * 初始化全局错误处理
     */
    init() {
        if (this.isInitialized) return;

        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            this.handleError(event.reason, {
                type: 'unhandledrejection',
                promise: event.promise,
            });
            event.preventDefault();
        });

        // 捕获全局错误
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
            this.handleError(event.error, {
                type: 'error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            });
        });

        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                console.error('资源加载失败:', event.target);
                this.handleError(new Error(`资源加载失败: ${event.target.src || event.target.href}`), {
                    type: 'resource',
                    target: event.target,
                });
            }
        }, true);

        this.isInitialized = true;
        console.log('✅ 全局错误处理器已初始化');
    }

    /**
     * 处理错误
     */
    handleError(error, context = {}) {
        // 标准化错误对象
        const normalizedError = this.normalizeError(error);
        
        // 添加上下文信息
        normalizedError.context = context;
        
        // 记录错误
        this.logError(normalizedError);
        
        // 通知监听器
        this.notifyListeners(normalizedError);
        
        // 显示用户友好的错误消息
        this.showUserError(normalizedError);
        
        return normalizedError;
    }

    /**
     * 标准化错误对象
     */
    normalizeError(error) {
        if (error instanceof AppError) {
            return error;
        }

        if (error instanceof TypeError) {
            return new AppError(error.message, 'TYPE_ERROR', 500, false);
        }

        if (error instanceof SyntaxError) {
            return new AppError(error.message, 'SYNTAX_ERROR', 500, false);
        }

        if (error instanceof Error) {
            return new AppError(error.message, 'UNKNOWN_ERROR', 500, false);
        }

        // 如果是字符串或其他类型
        return new AppError(String(error), 'UNKNOWN_ERROR', 500, false);
    }

    /**
     * 记录错误
     */
    logError(error) {
        const logEntry = {
            ...error.toJSON(),
            context: error.context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            stack: error.stack,
        };

        // 添加到错误日志
        this.errorLog.unshift(logEntry);
        
        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        // 输出到控制台
        console.error('错误详情:', logEntry);

        // 可以在这里添加错误上报到服务器的逻辑
        // this.reportToServer(logEntry);
    }

    /**
     * 显示用户友好的错误消息
     */
    showUserError(error) {
        let message = error.message;
        let type = 'error';

        // 根据错误类型定制消息
        if (error instanceof NetworkError) {
            message = '网络连接失败，请检查您的网络连接';
        } else if (error instanceof TimeoutError) {
            message = '请求超时，请稍后重试';
        } else if (error instanceof AuthenticationError) {
            message = '认证失败，请重新登录';
        } else if (error instanceof ValidationError) {
            message = `输入验证失败: ${error.message}`;
        } else if (!error.isOperational) {
            message = '系统错误，请联系技术支持';
        }

        // 使用应用的状态消息系统
        if (window.setStatusMessage) {
            window.setStatusMessage(message, type);
        } else {
            // 后备方案：使用alert
            alert(message);
        }
    }

    /**
     * 添加错误监听器
     */
    addListener(listener) {
        this.errorListeners.push(listener);
    }

    /**
     * 移除错误监听器
     */
    removeListener(listener) {
        const index = this.errorListeners.indexOf(listener);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }

    /**
     * 通知所有监听器
     */
    notifyListeners(error) {
        this.errorListeners.forEach(listener => {
            try {
                listener(error);
            } catch (err) {
                console.error('错误监听器执行失败:', err);
            }
        });
    }

    /**
     * 获取错误日志
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * 清空错误日志
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * 上报错误到服务器（可选实现）
     */
    reportToServer(errorLog) {
        // 实现错误上报逻辑
        // 例如: fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorLog) })
    }
}

// ==================== 错误恢复策略 ====================

/**
 * 错误恢复助手
 */
class ErrorRecovery {
    /**
     * 带重试的异步操作
     */
    static async withRetry(fn, options = {}) {
        const {
            maxRetries = 3,
            delay = 1000,
            backoff = 2,
            onRetry = null,
            shouldRetry = null,
        } = options;

        let lastError;
        let currentDelay = delay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // 检查是否应该重试
                if (shouldRetry && !shouldRetry(error, attempt)) {
                    throw error;
                }

                // 最后一次尝试失败
                if (attempt === maxRetries) {
                    throw error;
                }

                // 通知重试
                if (onRetry) {
                    onRetry(error, attempt + 1);
                }

                // 等待后重试
                await this.sleep(currentDelay);
                currentDelay *= backoff;
            }
        }

        throw lastError;
    }

    /**
     * 带超时的异步操作
     */
    static async withTimeout(fn, timeout = 30000) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new TimeoutError(`操作超时 (${timeout}ms)`));
                }, timeout);
            }),
        ]);
    }

    /**
     * 带降级方案的操作
     */
    static async withFallback(fn, fallbackFn) {
        try {
            return await fn();
        } catch (error) {
            console.warn('主操作失败，使用降级方案:', error);
            return await fallbackFn(error);
        }
    }

    /**
     * 睡眠函数
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==================== 错误边界组件 ====================

/**
 * React风格的错误边界（适用于原生JS）
 */
class ErrorBoundary {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            fallback: this.defaultFallback,
            onError: null,
            ...options,
        };
    }

    /**
     * 包装函数以捕获错误
     */
    wrap(fn) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error);
                return null;
            }
        };
    }

    /**
     * 处理错误
     */
    handleError(error) {
        console.error('ErrorBoundary捕获错误:', error);

        // 调用错误回调
        if (this.options.onError) {
            this.options.onError(error);
        }

        // 显示降级UI
        this.showFallback(error);

        // 记录到全局错误处理器
        if (window.errorHandler) {
            window.errorHandler.handleError(error, {
                type: 'errorBoundary',
                element: this.element,
            });
        }
    }

    /**
     * 显示降级UI
     */
    showFallback(error) {
        if (!this.element) return;

        const fallbackContent = this.options.fallback(error);
        this.element.innerHTML = fallbackContent;
    }

    /**
     * 默认降级UI
     */
    defaultFallback(error) {
        return `
            <div style="padding: 20px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin: 10px;">
                <h3 style="color: #856404; margin-top: 0;">⚠️ 出错了</h3>
                <p style="color: #856404; margin-bottom: 10px;">${error.message}</p>
                <button onclick="window.location.reload()" style="padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    刷新页面
                </button>
            </div>
        `;
    }
}

// ==================== 导出 ====================

// 创建全局错误处理器实例
const errorHandler = new GlobalErrorHandler();

export {
    // 错误类
    AppError,
    NetworkError,
    APIError,
    TimeoutError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    BusinessError,
    
    // 错误处理器
    GlobalErrorHandler,
    errorHandler,
    
    // 错误恢复
    ErrorRecovery,
    
    // 错误边界
    ErrorBoundary,
};

// 暴露到全局（供非模块化代码使用）
window.ErrorHandler = {
    AppError,
    NetworkError,
    APIError,
    TimeoutError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    BusinessError,
    ErrorRecovery,
    ErrorBoundary,
    errorHandler,
};

