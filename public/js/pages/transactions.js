(() => {
  let filters = {
    search: '',
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 20,
  };

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Transaction History &amp; Audit Ledger</h1>
          <p class="page-subtitle">Immutable log of every inventory movement across Buildmore Ventures LLP.</p>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="toolbar-group">
            <input class="input" id="txSearch" type="search" placeholder="Search txn ID, product, SKU, ref..." value="${UI.esc(filters.search)}" style="min-width:230px;" />
            <select class="select" id="txType">
              <option value="">All Types</option>
              <option value="IN" ${filters.type === 'IN' ? 'selected' : ''}>Stock In</option>
              <option value="OUT" ${filters.type === 'OUT' ? 'selected' : ''}>Stock Out</option>
              <option value="ADJUSTMENT" ${filters.type === 'ADJUSTMENT' ? 'selected' : ''}>Adjustment</option>
            </select>
            <input class="input" type="date" id="txStart" value="${UI.esc(filters.startDate)}" />
            <input class="input" type="date" id="txEnd" value="${UI.esc(filters.endDate)}" />
            <button class="btn btn-sm" id="txClear">Clear</button>
          </div>
        </div>

        <div class="table-wrap" id="txTableWrap">
          <div class="empty-state">Loading transactions...</div>
        </div>
        <div class="pagination" id="txPagination"></div>
      </div>
    `;

    const loadTable = async () => {
      const qs = new URLSearchParams({
        search: filters.search,
        type: filters.type,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: filters.page,
        limit: filters.limit,
      });

      const res = await API.get(`/stock/transactions?${qs.toString()}`);
      const rows = res.data || [];
      const pg = res.pagination;

      const wrap = document.getElementById('txTableWrap');
      if (rows.length === 0) {
        wrap.innerHTML = '<div class="empty-state">No transactions found for the selected filters.</div>';
      } else {
        wrap.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Txn ID</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Prev &rarr; New</th>
                <th>Reference</th>
                <th>Party / Dept</th>
                <th>Performed By</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((t) => `
                <tr>
                  <td class="mono">${UI.esc(t.transaction_code)}</td>
                  <td>
                    <div style="font-weight:500;">${UI.esc(t.item_name)}</div>
                    <div class="mono" style="color:var(--text-muted);">${UI.esc(t.sku)}</div>
                  </td>
                  <td>${UI.txBadge(t.transaction_type)}</td>
                  <td><strong>${UI.formatNumber(t.quantity)}</strong> ${UI.esc(t.unit)}</td>
                  <td class="mono">${UI.formatNumber(t.previous_quantity)} &rarr; ${UI.formatNumber(t.new_quantity)}</td>
                  <td>${UI.esc(t.reference_number || '—')}</td>
                  <td>${UI.esc(t.supplier_or_recipient || '—')}</td>
                  <td>${UI.esc(t.user_name)}</td>
                  <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(t.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      document.getElementById('txPagination').innerHTML = `
        <span>Page ${pg.page} of ${pg.totalPages} (${pg.total} records)</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" id="txPrev" ${pg.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-sm" id="txNext" ${pg.page >= pg.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `;

      document.getElementById('txPrev').onclick = () => {
        filters.page -= 1;
        loadTable();
      };
      document.getElementById('txNext').onclick = () => {
        filters.page += 1;
        loadTable();
      };
    };

    let timer = null;
    document.getElementById('txSearch').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        filters.search = e.target.value;
        filters.page = 1;
        loadTable();
      }, 250);
    });

    document.getElementById('txType').addEventListener('change', (e) => {
      filters.type = e.target.value;
      filters.page = 1;
      loadTable();
    });

    document.getElementById('txStart').addEventListener('change', (e) => {
      filters.startDate = e.target.value;
      filters.page = 1;
      loadTable();
    });

    document.getElementById('txEnd').addEventListener('change', (e) => {
      filters.endDate = e.target.value;
      filters.page = 1;
      loadTable();
    });

    document.getElementById('txClear').addEventListener('click', () => {
      filters = { ...filters, search: '', type: '', startDate: '', endDate: '', page: 1 };
      document.getElementById('txSearch').value = '';
      document.getElementById('txType').value = '';
      document.getElementById('txStart').value = '';
      document.getElementById('txEnd').value = '';
      loadTable();
    });

    await loadTable();
  }

  App.registerPage('transactions', render);
})();
