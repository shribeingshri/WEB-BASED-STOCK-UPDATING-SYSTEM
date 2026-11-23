const express = require('express');
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/inventory', reportController.getReport('inventory'));
router.get('/stock-in', reportController.getReport('stock-in'));
router.get('/stock-out', reportController.getReport('stock-out'));
router.get('/low-stock', reportController.getReport('low-stock'));
router.get('/movements', reportController.getReport('movements'));

module.exports = router;

