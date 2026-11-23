(() => {
  let movementChart = null;
  let categoryChart = null;
  let statusChart = null;

  async function loadMovementChart(period) {
    const res = await API.get(`/dashboard/stock-movement?period=${period}`);
    const rows = res.data || [];
    const labels = rows.map((r) => r.period_label);
    const inData = rows.map((r) => Number(r.stock_in));
    const outData = rows.map((r) => Number(r.stock_out));

    const ctx = document.getElementById('movementChart');
    if (!ctx) return;

    if (movementChart) movementChart.destroy();
    movementChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [
          {
            label: 'Stock In',
            data: inData.length ? inData : [0],
            backgroundColor: '#2563eb',
            borderRadius: 4,
          },
          {
            label: 'Stock Out',
            data: outData.length ? outData : [0],
            backgroundColor: '#94a3b8',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', align: 'end' } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Inventory Overview</h1>
          <p class="page-subtitle">Real-time stock metrics, movement analytics, and alerts for Buildmore Ventures LLP.</p>
        </div>
        <div class="page-actions">
          <button class="btn" id="quickStockInBtn"><i data-lucide="arrow-down-left"></i>Stock In</button>
          <button class="btn btn-primary" id="quickStockOutBtn"><i data-lucide="arrow-up-right"></i>Stock Out</button>
        </div>
      </div>

      <div id="kpiGrid" class="kpi-grid">
        <div class="kpi-card"><div class="kpi-head">Loading metrics...</div></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Stock Movement</h2>
            <div class="segmented" id="movementPeriodTabs">
              <button type="button" class="active" data-period="daily">Daily</button>
              <button type="button" data-period="weekly">Weekly</button>
              <button type="button" data-period="monthly">Monthly</button>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-box"><canvas id="movementChart"></canvas></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Stock Health Overview</h2>
          </div>
          <div class="card-body">
            <div class="chart-box"><canvas id="statusChart"></canvas></div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Transactions</h2>
            <button class="btn btn-sm" id="ovViewTxBtn">View all</button>
          </div>
          <div class="table-wrap" id="ovRecentTx"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Inventory by Category</h2>
          </div>
          <div class="card-body">
            <div class="chart-box" style="height:220px;"><canvas id="categoryChart"></canvas></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Low-Stock &amp; Out-of-Stock Items</h2>
          <button class="btn btn-sm" id="ovViewAlertsBtn">Manage alerts</button>
        </div>
        <div class="table-wrap" id="ovLowStock"></div>
      </div>
    `;

    UI.refreshIcons();

    document.getElementById('quickStockInBtn').onclick = () => App.navigate('stock-in');
    document.getElementById('quickStockOutBtn').onclick = () => App.navigate('stock-out');
    document.getElementById('ovViewTxBtn').onclick = () => App.navigate('transactions');
    document.getElementById('ovViewAlertsBtn').onclick = () => App.navigate('alerts');

    document.querySelectorAll('#movementPeriodTabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#movementPeriodTabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        loadMovementChart(btn.dataset.period);
      });
    });

    try {
      const [sumRes, txRes, lowRes] = await Promise.all([
        API.get('/dashboard/summary'),
        API.get('/dashboard/recent-transactions?limit=7'),
        API.get('/dashboard/low-stock?limit=6'),
      ]);

      const s = sumRes.data;
      const currency = App.state.settings.currency_symbol || '₹';

      document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
          <div class="kpi-head"><span>Total Products</span><i data-lucide="package"></i></div>
          <div class="kpi-value">${UI.formatNumber(s.totalProducts)}</div>
          <div class="kpi-foot">${UI.formatNumber(s.inStockItems)} healthy in stock</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-head"><span>Total Stock Units</span><i data-lucide="layers"></i></div>
          <div class="kpi-value">${UI.formatNumber(s.totalStockQuantity)}</div>
          <div class="kpi-foot">Across all active SKUs</div>
        </div>
        ${s.valuedItemsCount > 0 ? `
        <div class="kpi-card">
          <div class="kpi-head"><span>Inventory Value</span><i data-lucide="indian-rupee"></i></div>
          <div class="kpi-value">${UI.formatCurrency(s.totalInventoryValue, currency)}</div>
          <div class="kpi-foot">Based on ${s.valuedItemsCount} costed items</div>
        </div>` : ''}
        <div class="kpi-card">
          <div class="kpi-head"><span>Low Stock Items</span><i data-lucide="alert-triangle"></i></div>
          <div class="kpi-value" style="color:var(--warning);">${UI.formatNumber(s.lowStockItems)}</div>
          <div class="kpi-foot">At or below min threshold</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-head"><span>Out of Stock</span><i data-lucide="x-circle"></i></div>
          <div class="kpi-value" style="color:var(--danger);">${UI.formatNumber(s.outOfStockItems)}</div>
          <div class="kpi-foot">Requires immediate reorder</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-head"><span>Stock-In Today</span><i data-lucide="arrow-down-left"></i></div>
          <div class="kpi-value">${UI.formatNumber(s.stockInTodayCount)}</div>
          <div class="kpi-foot">+${UI.formatNumber(s.stockInTodayQty)} units received</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-head"><span>Stock-Out Today</span><i data-lucide="arrow-up-right"></i></div>
          <div class="kpi-value">${UI.formatNumber(s.stockOutTodayCount)}</div>
          <div class="kpi-foot">-${UI.formatNumber(s.stockOutTodayQty)} units issued</div>
        </div>
      `;

      // Status Doughnut Chart
      const statusCtx = document.getElementById('statusChart');
      if (statusCtx) {
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: ['In Stock', 'Low Stock', 'Out of Stock'],
            datasets: [{
              data: [s.inStockItems, s.lowStockItems, s.outOfStockItems],
              backgroundColor: ['#059669', '#d97706', '#dc2626'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '66%',
            plugins: { legend: { position: 'bottom' } },
          },
        });
      }

      // Category Distribution Chart
      const catCtx = document.getElementById('categoryChart');
      if (catCtx) {
        if (categoryChart) categoryChart.destroy();
        const cats = s.categoryDistribution || [];
        categoryChart = new Chart(catCtx, {
          type: 'bar',
          data: {
            labels: cats.map((c) => c.name),
            datasets: [{
              label: 'Total Quantity',
              data: cats.map((c) => Number(c.total_quantity)),
              backgroundColor: '#2563eb',
              borderRadius: 4,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
              y: { grid: { display: false } },
            },
          },
        });
      }

      await loadMovementChart('daily');

      // Recent Transactions Table
      const txRows = txRes.data || [];
      document.getElementById('ovRecentTx').innerHTML = txRows.length === 0
        ? '<div class="empty-state">No stock transactions recorded yet.</div>'
        : `<table>
            <thead>
              <tr>
                <th>Txn ID</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>User</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${txRows.map((t) => `
                <tr>
                  <td class="mono">${UI.esc(t.transaction_code)}</td>
                  <td>
                    <div style="font-weight:500;">${UI.esc(t.item_name)}</div>
                    <div class="mono" style="color:var(--text-muted);">${UI.esc(t.sku)}</div>
                  </td>
                  <td>${UI.txBadge(t.transaction_type)}</td>
                  <td>${UI.formatNumber(t.quantity)} ${UI.esc(t.unit)}</td>
                  <td>${UI.esc(t.user_name)}</td>
                  <td style="color:var(--text-muted); font-size:12px;">${UI.formatDateTime(t.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;

      // Low Stock Panel
      const lowRows = lowRes.data || [];
      document.getElementById('ovLowStock').innerHTML = lowRows.length === 0
        ? '<div class="empty-state">All active inventory items are above their minimum thresholds.</div>'
        : `<table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Available</th>
                <th>Min Threshold</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${lowRows.map((item) => `
                <tr>
                  <td class="mono">${UI.esc(item.sku)}</td>
                  <td style="font-weight:500;">${UI.esc(item.name)}</td>
                  <td>${UI.esc(item.category_name)}</td>
                  <td>${UI.formatNumber(item.current_quantity)} ${UI.esc(item.unit)}</td>
                  <td>${UI.formatNumber(item.minimum_stock_level)} ${UI.esc(item.unit)}</td>
                  <td>${UI.stockBadge(item.current_quantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK')}</td>
                  <td>
                    <button class="btn btn-sm" data-restock-id="${item.id}">Restock</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;

      document.querySelectorAll('[data-restock-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          App.navigate('stock-in', { itemId: btn.dataset.restockId });
        });
      });

      UI.refreshIcons();
    } catch (err) {
      UI.toast(err.message || 'Failed to load dashboard', 'error');
    }
  }

  App.registerPage('overview', render);
})();
