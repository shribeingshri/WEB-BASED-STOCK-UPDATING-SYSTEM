const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { testConnection, enableDemoMode } = require('../src/config/db');

let server;
let baseUrl;

test.before(async () => {
  try {
    await testConnection();
  } catch {
    enableDemoMode();
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/health returns 200 ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.status, 'ok');
});

test('Unauthenticated access to protected routes returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/items`);
  assert.equal(res.status, 401);
});

test('Full authenticated inventory, stock-in/out, and concurrency workflow', async () => {
  // 1. Login as Admin
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@buildmoreventures.in', password: 'Admin@123' }),
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 2. Get categories
  const catRes = await fetch(`${baseUrl}/api/categories`, { headers: { Cookie: cookie } });
  const catBody = await catRes.json();
  assert.ok(catBody.data.length > 0);
  const categoryId = catBody.data[0].id;

  // 3. Create unique test item
  const sku = `TEST-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      sku,
      name: 'Integration Test Item',
      category_id: categoryId,
      unit: 'Units',
      opening_quantity: 50,
      minimum_stock_level: 10,
    }),
  });
  assert.equal(createRes.status, 201);
  const createdItem = (await createRes.json()).data;

  // 4. Stock-Out exceeding balance must fail with 400
  const badOutRes = await fetch(`${baseUrl}/api/stock/out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ itemId: createdItem.id, quantity: 60, reason: 'Over-issue test' }),
  });
  assert.equal(badOutRes.status, 400);

  // 5. Concurrent Stock-Out (two parallel requests of 30 each on 50 available -> only 1 succeeds!)
  const [r1, r2] = await Promise.all([
    fetch(`${baseUrl}/api/stock/out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ itemId: createdItem.id, quantity: 30, reason: 'Concurrent 1' }),
    }),
    fetch(`${baseUrl}/api/stock/out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ itemId: createdItem.id, quantity: 30, reason: 'Concurrent 2' }),
    }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 400]);

  // 6. Verify final balance is 20 (never negative)
  const itemCheck = await fetch(`${baseUrl}/api/items/${createdItem.id}`, { headers: { Cookie: cookie } });
  const itemData = (await itemCheck.json()).data;
  assert.equal(Number(itemData.current_quantity), 20);

  // 7. Verify QR code, dashboard, alerts, reports (JSON/CSV/XLSX/PDF), users, settings, audit logs
  const endpoints = [
    `/api/items/${createdItem.id}/qr`,
    `/api/items/${createdItem.id}/transactions`,
    '/api/dashboard/summary',
    '/api/dashboard/stock-movement?period=daily',
    '/api/dashboard/stock-movement?period=weekly',
    '/api/dashboard/stock-movement?period=monthly',
    '/api/dashboard/recent-transactions',
    '/api/dashboard/low-stock',
    '/api/alerts?status=ALL',
    '/api/stock/transactions',
    '/api/users',
    '/api/suppliers',
    '/api/settings',
    '/api/settings/audit-logs',
    '/api/reports/inventory?format=json',
    '/api/reports/inventory?format=csv',
    '/api/reports/inventory?format=xlsx',
    '/api/reports/inventory?format=pdf',
    '/api/reports/stock-in?format=json',
    '/api/reports/stock-out?format=json',
    '/api/reports/low-stock?format=json',
    '/api/reports/movements?format=json',
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${baseUrl}${ep}`, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200, `Expected 200 for ${ep}, got ${res.status}`);
  }

  // 8. Staff RBAC check: Staff cannot access /api/users or /api/reports/inventory
  const staffLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'staff@buildmoreventures.in', password: 'Staff@123' }),
  });
  assert.equal(staffLogin.status, 200);
  const staffCookie = staffLogin.headers.get('set-cookie').split(';')[0];

  const staffUsersRes = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: staffCookie } });
  assert.equal(staffUsersRes.status, 403);
  const staffReportsRes = await fetch(`${baseUrl}/api/reports/inventory`, { headers: { Cookie: staffCookie } });
  assert.equal(staffReportsRes.status, 403);
});
