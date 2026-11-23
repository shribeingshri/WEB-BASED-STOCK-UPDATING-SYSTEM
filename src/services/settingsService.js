const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');
const { logAudit } = require('./auditService');

async function getSettings() {
  if (isDemoMode()) {
    return { ...store.app_settings };
  }

  const [rows] = await pool.query('SELECT setting_key, setting_value FROM app_settings');
  const settings = {};
  for (const row of rows) {
    try {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    } catch {
      settings[row.setting_key] = row.setting_value;
    }
  }
  return settings;
}

async function updateSettings(updates, actor, ipAddress) {
  const allowedKeys = ['company_name', 'currency_symbol', 'default_min_stock', 'available_units'];

  if (isDemoMode()) {
    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        store.app_settings[key] = updates[key];
      }
    }
    await logAudit({
      userId: actor.id,
      action: 'UPDATE_SETTINGS',
      entityType: 'SETTINGS',
      description: 'Updated application configuration settings.',
      ipAddress,
    });
    return getSettings();
  }

  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      const valueStr = typeof updates[key] === 'string' ? updates[key] : JSON.stringify(updates[key]);
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, valueStr]
      );
    }
  }

  await logAudit({
    userId: actor.id,
    action: 'UPDATE_SETTINGS',
    entityType: 'SETTINGS',
    description: 'Updated application configuration settings.',
    ipAddress,
  });

  return getSettings();
}

module.exports = { getSettings, updateSettings };
