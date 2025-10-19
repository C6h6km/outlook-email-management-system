/**
 * 邮箱路由
 */

const express = require('express');
const mailboxController = require('../controllers/mailbox.controller');

const router = express.Router();

// 获取所有邮箱
router.get('/', (req, res) => mailboxController.getAll(req, res));

// 获取单个邮箱
router.get('/:id', (req, res) => mailboxController.getById(req, res));

// 添加单个邮箱
router.post('/', (req, res) => mailboxController.create(req, res));

// 批量添加邮箱
router.post('/batch', (req, res) => mailboxController.createBatch(req, res));

// 更新邮箱
router.put('/:id', (req, res) => mailboxController.update(req, res));

// 删除邮箱
router.delete('/:id', (req, res) => mailboxController.delete(req, res));

// 获取统计信息
router.get('/stats/summary', (req, res) => mailboxController.getStatistics(req, res));

module.exports = router;



