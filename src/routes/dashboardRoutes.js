const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/summary', dashboardController.summary);
router.get('/stock-movement', dashboardController.stockMovement);
router.get('/recent-transactions', dashboardController.recentTransactions);
router.get('/low-stock', dashboardController.lowStock);

module.exports = router;
