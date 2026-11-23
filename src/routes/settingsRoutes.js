const express = require('express');
const settingsController = require('../controllers/settingsController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/', requireRole('ADMIN'), settingsController.updateSettings);
router.get('/audit-logs', requireRole('ADMIN'), settingsController.getAuditLogs);

module.exports = router;

