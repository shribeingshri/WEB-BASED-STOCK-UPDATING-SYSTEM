const asyncHandler = require('../utils/asyncHandler');
const itemService = require('../services/itemService');
const { requireFields } = require('../middleware/validate');

const list = asyncHandler(async (req, res) => {
  const result = await itemService.listItems({
    search: req.query.search || '',
    categoryId: req.query.categoryId || '',
    stockStatus: req.query.stockStatus || '',
    includeArchived: req.query.includeArchived === 'true',
    sortBy: req.query.sortBy || 'updated_at',
    sortOrder: req.query.sortOrder || 'DESC',
    page: Math.max(1, parseInt(req.query.page || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10))),
  });
  res.json({ success: true, ...result });
});

const getById = asyncHandler(async (req, res) => {
  const item = await itemService.getItemById(req.params.id);
  res.json({ success: true, data: item });
});

const getQrCode = asyncHandler(async (req, res) => {
  const qr = await itemService.getItemQrCode(req.params.id);
  res.json({ success: true, data: qr });
});

const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['sku', 'name', 'category_id', 'unit']);
  const item = await itemService.createItem(req.body, req.user, req.ip);
  res.status(201).json({ success: true, message: 'Product added successfully.', data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await itemService.updateItem(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, message: 'Product updated successfully.', data: item });
});

const remove = asyncHandler(async (req, res) => {
  const result = await itemService.archiveOrDeleteItem(req.params.id, req.user, req.ip);
  res.json({
    success: true,
    message: result.archived
      ? 'Product archived to preserve transaction history.'
      : 'Product deleted permanently.',
    data: result,
  });
});

module.exports = { list, getById, getQrCode, create, update, remove };

