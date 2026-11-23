const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', userController.list);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.patch('/:id/status', userController.updateStatus);

module.exports = router;

