(() => {
  let alertStatus = 'ACTIVE';
  let alertType = 'ALL';

  async function render(container) {
    const isAdmin = App.state.user?.role === 'ADMIN';

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Low Stock Alerts</h1>
          <p class="page-subtitle">Automated threshold monitoring. Alerts auto-resolve when stock is replenished.</p>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="toolbar-group">
            <select class="select" id="alStatusFilter">
              <option value="ACTIVE" ${alertStatus === 'ACTIVE' ? 'selected' : ''}>Active Alerts</option>
              <option value="RESOLVED" ${alertStatus === 'RESOLVED' ? 'selected' : ''}>Resolved History</option>
              <option value="ALL" ${alertStatus === 'ALL' ? 'selected' : ''}>All Alerts</option>
            </select>
            <select class="select" id="alTypeFilter">
              <option value="ALL" ${alertType === 'ALL' ? 'selected' : ''}>All Severities</option>
              <option value="OUT_OF_STOCK" ${alertType === 'OUT_OF_STOCK' ? 'selected' : ''}>Out of Stock</option>
              <option value="LOW_STOCK" ${alertType === 'LOW_STOCK' ? 'selected' : ''}>Low Stock</option>
            </select>
          </div>
        </div>

        <div class="table-wrap" id="alertsTableWrap">
          <div class="empty-state">Loading alerts...</div>
        </div>
      </div>
    `;

    const loadAlerts = async () => {
      const res = await API.get(`/alerts?status=${alertStatus}&alertType=${alertType}`);
      const rows = res.data || [];
      const wrap = document.getElementById('alertsTableWrap');

      if (rows.length === 0) {
        wrap.innerHTML = '<div class="empty-state">No alerts match the selected filter.</div>';
        return;
      }

      wrap.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Product</th>
              <th>Category</th>
              <th>Current Qty</th>
              <th>Min Threshold</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((a) => `
              <tr>
                <td>
                  <span class="badge ${a.alert_type === 'OUT_OF_STOCK' ? 'badge-danger' : 'badge-warning'}">
                    ${a.alert_type === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'}
                  </span>
                </td>
                <td>
                  <div style="font-weight:500;">${UI.esc(a.item_name)}</div>
                  <div class="mono" style="color:var(--text-muted);">${UI.esc(a.sku)}</div>
                </td>
                <td>${UI.esc(a.category_name)}</td>
                <td><strong>${UI.formatNumber(a.current_quantity)}</strong> ${UI.esc(a.unit)}</td>
                <td>${UI.formatNumber(a.minimum_stock_level)} ${UI.esc(a.unit)}</td>
                <td>
                  <span class="badge ${a.status === 'ACTIVE' ? 'badge-danger' : 'badge-success'}">${a.status}</span>
                </td>
                <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(a.created_at)}</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-primary" data-restock="${a.item_id}">Restock</button>
                    ${isAdmin && a.status === 'ACTIVE' ? `<button class="btn btn-sm" data-resolve="${a.id}">Resolve</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      wrap.querySelectorAll('[data-restock]').forEach((b) => {
        b.addEventListener('click', () => App.navigate('stock-in', { itemId: b.dataset.restock }));
      });
      wrap.querySelectorAll('[data-resolve]').forEach((b) => {
        b.addEventListener('click', async () => {
          await API.patch(`/alerts/${b.dataset.resolve}/resolve`, {});
          UI.toast('Alert marked as resolved.', 'success');
          App.refreshAlertsBadge();
          loadAlerts();
        });
      });
    };

    document.getElementById('alStatusFilter').addEventListener('change', (e) => {
      alertStatus = e.target.value;
      loadAlerts();
    });
    document.getElementById('alTypeFilter').addEventListener('change', (e) => {
      alertType = e.target.value;
      loadAlerts();
    });

    await loadAlerts();
  }

  App.registerPage('alerts', render);
})();

