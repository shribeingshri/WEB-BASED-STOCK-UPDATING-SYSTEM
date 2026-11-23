const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboardService');

const summary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary();
  res.json({ success: true, data });
});

const stockMovement = asyncHandler(async (req, res) => {
  const period = req.query.period || 'daily';
  const data = await dashboardService.getStockMovement(period);
  res.json({ success: true, data });
});

const recentTransactions = asyncHandler(async (req, res) => {
  const data = await dashboardService.getRecentTransactions(req.query.limit || 8, req.user);
  res.json({ success: true, data });
});

const lowStock = asyncHandler(async (req, res) => {
  const data = await dashboardService.getLowStockOverview(req.query.limit || 8);
  res.json({ success: true, data });
});

module.exports = { summary, stockMovement, recentTransactions, lowStock };

