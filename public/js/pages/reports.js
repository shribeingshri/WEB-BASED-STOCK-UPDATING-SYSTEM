(() => {
  async function render(container) {
    const categories = App.state.categories || [];
    const [itemsRes, usersRes] = await Promise.all([
      API.get('/items?limit=100&sortBy=name&sortOrder=ASC'),
      API.get('/users'),
    ]);
    const items = itemsRes.data || [];
    const users = usersRes.data || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Reports &amp; Analytics</h1>
          <p class="page-subtitle">Generate filtered operational reports and export to CSV, Excel, or PDF.</p>
        </div>
        <div class="page-actions">
          <button class="btn" id="expCsvBtn"><i data-lucide="file-text"></i>CSV</button>
          <button class="btn" id="expExcelBtn"><i data-lucide="file-spreadsheet"></i>Excel</button>
          <button class="btn btn-primary" id="expPdfBtn"><i data-lucide="file-down"></i>PDF</button>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="toolbar-group">
            <select class="select" id="repType">
              <option value="inventory">Current Inventory Report</option>
              <option value="stock-in">Stock-In Report</option>
              <option value="stock-out">Stock-Out Report</option>
              <option value="low-stock">Low-Stock Report</option>
              <option value="movements">Stock Movement Summary</option>
            </select>
            <select class="select" id="repCategory">
              <option value="">All Categories</option>
              ${categories.map((c) => `<option value="${c.id}">${UI.esc(c.name)}</option>`).join('')}
            </select>
            <select class="select" id="repItem">
              <option value="">All Products</option>
              ${items.map((i) => `<option value="${i.id}">${UI.esc(i.name)} (${UI.esc(i.sku)})</option>`).join('')}
            </select>
            <select class="select" id="repUser">
              <option value="">All Users</option>
              ${users.map((u) => `<option value="${u.id}">${UI.esc(u.name)}</option>`).join('')}
            </select>
            <input class="input" type="date" id="repStart" title="Start Date" />
            <input class="input" type="date" id="repEnd" title="End Date" />
            <button class="btn btn-primary btn-sm" id="repRunBtn">Generate</button>
          </div>
        </div>

        <div class="table-wrap" id="repTableWrap">
          <div class="empty-state">Select a report type and click Generate.</div>
        </div>
      </div>
    `;

    UI.refreshIcons();

    function getQueryParams(format = 'json') {
      const qs = new URLSearchParams({
        categoryId: document.getElementById('repCategory').value,
        itemId: document.getElementById('repItem').value,
        userId: document.getElementById('repUser').value,
        startDate: document.getElementById('repStart').value,
        endDate: document.getElementById('repEnd').value,
        format,
      });
      return qs.toString();
    }

    async function runReport() {
      const type = document.getElementById('repType').value;
      const res = await API.get(`/reports/${type}?${getQueryParams('json')}`);
      const cols = res.columns || [];
      const rows = res.data || [];
      const wrap = document.getElementById('repTableWrap');

      if (rows.length === 0) {
        wrap.innerHTML = '<div class="empty-state">No records matched the selected report filters.</div>';
        return;
      }

      wrap.innerHTML = `
        <table>
          <thead>
            <tr>${cols.map((c) => `<th>${UI.esc(c.header)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                ${cols.map((c) => {
                  const v = r[c.key];
                  if (c.key === 'created_at' || c.key === 'updated_at') {
                    return `<td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(v)}</td>`;
                  }
                  return `<td>${UI.esc(v ?? '—')}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    function downloadReport(format) {
      const type = document.getElementById('repType').value;
      const url = `/api/reports/${type}?${getQueryParams(format)}`;
      window.open(url, '_blank');
    }

    document.getElementById('repRunBtn').addEventListener('click', runReport);
    document.getElementById('repType').addEventListener('change', runReport);
    document.getElementById('expCsvBtn').addEventListener('click', () => downloadReport('csv'));
    document.getElementById('expExcelBtn').addEventListener('click', () => downloadReport('xlsx'));
    document.getElementById('expPdfBtn').addEventListener('click', () => downloadReport('pdf'));

    await runReport();
  }

  App.registerPage('reports', render);
})();
