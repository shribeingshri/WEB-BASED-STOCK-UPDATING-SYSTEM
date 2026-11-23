const express = require('express');
const stockController = require('../controllers/stockController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.post('/in', requireRole('ADMIN', 'STAFF'), stockController.stockIn);
router.post('/out', requireRole('ADMIN', 'STAFF'), stockController.stockOut);
router.post('/adjust', requireRole('ADMIN'), stockController.adjustStock);
router.get('/transactions', stockController.listTransactions);

module.exports = router;
