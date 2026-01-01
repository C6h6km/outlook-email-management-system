/**
 * 代理服务层 - 处理外部API请求
 */

// Node.js 18+ 内置fetch，无需导入
// const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = require('../config');
const logger = require('../utils/logger');

class ProxyService {
    constructor() {
        this.libraries = config.purchaseLibraries;
        this.mailApiBaseUrl = config.externalMailApi.baseUrl;
        this.mailApiPassword = config.externalMailApi.password;
    }
    
    /**
     * 获取仓库URL
     */
    getLibraryUrl(library = '1') {
        const baseUrl = this.libraries[library];
        
        if (!baseUrl) {
            throw new Error('无效的库选择');
        }
        
        return baseUrl;
    }
    
    /**
     * 发送请求到外部API
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);

            // 检查 HTTP 状态码
            if (!response.ok) {
                // 尝试读取错误信息
                let errorMessage = `HTTP ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.message || errorData.error) {
                        errorMessage += `: ${errorData.message || errorData.error}`;
                    }
                } catch {
                    // JSON 解析失败，使用默认错误消息
                }
                const err = new Error(errorMessage);
                err.status = response.status;
                throw err;
            }

            // 检查 Content-Type，避免解析 HTML 为 JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`服务器返回了非 JSON 响应: ${contentType || 'unknown'}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            const err = new Error(`请求失败: ${error.message}`);
            if (error.status) err.status = error.status;
            throw err;
        }
    }
    
    /**
     * 查询账户余额
     */
    async checkBalance(appId, appKey, library = '1') {
        if (!appId || !appKey) {
            throw new Error('缺少必要参数');
        }
        
        const baseUrl = this.getLibraryUrl(library);
        const params = new URLSearchParams({
            app_id: appId,
            app_key: appKey,
        });
        
        const url = `${baseUrl}/login.php`;
        const data = await this.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        
        return data;
    }
    
    /**
     * 查询商品库存
     */
    async checkStock(commodityId, library = '1') {
        if (!commodityId) {
            throw new Error('缺少商品ID');
        }
        
        const baseUrl = this.getLibraryUrl(library);
        const url = `${baseUrl}/getStock.php?commodity_id=${commodityId}`;
        
        const data = await this.request(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });
        
        return data;
    }
    
    /**
     * 购买邮箱
     */
    async purchaseEmails(appId, appKey, commodityId, num, library = '1') {
        if (!appId || !appKey || !commodityId || !num) {
            throw new Error('缺少必要参数');
        }
        
        const baseUrl = this.getLibraryUrl(library);
        const params = new URLSearchParams({
            app_id: appId,
            app_key: appKey,
            commodity_id: commodityId,
            num: num.toString(),
        });
        
        const url = `${baseUrl}/getEmail.php`;
        const data = await this.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        return data;
    }

    /**
     * 构建邮件 API URL
     * @private
     */
    _buildMailApiUrl(endpoint, mailbox, extraParams = {}) {
        if (!this.mailApiBaseUrl) {
            throw new Error('未配置外部邮件 API 地址（EXTERNAL_MAIL_API_URL）');
        }

        // 验证必填字段
        const required = ['refresh_token', 'client_id', 'email'];
        for (const field of required) {
            if (!mailbox[field]) {
                throw new Error(`邮箱缺少必要字段: ${field}`);
            }
        }

        const params = new URLSearchParams({
            refresh_token: mailbox.refresh_token,
            client_id: mailbox.client_id,
            email: mailbox.email,
            ...extraParams
        });

        // 从后端配置添加密码（如果已配置）
        if (this.mailApiPassword) {
            params.append('password', this.mailApiPassword);
        }

        return `${this.mailApiBaseUrl}${endpoint}?${params.toString()}`;
    }

    /**
     * 获取邮箱所有邮件
     * @param {object} mailbox - 邮箱对象 { refresh_token, client_id, email }
     * @param {string} folder - 文件夹名称（如 'inbox', 'junk'）
     */
    async getMailboxEmails(mailbox, folder = 'inbox') {
        const url = this._buildMailApiUrl('/mail-all', mailbox, { mailbox: folder });

        logger.info('[Mail API] 获取邮件列表', {
            email: mailbox.email,
            folder
        });

        const data = await this.request(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        logger.info('[Mail API] 成功获取邮件', {
            email: mailbox.email,
            count: Array.isArray(data) ? data.length : (data.data?.length || 0)
        });

        return data;
    }

    /**
     * 处理收件箱
     * @param {object} mailbox - 邮箱对象 { refresh_token, client_id, email }
     */
    async processInbox(mailbox) {
        const url = this._buildMailApiUrl('/process-inbox', mailbox);

        logger.info('[Mail API] 处理收件箱', { email: mailbox.email });

        const data = await this.request(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        logger.info('[Mail API] 收件箱处理完成', {
            email: mailbox.email,
            result: data
        });

        return data;
    }

    /**
     * 处理垃圾邮件箱
     * @param {object} mailbox - 邮箱对象 { refresh_token, client_id, email }
     */
    async processJunk(mailbox) {
        const url = this._buildMailApiUrl('/process-junk', mailbox);

        logger.info('[Mail API] 处理垃圾邮件箱', { email: mailbox.email });

        const data = await this.request(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        logger.info('[Mail API] 垃圾邮件箱处理完成', {
            email: mailbox.email,
            result: data
        });

        return data;
    }

    /**
     * 获取最新邮件
     * @param {object} mailbox - 邮箱对象 { refresh_token, client_id, email }
     * @param {string} folder - 文件夹名称（如 'inbox', 'junk'）
     * @param {string} responseType - 响应类型
     */
    async getNewMail(mailbox, folder = 'inbox', responseType = 'json') {
        const url = this._buildMailApiUrl('/mail-new', mailbox, {
            mailbox: folder,
            response_type: responseType
        });

        logger.info('[Mail API] 获取最新邮件', {
            email: mailbox.email,
            folder,
            responseType
        });

        const data = await this.request(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        logger.info('[Mail API] 成功获取最新邮件', {
            email: mailbox.email,
            result: data
        });

        return data;
    }
}

// 创建单例
const proxyService = new ProxyService();

module.exports = proxyService;
