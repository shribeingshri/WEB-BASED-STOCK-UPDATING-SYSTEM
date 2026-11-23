const express = require('express');
const alertController = require('../controllers/alertController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', alertController.list);
router.patch('/:id/resolve', requireRole('ADMIN'), alertController.resolve);

module.exports = router;

