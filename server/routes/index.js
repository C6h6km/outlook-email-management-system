/**
 * 路由入口 - 统一管理所有路由
 */

const express = require('express');
const mailboxRoutes = require('./mailbox.routes');
const proxyRoutes = require('./proxy.routes');

const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// 邮箱管理路由
router.use('/mailboxes', mailboxRoutes);

// 代理路由
router.use('/proxy', proxyRoutes);

module.exports = router;



