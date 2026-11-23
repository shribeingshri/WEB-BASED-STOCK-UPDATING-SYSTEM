const asyncHandler = require('../utils/asyncHandler');
const categoryService = require('../services/categoryService');
const { requireFields } = require('../middleware/validate');

const list = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories();
  res.json({ success: true, data: categories });
});

const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name']);
  const category = await categoryService.createCategory(req.body, req.user, req.ip);
  res.status(201).json({ success: true, message: 'Category created successfully.', data: category });
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, message: 'Category updated successfully.', data: category });
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id, req.user, req.ip);
  res.json({ success: true, message: 'Category deleted successfully.' });
});

module.exports = { list, create, update, remove };

