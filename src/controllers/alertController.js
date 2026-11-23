const asyncHandler = require('../utils/asyncHandler');
const alertService = require('../services/alertService');

const list = asyncHandler(async (req, res) => {
  const alerts = await alertService.listAlerts({
    status: req.query.status || 'ACTIVE',
    alertType: req.query.alertType || '',
  });
  res.json({ success: true, data: alerts });
});

const resolve = asyncHandler(async (req, res) => {
  const result = await alertService.resolveAlert(req.params.id);
  res.json({ success: true, message: 'Alert marked as resolved.', data: result });
});

module.exports = { list, resolve };
