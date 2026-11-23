const express = require('express');
const categoryController = require('../controllers/categoryController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', categoryController.list);
router.post('/', requireRole('ADMIN'), categoryController.create);
router.put('/:id', requireRole('ADMIN'), categoryController.update);
router.delete('/:id', requireRole('ADMIN'), categoryController.remove);

module.exports = router;

