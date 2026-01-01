/**
 * 代理控制器 - 处理外部API代理请求
 */

const proxyService = require('../services/proxy.service');
const config = require('../config');
const logger = require('../utils/logger');

class ProxyController {
    /**
     * 查询余额
     * ⚠️ 安全改进：API 凭证从后端配置读取，不再从前端传递
     */
    async checkBalance(req, res) {
        try {
            const { library = '1' } = req.body;

            // 使用后端配置的凭证
            const { appId, appKey } = config.purchaseCredentials;
            const data = await proxyService.checkBalance(appId, appKey, library);

            res.json(data);
        } catch (error) {
            logger.error('查询余额失败', { error: error.message, library: req.body.library });

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
            logger.error('查询库存失败', { error: error.message, commodity_id: req.query.commodity_id });

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
     * ⚠️ 安全改进：API 凭证从后端配置读取，不再从前端传递
     */
    async purchaseEmails(req, res) {
        try {
            const { commodity_id, num, library = '1' } = req.body;

            // 使用后端配置的凭证
            const { appId, appKey } = config.purchaseCredentials;
            const data = await proxyService.purchaseEmails(appId, appKey, commodity_id, num, library);

            res.json(data);
        } catch (error) {
            logger.error('购买邮箱失败', {
                error: error.message,
                commodity_id: req.body.commodity_id,
                num: req.body.num
            });

            const status = error.message.includes('缺少') ? 400 :
                          error.message.includes('无效') ? 400 : 500;

            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * 获取邮箱邮件列表
     * ⚠️ 安全改进：API 密码从后端配置读取，不再从前端传递
     */
    async getMailboxEmails(req, res) {
        try {
            const { refresh_token, client_id, email, folder = 'inbox' } = req.query;

            // 验证必填字段
            if (!refresh_token || !client_id || !email) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要的邮箱参数',
                });
            }

            const mailbox = { refresh_token, client_id, email };
            const data = await proxyService.getMailboxEmails(mailbox, folder);

            res.json(data);
        } catch (error) {
            logger.error('获取邮件列表失败', {
                error: error.message,
                email: req.query.email,
                folder: req.query.folder
            });

            const status = error.message.includes('缺少') || error.message.includes('未配置') ? 400 : 500;

            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * 处理收件箱
     * ⚠️ 安全改进：API 密码从后端配置读取，不再从前端传递
     */
    async processInbox(req, res) {
        try {
            const { refresh_token, client_id, email } = req.query;

            // 验证必填字段
            if (!refresh_token || !client_id || !email) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要的邮箱参数',
                });
            }

            const mailbox = { refresh_token, client_id, email };
            const data = await proxyService.processInbox(mailbox);

            res.json(data);
        } catch (error) {
            logger.error('处理收件箱失败', {
                error: error.message,
                email: req.query.email
            });

            const status = error.message.includes('缺少') || error.message.includes('未配置') ? 400 : 500;

            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * 处理垃圾邮件箱
     * ⚠️ 安全改进：API 密码从后端配置读取，不再从前端传递
     */
    async processJunk(req, res) {
        try {
            const { refresh_token, client_id, email } = req.query;

            // 验证必填字段
            if (!refresh_token || !client_id || !email) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要的邮箱参数',
                });
            }

            const mailbox = { refresh_token, client_id, email };
            const data = await proxyService.processJunk(mailbox);

            res.json(data);
        } catch (error) {
            logger.error('处理垃圾邮件箱失败', {
                error: error.message,
                email: req.query.email
            });

            const status = error.message.includes('缺少') || error.message.includes('未配置') ? 400 : 500;

            res.status(status).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * 获取最新邮件
     * ⚠️ 安全改进：API 密码从后端配置读取，不再从前端传递
     */
    async getNewMail(req, res) {
        try {
            const { refresh_token, client_id, email, folder = 'inbox', response_type = 'json' } = req.query;

            // 验证必填字段
            if (!refresh_token || !client_id || !email) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要的邮箱参数',
                });
            }

            const mailbox = { refresh_token, client_id, email };
            const data = await proxyService.getNewMail(mailbox, folder, response_type);

            res.json(data);
        } catch (error) {
            logger.error('获取最新邮件失败', {
                error: error.message,
                email: req.query.email,
                folder: req.query.folder
            });

            const status = error.message.includes('缺少') || error.message.includes('未配置') ? 400 : 500;

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



