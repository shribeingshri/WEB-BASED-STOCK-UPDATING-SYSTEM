const express = require('express');
const itemController = require('../controllers/itemController');
const stockController = require('../controllers/stockController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', itemController.list);
router.get('/:id', itemController.getById);
router.get('/:id/qr', itemController.getQrCode);
router.get('/:id/transactions', stockController.listItemTransactions);

router.post('/', requireRole('ADMIN'), itemController.create);
router.put('/:id', requireRole('ADMIN'), itemController.update);
router.delete('/:id', requireRole('ADMIN'), itemController.remove);

module.exports = router;

