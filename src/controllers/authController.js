const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const { requireFields } = require('../middleware/validate');
const { logAudit } = require('../services/auditService');

const login = asyncHandler(async (req, res) => {
  requireFields(req.body, ['identifier', 'password']);
  const { identifier, password, rememberMe } = req.body;
  const result = await authService.login({
    identifier,
    password,
    rememberMe: Boolean(rememberMe),
    ipAddress: req.ip,
  });

  const maxAge = result.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  res.cookie('bm_token', result.token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  res.json({
    success: true,
    message: 'Signed in successfully.',
    user: result.user,
  });
});

const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await logAudit({
      userId: req.user.id,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      description: `${req.user.name} signed out.`,
      ipAddress: req.ip,
    });
  }

  res.clearCookie('bm_token', {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });

  res.json({ success: true, message: 'Signed out successfully.' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = { login, logout, me };

