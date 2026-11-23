const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');
const { requireFields } = require('../middleware/validate');

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers(req.query);
  res.json({ success: true, data: users });
});

const create = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'username', 'email', 'password', 'role']);
  const user = await userService.createUser(req.body, req.user, req.ip);
  res.status(201).json({ success: true, message: 'User created successfully.', data: user });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, message: 'User updated successfully.', data: user });
});

const updateStatus = asyncHandler(async (req, res) => {
  requireFields(req.body, ['status']);
  const result = await userService.updateUserStatus(req.params.id, req.body.status, req.user, req.ip);
  res.json({ success: true, message: `User status updated to ${result.status}.`, data: result });
});

module.exports = { list, create, update, updateStatus };
