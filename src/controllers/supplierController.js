const asyncHandler = require('../utils/asyncHandler');
const supplierService = require('../services/supplierService');
const { requireFields } = require('../middleware/validate');

const list = asyncHandler(async (req, res) => {
  const suppliers = await supplierService.listSuppliers();
  res.json({ success: true, data: suppliers });
});

const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);
  const supplier = await supplierService.createSupplier(req.body, req.user, req.ip);
  res.status(201).json({ success: true, message: 'Supplier created successfully.', data: supplier });
});

const update = asyncHandler(async (req, res) => {
  const supplier = await supplierService.updateSupplier(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, message: 'Supplier updated successfully.', data: supplier });
});

const remove = asyncHandler(async (req, res) => {
  await supplierService.deleteSupplier(req.params.id, req.user, req.ip);
  res.json({ success: true, message: 'Supplier deleted successfully.' });
});

module.exports = { list, create, update, remove };
