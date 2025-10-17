/**
 * 代理服务层 - 处理外部API请求
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = require('../config');

class ProxyService {
    constructor() {
        this.libraries = config.purchaseLibraries;
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
            const data = await response.json();
            return data;
        } catch (error) {
            throw new Error(`请求失败: ${error.message}`);
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
}

// 创建单例
const proxyService = new ProxyService();

module.exports = proxyService;

