const bcrypt = require('bcrypt');

const store = {
  initialized: false,
  seq: {
    users: 3,
    categories: 7,
    suppliers: 4,
    items: 7,
    stock_transactions: 6,
    alerts: 4,
    audit_logs: 1,
  },
  users: [],
  categories: [],
  suppliers: [],
  items: [],
  stock_transactions: [],
  alerts: [],
  audit_logs: [],
  app_settings: {
    company_name: 'Buildmore Ventures LLP',
    currency_symbol: '₹',
    default_min_stock: '10',
    available_units: ['Pieces', 'Kilograms', 'Grams', 'Litres', 'Bags', 'Boxes', 'Metres', 'Units', 'Tonnes', 'Sheets'],
  },
};

function initDemoStore() {
  if (store.initialized) return store;
  const now = new Date().toISOString();

  // Synchronous hash for instant startup in demo mode
  const adminHash = bcrypt.hashSync('Admin@123', 10);
  const staffHash = bcrypt.hashSync('Staff@123', 10);

  store.users = [
    {
      id: 1,
      name: 'Buildmore Administrator',
      username: 'admin',
      email: 'admin@buildmoreventures.in',
      password_hash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      last_login: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      name: 'Warehouse Staff',
      username: 'staff',
      email: 'staff@buildmoreventures.in',
      password_hash: staffHash,
      role: 'STAFF',
      status: 'ACTIVE',
      last_login: null,
      created_at: now,
      updated_at: now,
    },
  ];

  store.categories = [
    { id: 1, name: 'Cement & Aggregates', description: 'OPC/PPC cement, sand, gravel, and concrete mixes', created_at: now },
    { id: 2, name: 'Steel & Metals', description: 'TMT bars, structural steel, binding wire, and fasteners', created_at: now },
    { id: 3, name: 'Plumbing & Pipes', description: 'PVC, CPVC, GI pipes, valves, and fittings', created_at: now },
    { id: 4, name: 'Electrical', description: 'Cables, conduits, MCBs, switches, and lighting fixtures', created_at: now },
    { id: 5, name: 'Paints & Finishes', description: 'Primers, emulsions, waterproofing, and adhesives', created_at: now },
    { id: 6, name: 'Tools & Safety', description: 'Hand tools, power tools, helmets, gloves, and PPE', created_at: now },
  ];

  store.suppliers = [
    { id: 1, name: 'Apex Building Materials Pvt Ltd', contact_person: 'Rajesh Kumar', phone: '+91-98450-11223', email: 'sales@apexmaterials.in', address: 'Peenya Industrial Area, Bengaluru', created_at: now },
    { id: 2, name: 'Metro Steel & Hardware', contact_person: 'Suresh Nair', phone: '+91-98801-44556', email: 'orders@metrosteel.in', address: 'SP Road, Bengaluru', created_at: now },
    { id: 3, name: 'Kaveri Pipes & Fittings', contact_person: 'Anita Desai', phone: '+91-97412-77889', email: 'dispatch@kaveripipes.in', address: 'Bommasandra, Bengaluru', created_at: now },
  ];

  store.items = [
    {
      id: 1, sku: 'CEM-OPC53-50', name: 'OPC 53 Grade Cement',
      description: '50 kg high-strength Ordinary Portland Cement bag',
      category_id: 1, supplier_id: 1, unit: 'Bags',
      current_quantity: 120, minimum_stock_level: 30, unit_cost: 385,
      status: 'ACTIVE', created_at: now, updated_at: now,
    },
    {
      id: 2, sku: 'STL-TMT12-12M', name: 'TMT Steel Bar 12mm',
      description: 'Fe 550D thermo-mechanically treated steel bar (12m length)',
      category_id: 2, supplier_id: 2, unit: 'Pieces',
      current_quantity: 18, minimum_stock_level: 25, unit_cost: 640,
      status: 'ACTIVE', created_at: now, updated_at: now,
    },
    {
      id: 3, sku: 'PLB-CPVC-25', name: 'CPVC Pipe 25mm (3m)',
      description: 'SDR 11 hot and cold water plumbing pipe',
      category_id: 3, supplier_id: 3, unit: 'Metres',
      current_quantity: 240, minimum_stock_level: 60, unit_cost: 92.5,
      status: 'ACTIVE', created_at: now, updated_at: now,
    },
    {
      id: 4, sku: 'ELC-CAB-25SQ', name: 'FR PVC Insulated Copper Cable 2.5 sqmm',
      description: '90m coil flame-retardant house wiring cable',
      category_id: 4, supplier_id: 2, unit: 'Boxes',
      current_quantity: 0, minimum_stock_level: 10, unit_cost: 1850,
      status: 'ACTIVE', created_at: now, updated_at: now,
    },
    {
      id: 5, sku: 'PNT-PRM-20L', name: 'Exterior Wall Primer',
      description: 'Water-based acrylic exterior wall primer 20L bucket',
      category_id: 5, supplier_id: 1, unit: 'Litres',
      current_quantity: 80, minimum_stock_level: 40, unit_cost: 195,
      status: 'ACTIVE', created_at: now, updated_at: now,
    },
    {
      id: 6, sku: 'TLS-HLM-STD', name: 'Industrial Safety Helmet',
      description: 'HDPE ventilated construction safety helmet with ratchet',
      category_id: 6, supplier_id: 2, unit: 'Units',
      current_quantity: 12, minimum_stock_level: 15, unit_cost: 220,
      status: 'ACTIVE', created_at: now, updated_at: now,
    },
  ];

  store.stock_transactions = [
    { id: 1, transaction_code: 'IN-DEMO-0001', item_id: 1, user_id: 1, transaction_type: 'IN', quantity: 150, previous_quantity: 0, new_quantity: 150, reference_number: 'INV-2026-001', supplier_or_recipient: 'Apex Building Materials Pvt Ltd', reason: 'Opening Stock Entry', notes: 'Initial batch', related_transaction_id: null, created_at: now },
    { id: 2, transaction_code: 'OUT-DEMO-0002', item_id: 1, user_id: 2, transaction_type: 'OUT', quantity: 30, previous_quantity: 150, new_quantity: 120, reference_number: 'REQ-2026-011', supplier_or_recipient: 'Site A — Foundation', reason: 'Site Dispatch', notes: 'Concrete pouring', related_transaction_id: null, created_at: now },
    { id: 3, transaction_code: 'IN-DEMO-0003', item_id: 2, user_id: 1, transaction_type: 'IN', quantity: 18, previous_quantity: 0, new_quantity: 18, reference_number: 'INV-2026-004', supplier_or_recipient: 'Metro Steel & Hardware', reason: 'Opening Stock Entry', notes: null, related_transaction_id: null, created_at: now },
    { id: 4, transaction_code: 'IN-DEMO-0004', item_id: 3, user_id: 1, transaction_type: 'IN', quantity: 240, previous_quantity: 0, new_quantity: 240, reference_number: 'INV-2026-005', supplier_or_recipient: 'Kaveri Pipes & Fittings', reason: 'Opening Stock Entry', notes: null, related_transaction_id: null, created_at: now },
    { id: 5, transaction_code: 'IN-DEMO-0005', item_id: 5, user_id: 1, transaction_type: 'IN', quantity: 80, previous_quantity: 0, new_quantity: 80, reference_number: 'INV-2026-006', supplier_or_recipient: 'Apex Building Materials Pvt Ltd', reason: 'Opening Stock Entry', notes: null, related_transaction_id: null, created_at: now },
  ];

  store.alerts = [
    { id: 1, item_id: 4, alert_type: 'OUT_OF_STOCK', message: 'FR PVC Insulated Copper Cable 2.5 sqmm (ELC-CAB-25SQ) is out of stock (0 Boxes).', status: 'ACTIVE', created_at: now, resolved_at: null },
    { id: 2, item_id: 2, alert_type: 'LOW_STOCK', message: 'TMT Steel Bar 12mm (STL-TMT12-12M) is low on stock (18 / min 25 Pieces).', status: 'ACTIVE', created_at: now, resolved_at: null },
    { id: 3, item_id: 6, alert_type: 'LOW_STOCK', message: 'Industrial Safety Helmet (TLS-HLM-STD) is low on stock (12 / min 15 Units).', status: 'ACTIVE', created_at: now, resolved_at: null },
  ];

  store.audit_logs = [
    { id: 1, user_id: 1, action: 'SYSTEM_INIT', entity_type: 'SYSTEM', entity_id: null, description: 'Demo inventory workspace initialized for Buildmore Ventures LLP.', ip_address: '127.0.0.1', created_at: now },
  ];

  store.initialized = true;
  return store;
}

module.exports = { store, initDemoStore };
