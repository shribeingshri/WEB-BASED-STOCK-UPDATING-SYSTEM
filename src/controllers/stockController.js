const asyncHandler = require('../utils/asyncHandler');
const stockService = require('../services/stockService');
const { requireFields, parsePositiveNumber, parseNonNegativeNumber } = require('../middleware/validate');

const stockIn = asyncHandler(async (req, res) => {
  requireFields(req.body, ['itemId', 'quantity']);
  const quantity = parsePositiveNumber(req.body.quantity, 'Incoming quantity');

  const result = await stockService.performStockIn(
    {
      itemId: req.body.itemId,
      quantity,
      referenceNumber: req.body.referenceNumber,
      supplierOrRecipient: req.body.supplierOrRecipient,
      reason: req.body.reason,
      notes: req.body.notes,
    },
    req.user,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: `Stock-In recorded: +${result.quantity} ${result.unit} for ${result.itemName}.`,
    data: result,
  });
});

const stockOut = asyncHandler(async (req, res) => {
  requireFields(req.body, ['itemId', 'quantity']);
  const quantity = parsePositiveNumber(req.body.quantity, 'Outgoing quantity');

  const result = await stockService.performStockOut(
    {
      itemId: req.body.itemId,
      quantity,
      referenceNumber: req.body.referenceNumber,
      supplierOrRecipient: req.body.supplierOrRecipient,
      reason: req.body.reason,
      notes: req.body.notes,
    },
    req.user,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: `Stock-Out recorded: -${result.quantity} ${result.unit} for ${result.itemName}.`,
    data: result,
  });
});

const adjustStock = asyncHandler(async (req, res) => {
  requireFields(req.body, ['itemId', 'newQuantity', 'reason']);
  const newQuantity = parseNonNegativeNumber(req.body.newQuantity, 'New quantity');

  const result = await stockService.performStockAdjustment(
    {
      itemId: req.body.itemId,
      newQuantity,
      reason: req.body.reason,
      notes: req.body.notes,
      relatedTransactionId: req.body.relatedTransactionId,
    },
    req.user,
    req.ip
  );

  res.status(201).json({
    success: true,
    message: 'Stock adjustment recorded successfully.',
    data: result,
  });
});

const listTransactions = asyncHandler(async (req, res) => {
  const result = await stockService.listTransactions({
    search: req.query.search || '',
    type: req.query.type || '',
    itemId: req.query.itemId || '',
    userId: req.query.userId || '',
    startDate: req.query.startDate || '',
    endDate: req.query.endDate || '',
    page: Math.max(1, parseInt(req.query.page || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10))),
    actor: req.user,
  });
  res.json({ success: true, ...result });
});

const listItemTransactions = asyncHandler(async (req, res) => {
  const result = await stockService.listTransactions({
    itemId: req.params.id,
    page: Math.max(1, parseInt(req.query.page || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10))),
    actor: req.user,
  });
  res.json({ success: true, ...result });
});

module.exports = {
  stockIn,
  stockOut,
  adjustStock,
  listTransactions,
  listItemTransactions,
};
