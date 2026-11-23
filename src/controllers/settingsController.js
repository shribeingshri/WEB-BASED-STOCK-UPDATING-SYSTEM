const asyncHandler = require('../utils/asyncHandler');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  res.json({ success: true, data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.user, req.ip);
  res.json({ success: true, message: 'Settings updated successfully.', data: settings });
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await auditService.getAuditLogs({
    page: Math.max(1, parseInt(req.query.page || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10))),
    entityType: req.query.entityType || '',
  });
  res.json({ success: true, ...result });
});

module.exports = { getSettings, updateSettings, getAuditLogs };

