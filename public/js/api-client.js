/**
 * API客户端 - 统一管理所有HTTP请求
 * 提供类型安全的API调用接口
 * v2.0 - 增强错误处理、重试机制和超时控制
 */

import { API_CONFIG, HTTP_STATUS, ERROR_MESSAGES, ENV } from './config.js';
import { logger } from './logger.js';
import { 
    APIError, 
    NetworkError, 
    TimeoutError, 
    ValidationError,
    ErrorRecovery 
} from './error-handler.js';

/**
 * HTTP请求错误类（兼容性保留，实际使用APIError）
 */
export class ApiError extends APIError {
    constructor(message, status, data) {
        super(message, status, data);
        this.name = 'ApiError';
    }
}

/**
 * HTTP客户端基类
 * 增强版：支持高级重试策略、请求拦截器、响应缓存
 */
class HttpClient {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL;
        this.timeout = options.timeout || API_CONFIG.TIMEOUT || 30000;
        this.headers = { ...API_CONFIG.HEADERS, ...options.headers };
        this.retryTimes = options.retryTimes || API_CONFIG.RETRY_TIMES || 3;
        this.retryDelay = options.retryDelay || API_CONFIG.RETRY_DELAY || 1000;
        this.retryBackoff = options.retryBackoff || 2; // 退避倍数
        
        // 请求拦截器
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // 响应缓存
        this.cache = new Map();
        this.cacheEnabled = options.cache || false;
        this.cacheTTL = options.cacheTTL || 60000; // 默认1分钟
        
        // 请求队列（防止并发过多）
        this.maxConcurrent = options.maxConcurrent || 10;
        this.activeRequests = 0;
        this.requestQueue = [];
    }
    
    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    /**
     * 执行请求拦截器
     */
    async runRequestInterceptors(config) {
        let modifiedConfig = config;
        for (const interceptor of this.requestInterceptors) {
            modifiedConfig = await interceptor(modifiedConfig);
        }
        return modifiedConfig;
    }
    
    /**
     * 执行响应拦截器
     */
    async runResponseInterceptors(response) {
        let modifiedResponse = response;
        for (const interceptor of this.responseInterceptors) {
            modifiedResponse = await interceptor(modifiedResponse);
        }
        return modifiedResponse;
    }
    
    /**
     * 发送请求（带超时、重试和错误处理）
     */
    async request(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
        const cacheKey = `${options.method || 'GET'}_${fullUrl}`;
        
        // 检查缓存
        if (this.cacheEnabled && options.method === 'GET') {
            const cached = this.getCache(cacheKey);
            if (cached) {
                logger.debug(`[HTTP] 使用缓存: ${fullUrl}`);
                return cached;
            }
        }
        
        // 等待并发控制
        await this.waitForConcurrency();
        
        try {
            this.activeRequests++;
            
            // 使用增强的重试机制
            const result = await ErrorRecovery.withRetry(
                async () => {
                    // 超时控制
                    return await ErrorRecovery.withTimeout(
                        async () => await this.executeRequest(fullUrl, options),
                        this.timeout
                    );
                },
                {
                    maxRetries: this.retryTimes,
                    delay: this.retryDelay,
                    backoff: this.retryBackoff,
                    onRetry: (error, attempt) => {
                        logger.warn(`请求失败，正在重试 (${attempt}/${this.retryTimes})`, {
                            url: fullUrl,
                            error: error.message,
                        });
                    },
                    shouldRetry: (error) => {
                        // 只重试网络错误和超时错误
                        return error instanceof NetworkError || 
                               error instanceof TimeoutError ||
                               (error instanceof APIError && error.statusCode >= 500);
                    }
                }
            );
            
            // 缓存GET请求结果
            if (this.cacheEnabled && options.method === 'GET') {
                this.setCache(cacheKey, result);
            }
            
            return result;
            
        } catch (error) {
            // 标准化错误
            const standardError = this.normalizeError(error, fullUrl);
            logger.error(`请求失败: ${fullUrl}`, standardError);
            throw standardError;
            
        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    }
    
    /**
     * 执行单次请求
     */
    async executeRequest(url, options) {
        // 合并请求头
        const headers = { ...this.headers, ...options.headers };
        
        // 创建请求配置
        let config = {
            ...options,
            headers,
        };
        
        // 执行请求拦截器
        config = await this.runRequestInterceptors(config);
        
        logger.debug(`[HTTP] ${config.method || 'GET'} ${url}`, config);
        
        let response;
        try {
            response = await fetch(url, config);
        } catch (error) {
            // 网络错误
            throw new NetworkError('网络连接失败，请检查您的网络', error);
        }
        
        // 执行响应拦截器
        response = await this.runResponseInterceptors(response);
        
        // 处理响应
        return await this.handleResponse(response, url);
    }
    
    /**
     * 并发控制 - 等待
     */
    async waitForConcurrency() {
        if (this.activeRequests >= this.maxConcurrent) {
            return new Promise(resolve => {
                this.requestQueue.push(resolve);
            });
        }
    }
    
    /**
     * 并发控制 - 处理队列
     */
    processQueue() {
        if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const resolve = this.requestQueue.shift();
            resolve();
        }
    }
    
    /**
     * 标准化错误
     */
    normalizeError(error, url) {
        if (error instanceof APIError || 
            error instanceof NetworkError || 
            error instanceof TimeoutError) {
            return error;
        }
        
        // 其他未知错误
        return new NetworkError(`请求失败: ${error.message}`, error);
    }
    
    /**
     * 设置缓存
     */
    setCache(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });
    }
    
    /**
     * 获取缓存
     */
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        // 检查是否过期
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.value;
    }
    
    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * 处理响应
     */
    async handleResponse(response, url) {
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        // 解析响应体
        let data;
        try {
            data = isJson ? await response.json() : await response.text();
        } catch (error) {
            logger.error('解析响应失败:', error);
            throw new APIError('响应解析失败', response.status);
        }
        
        // 检查HTTP状态
        if (!response.ok) {
            const message = data?.message || data?.error || 
                          this.getErrorMessage(response.status);
            
            // 使用增强的错误类
            throw new APIError(message, response.status, data);
        }
        
        return data;
    }
    
    /**
     * 根据状态码获取错误消息
     */
    getErrorMessage(status) {
        const messages = {
            400: ERROR_MESSAGES?.VALIDATION_ERROR || '请求参数错误',
            401: ERROR_MESSAGES?.AUTH_ERROR || '认证失败',
            403: ERROR_MESSAGES?.AUTH_ERROR || '无权限访问',
            404: ERROR_MESSAGES?.NOT_FOUND || '资源未找到',
            408: '请求超时',
            429: '请求过于频繁，请稍后再试',
            500: ERROR_MESSAGES?.SERVER_ERROR || '服务器内部错误',
            502: '网关错误',
            503: ERROR_MESSAGES?.SERVER_ERROR || '服务暂时不可用',
            504: '网关超时',
        };
        
        return messages[status] || ERROR_MESSAGES?.UNKNOWN_ERROR || '未知错误';
    }
    
    /**
     * GET请求
     */
    async get(url, params = {}, options = {}) {
        // 构建查询字符串
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        return this.request(fullUrl, {
            method: 'GET',
            ...options,
        });
    }
    
    /**
     * POST请求
     */
    async post(url, data = {}, options = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data),
            ...options,
        });
    }
    
    /**
     * PUT请求
     */
    async put(url, data = {}, options = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options,
        });
    }
    
    /**
     * DELETE请求
     */
    async delete(url, options = {}) {
        return this.request(url, {
            method: 'DELETE',
            ...options,
        });
    }
    
    /**
     * PATCH请求
     */
    async patch(url, data = {}, options = {}) {
        return this.request(url, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options,
        });
    }
}

/**
 * API客户端类
 */
class ApiClient extends HttpClient {
    constructor(baseURL, apiPassword = '') {
        super(baseURL);
        this.apiPassword = apiPassword;
    }
    
    /**
     * 设置API密码
     */
    setApiPassword(password) {
        this.apiPassword = password;
    }
    
    /**
     * 添加API密码到参数
     */
    addPasswordParam(params) {
        if (this.apiPassword) {
            return { ...params, password: this.apiPassword };
        }
        return params;
    }
    
    // ==================== 邮箱管理 API ====================
    
    /**
     * 获取所有邮箱
     */
    async getMailboxes() {
        const result = await this.get('/mailboxes');
        return result.data || [];
    }
    
    /**
     * 添加单个邮箱
     */
    async addMailbox(mailbox) {
        const result = await this.post('/mailboxes', mailbox);
        return result.data;
    }
    
    /**
     * 批量添加邮箱
     */
    async addMailboxesBatch(mailboxes) {
        return await this.post('/mailboxes/batch', { mailboxes });
    }
    
    /**
     * 删除邮箱
     */
    async deleteMailbox(id) {
        return await this.delete(`/mailboxes/${id}`);
    }
    
    /**
     * 更新邮箱
     */
    async updateMailbox(id, data) {
        return await this.put(`/mailboxes/${id}`, data);
    }
    
    // ==================== 邮件操作 API ====================
    
    /**
     * 获取邮件列表
     */
    async getEmails(mailbox, folder = 'INBOX') {
        const params = this.addPasswordParam({
            refresh_token: mailbox.refresh_token,
            client_id: mailbox.client_id,
            email: mailbox.email,
            mailbox: folder,
        });
        
        // 使用自定义API地址
        const apiBaseUrl = localStorage.getItem('easy_outlook_apiBaseUrl') || '';
        if (!apiBaseUrl) {
            throw new Error('请先配置API地址');
        }
        
        const url = `${apiBaseUrl}/mail-all`;
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${queryString}`;
        
        const data = await this.request(fullUrl, { method: 'GET' });
        
        // 处理不同的响应格式
        if (Array.isArray(data)) {
            return data;
        } else if (data && data.data && Array.isArray(data.data)) {
            return data.data;
        } else if (data) {
            return [data];
        }
        
        return [];
    }
    
    /**
     * 获取最新邮件
     */
    async getLatestEmail(mailbox, folder = 'INBOX', responseType = 'json') {
        const params = this.addPasswordParam({
            refresh_token: mailbox.refresh_token,
            client_id: mailbox.client_id,
            email: mailbox.email,
            mailbox: folder,
            response_type: responseType,
        });
        
        const apiBaseUrl = localStorage.getItem('easy_outlook_apiBaseUrl') || '';
        if (!apiBaseUrl) {
            throw new Error('请先配置API地址');
        }
        
        const url = `${apiBaseUrl}/mail-new`;
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${queryString}`;
        
        return await this.request(fullUrl, { method: 'GET' });
    }
    
    /**
     * 清空收件箱
     */
    async clearInbox(mailbox) {
        const params = this.addPasswordParam({
            refresh_token: mailbox.refresh_token,
            client_id: mailbox.client_id,
            email: mailbox.email,
        });
        
        const apiBaseUrl = localStorage.getItem('easy_outlook_apiBaseUrl') || '';
        if (!apiBaseUrl) {
            throw new Error('请先配置API地址');
        }
        
        const url = `${apiBaseUrl}/process-inbox`;
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${queryString}`;
        
        return await this.request(fullUrl, { method: 'GET' });
    }
    
    /**
     * 清空垃圾箱
     */
    async clearJunk(mailbox) {
        const params = this.addPasswordParam({
            refresh_token: mailbox.refresh_token,
            client_id: mailbox.client_id,
            email: mailbox.email,
        });
        
        const apiBaseUrl = localStorage.getItem('easy_outlook_apiBaseUrl') || '';
        if (!apiBaseUrl) {
            throw new Error('请先配置API地址');
        }
        
        const url = `${apiBaseUrl}/process-junk`;
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${queryString}`;
        
        return await this.request(fullUrl, { method: 'GET' });
    }
    
    // ==================== 采购 API ====================
    
    /**
     * 查询余额
     */
    async checkBalance(appId, appKey, library = '1') {
        return await this.post('/proxy/balance', {
            app_id: appId,
            app_key: appKey,
            library,
        });
    }
    
    /**
     * 查询库存
     */
    async checkStock(commodityId, library = '1') {
        return await this.get('/proxy/stock', {
            commodity_id: commodityId,
            library,
        });
    }
    
    /**
     * 购买邮箱
     */
    async purchaseEmails(appId, appKey, commodityId, num, library = '1') {
        return await this.post('/proxy/purchase', {
            app_id: appId,
            app_key: appKey,
            commodity_id: commodityId,
            num,
            library,
        });
    }
}

// 创建默认API客户端实例
const apiClient = new ApiClient(API_CONFIG.BASE_URL);

// 导出
export { HttpClient, ApiClient };
export default apiClient;

