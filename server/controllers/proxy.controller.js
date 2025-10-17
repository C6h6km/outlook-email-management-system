/**
 * 代理控制器 - 处理外部API代理请求
 */

const proxyService = require('../services/proxy.service');

class ProxyController {
    /**
     * 查询余额
     */
    async checkBalance(req, res) {
        try {
            const { app_id, app_key, library = '1' } = req.body;
            const data = await proxyService.checkBalance(app_id, app_key, library);
            
            res.json(data);
        } catch (error) {
            console.error('查询余额失败:', error);
            
            const status = error.message.includes('缺少') ? 400 :
                          error.message.includes('无效') ? 400 : 500;
            
            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }
    
    /**
     * 查询库存
     */
    async checkStock(req, res) {
        try {
            const { commodity_id, library = '1' } = req.query;
            const data = await proxyService.checkStock(commodity_id, library);
            
            res.json(data);
        } catch (error) {
            console.error('查询库存失败:', error);
            
            const status = error.message.includes('缺少') ? 400 :
                          error.message.includes('无效') ? 400 : 500;
            
            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }
    
    /**
     * 购买邮箱
     */
    async purchaseEmails(req, res) {
        try {
            const { app_id, app_key, commodity_id, num, library = '1' } = req.body;
            const data = await proxyService.purchaseEmails(app_id, app_key, commodity_id, num, library);
            
            res.json(data);
        } catch (error) {
            console.error('购买邮箱失败:', error);
            
            const status = error.message.includes('缺少') ? 400 :
                          error.message.includes('无效') ? 400 : 500;
            
            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }
}

// 创建单例
const proxyController = new ProxyController();

module.exports = proxyController;

