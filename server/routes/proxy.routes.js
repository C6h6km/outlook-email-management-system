/**
 * 代理路由
 */

const express = require('express');
const proxyController = require('../controllers/proxy.controller');

const router = express.Router();

// 查询余额
router.post('/balance', (req, res) => proxyController.checkBalance(req, res));

// 查询库存
router.get('/stock', (req, res) => proxyController.checkStock(req, res));

// 购买邮箱
router.post('/purchase', (req, res) => proxyController.purchaseEmails(req, res));

// ==================== 邮件 API 代理 ====================
// ⚠️ 安全改进：邮件 API 密码从后端配置读取，不再从前端传递

// 获取邮箱邮件列表
router.get('/mail/emails', (req, res) => proxyController.getMailboxEmails(req, res));

// 获取最新邮件
router.get('/mail/mail-new', (req, res) => proxyController.getNewMail(req, res));

// 处理收件箱
router.get('/mail/process-inbox', (req, res) => proxyController.processInbox(req, res));

// 处理垃圾邮件箱
router.get('/mail/process-junk', (req, res) => proxyController.processJunk(req, res));

module.exports = router;



