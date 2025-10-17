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

module.exports = router;

