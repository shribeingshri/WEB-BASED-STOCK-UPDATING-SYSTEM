const { pool, isDemoMode } = require('../config/db');
const { store } = require('../config/demoStore');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('./auditService');

async function listSuppliers() {
  if (isDemoMode()) {
    return [...store.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
  return rows;
}

async function createSupplier({ name, contact_person, phone, email, address }, actor, ipAddress) {
  if (isDemoMode()) {
    const sup = {
      id: store.seq.suppliers++,
      name: name.trim(),
      contact_person: contact_person || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      created_at: new Date().toISOString(),
    };
    store.suppliers.push(sup);
    await logAudit({
      userId: actor.id,
      action: 'CREATE_SUPPLIER',
      entityType: 'SUPPLIER',
      entityId: sup.id,
      description: `Created supplier "${sup.name}".`,
      ipAddress,
    });
    return sup;
  }

  const [result] = await pool.query(
    `INSERT INTO suppliers (name, contact_person, phone, email, address)
     VALUES (?, ?, ?, ?, ?)`,
    [name.trim(), contact_person || null, phone || null, email || null, address || null]
  );

  await logAudit({
    userId: actor.id,
    action: 'CREATE_SUPPLIER',
    entityType: 'SUPPLIER',
    entityId: result.insertId,
    description: `Created supplier "${name.trim()}".`,
    ipAddress,
  });

  const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function updateSupplier(id, data, actor, ipAddress) {
  if (isDemoMode()) {
    const sup = store.suppliers.find((s) => s.id === Number(id));
    if (!sup) throw new ApiError(404, 'Supplier not found.');
    if (data.name) sup.name = data.name.trim();
    if (data.contact_person !== undefined) sup.contact_person = data.contact_person;
    if (data.phone !== undefined) sup.phone = data.phone;
    if (data.email !== undefined) sup.email = data.email;
    if (data.address !== undefined) sup.address = data.address;
    await logAudit({
      userId: actor.id,
      action: 'UPDATE_SUPPLIER',
      entityType: 'SUPPLIER',
      entityId: id,
      description: `Updated supplier #${id}.`,
      ipAddress,
    });
    return sup;
  }

  const [existing] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
  if (!existing[0]) {
    throw new ApiError(404, 'Supplier not found.');
  }
  const s = existing[0];
  await pool.query(
    `UPDATE suppliers
     SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?
     WHERE id = ?`,
    [
      data.name ? data.name.trim() : s.name,
      data.contact_person !== undefined ? data.contact_person : s.contact_person,
      data.phone !== undefined ? data.phone : s.phone,
      data.email !== undefined ? data.email : s.email,
      data.address !== undefined ? data.address : s.address,
      id,
    ]
  );

  await logAudit({
    userId: actor.id,
    action: 'UPDATE_SUPPLIER',
    entityType: 'SUPPLIER',
    entityId: id,
    description: `Updated supplier #${id}.`,
    ipAddress,
  });

  const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
  return rows[0];
}

async function deleteSupplier(id, actor, ipAddress) {
  if (isDemoMode()) {
    const idx = store.suppliers.findIndex((s) => s.id === Number(id));
    if (idx === -1) throw new ApiError(404, 'Supplier not found.');
    store.suppliers.splice(idx, 1);
  } else {
    const [result] = await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Supplier not found.');
    }
  }

  await logAudit({
    userId: actor.id,
    action: 'DELETE_SUPPLIER',
    entityType: 'SUPPLIER',
    entityId: id,
    description: `Deleted supplier #${id}.`,
    ipAddress,
  });

  return { id: Number(id) };
}

module.exports = {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
