/**
 * 后端错误处理中间件
 * 统一处理所有API错误，提供一致的错误响应格式
 */

const config = require('../config');

// ==================== 错误类定义 ====================

/**
 * 应用错误基类
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            error: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
        };
    }
}

/**
 * 验证错误 (400)
 */
class ValidationError extends AppError {
    constructor(message, fields = []) {
        super(message, 400, 'VALIDATION_ERROR', true);
        this.fields = fields;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            fields: this.fields,
        };
    }
}

/**
 * 认证错误 (401)
 */
class AuthenticationError extends AppError {
    constructor(message = '认证失败，请重新登录') {
        super(message, 401, 'AUTHENTICATION_ERROR', true);
    }
}

/**
 * 授权错误 (403)
 */
class AuthorizationError extends AppError {
    constructor(message = '无权限访问此资源') {
        super(message, 403, 'AUTHORIZATION_ERROR', true);
    }
}

/**
 * 资源未找到错误 (404)
 */
class NotFoundError extends AppError {
    constructor(resource = '资源') {
        super(`${resource}未找到`, 404, 'NOT_FOUND', true);
    }
}

/**
 * 冲突错误 (409)
 */
class ConflictError extends AppError {
    constructor(message = '资源冲突') {
        super(message, 409, 'CONFLICT', true);
    }
}

/**
 * 业务逻辑错误 (422)
 */
class BusinessError extends AppError {
    constructor(message, code = 'BUSINESS_ERROR') {
        super(message, 422, code, true);
    }
}

/**
 * 请求过于频繁 (429)
 */
class RateLimitError extends AppError {
    constructor(message = '请求过于频繁，请稍后再试') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
    }
}

/**
 * 服务不可用 (503)
 */
class ServiceUnavailableError extends AppError {
    constructor(message = '服务暂时不可用') {
        super(message, 503, 'SERVICE_UNAVAILABLE', true);
    }
}

// ==================== 错误处理中间件 ====================

/**
 * 404错误处理
 */
function notFoundHandler(req, res, next) {
    const error = new NotFoundError('接口');
    error.path = req.path;
    error.method = req.method;
    next(error);
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
    // 确保错误有状态码
    err.statusCode = err.statusCode || 500;
    err.code = err.code || 'INTERNAL_ERROR';
    
    // 记录错误
    logError(err, req);
    
    // 发送错误响应
    sendErrorResponse(err, req, res);
}

/**
 * 记录错误
 */
function logError(err, req) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
    };

    // 对于非预期错误，记录堆栈
    if (!err.isOperational || err.statusCode >= 500) {
        errorLog.stack = err.stack;
        console.error('❌ 服务器错误:', errorLog);
    } else {
        console.warn('⚠️  业务错误:', errorLog);
    }

    // 可以在这里添加错误上报到监控系统的逻辑
    // reportToMonitoring(errorLog);
}

/**
 * 发送错误响应
 */
function sendErrorResponse(err, req, res) {
    // 基础响应对象
    const response = {
        success: false,
        error: err.message,
        code: err.code,
        timestamp: new Date().toISOString(),
    };

    // 生产环境下隐藏敏感信息
    if (config.isDevelopment) {
        response.stack = err.stack;
        response.path = req.path;
        response.method = req.method;
    }

    // 添加额外字段
    if (err instanceof ValidationError && err.fields) {
        response.fields = err.fields;
    }

    // 对于非预期错误，返回通用错误消息
    if (!err.isOperational) {
        response.error = '服务器内部错误，请联系技术支持';
    }

    // 发送响应
    res.status(err.statusCode).json(response);
}

/**
 * 异步路由处理包装器
 * 自动捕获Promise拒绝，避免未处理的Promise错误
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 验证中间件
 * 使用schema验证请求参数
 */
function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // 返回所有错误
            stripUnknown: true, // 移除未知字段
        });

        if (error) {
            const fields = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));
            
            return next(new ValidationError('请求参数验证失败', fields));
        }

        // 用验证后的值替换req.body
        req.body = value;
        next();
    };
}

// ==================== 错误恢复助手 ====================

/**
 * 带降级的操作
 */
async function withFallback(operation, fallback, errorMessage = '操作失败') {
    try {
        return await operation();
    } catch (error) {
        console.warn(`${errorMessage}，使用降级方案:`, error.message);
        return await fallback(error);
    }
}

/**
 * 带重试的操作
 */
async function withRetry(operation, options = {}) {
    const { 
        maxRetries = 3, 
        delay = 1000, 
        backoff = 2,
        onRetry = null 
    } = options;

    let lastError;
    let currentDelay = delay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) {
                throw error;
            }

            if (onRetry) {
                onRetry(error, attempt + 1);
            }

            await sleep(currentDelay);
            currentDelay *= backoff;
        }
    }

    throw lastError;
}

/**
 * 睡眠函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 导出 ====================

module.exports = {
    // 错误类
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    BusinessError,
    RateLimitError,
    ServiceUnavailableError,
    
    // 中间件
    notFoundHandler,
    errorHandler,
    asyncHandler,
    validate,
    
    // 工具函数
    withFallback,
    withRetry,
};

