/**
 * 邮箱控制器 - 处理HTTP请求和响应
 */

const mailboxService = require('../services/mailbox.service');

class MailboxController {
    /**
     * 获取所有邮箱
     */
    async getAll(req, res) {
        try {
            const mailboxes = await mailboxService.getAllMailboxes();
            
            res.json({
                success: true,
                data: mailboxes,
            });
        } catch (error) {
            console.error('获取邮箱列表失败:', error);
            res.status(500).json({
                success: false,
                error: '获取邮箱列表失败',
                details: error.message,
            });
        }
    }
    
    /**
     * 根据ID获取邮箱
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const mailbox = await mailboxService.getMailboxById(id);
            
            if (!mailbox) {
                return res.status(404).json({
                    success: false,
                    error: '邮箱不存在',
                });
            }
            
            res.json({
                success: true,
                data: mailbox,
            });
        } catch (error) {
            console.error('获取邮箱失败:', error);
            res.status(500).json({
                success: false,
                error: '获取邮箱失败',
                details: error.message,
            });
        }
    }
    
    /**
     * 添加单个邮箱
     */
    async create(req, res) {
        try {
            const mailbox = await mailboxService.addMailbox(req.body);
            
            res.status(201).json({
                success: true,
                data: mailbox,
            });
        } catch (error) {
            console.error('添加邮箱失败:', error);
            
            const status = error.message === '邮箱已存在' ? 409 : 
                          error.message.includes('缺少') ? 400 : 500;
            
            res.status(status).json({
                success: false,
                error: '添加邮箱失败',
                details: error.message,
            });
        }
    }
    
    /**
     * 批量添加邮箱
     */
    async createBatch(req, res) {
        try {
            const { mailboxes } = req.body;
            const result = await mailboxService.addMailboxesBatch(mailboxes);
            
            res.status(201).json({
                success: true,
                ...result,
            });
        } catch (error) {
            console.error('批量添加邮箱失败:', error);
            
            const status = error.message.includes('格式错误') || 
                          error.message.includes('不完整') ? 400 : 500;
            
            res.status(status).json({
                success: false,
                error: '批量添加邮箱失败',
                details: error.message,
            });
        }
    }
    
    /**
     * 更新邮箱
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const mailbox = await mailboxService.updateMailbox(id, req.body);
            
            res.json({
                success: true,
                data: mailbox,
            });
        } catch (error) {
            console.error('更新邮箱失败:', error);
            
            const status = error.message === '邮箱不存在' ? 404 : 
                          error.message.includes('没有提供') ? 400 : 500;
            
            res.status(status).json({
                success: false,
                error: '更新邮箱失败',
                details: error.message,
            });
        }
    }
    
    /**
     * 删除邮箱（软删除）
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            await mailboxService.deleteMailbox(id);
            
            res.json({
                success: true,
                message: '邮箱删除成功',
            });
        } catch (error) {
            console.error('删除邮箱失败:', error);
            
            const status = error.message === '邮箱不存在' ? 404 : 500;
            
            res.status(status).json({
                success: false,
                error: '删除邮箱失败',
                details: error.message,
            });
        }
    }
    
    /**
     * 获取统计信息
     */
    async getStatistics(req, res) {
        try {
            const stats = await mailboxService.getStatistics();
            
            res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            console.error('获取统计信息失败:', error);
            res.status(500).json({
                success: false,
                error: '获取统计信息失败',
                details: error.message,
            });
        }
    }
}

// 创建单例
const mailboxController = new MailboxController();

module.exports = mailboxController;

