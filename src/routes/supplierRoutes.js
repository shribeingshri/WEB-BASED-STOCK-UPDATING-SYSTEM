const express = require('express');
const supplierController = require('../controllers/supplierController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', supplierController.list);
router.post('/', requireRole('ADMIN'), supplierController.create);
router.put('/:id', requireRole('ADMIN'), supplierController.update);
router.delete('/:id', requireRole('ADMIN'), supplierController.remove);

module.exports = router;
