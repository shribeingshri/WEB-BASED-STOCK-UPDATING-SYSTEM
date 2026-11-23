(() => {
  async function render(container, params = {}) {
    const res = await API.get('/items?limit=100&sortBy=name&sortOrder=ASC');
    const items = res.data || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Stock Out (Issue Inventory)</h1>
          <p class="page-subtitle">Record materials issued, sold, or consumed. Negative stock balances are strictly blocked.</p>
        </div>
      </div>

      <div class="grid-equal">
        <div class="card">
          <div class="card-header"><h2 class="card-title">Issue Stock Entry</h2></div>
          <div class="card-body">
            <form id="stockOutForm" class="form-grid">
              <div class="form-field full">
                <label class="form-label">Select Product *</label>
                <select class="select" id="soItemSelect" name="itemId" required>
                  <option value="">Choose a product...</option>
                  ${items.map((i) => `<option value="${i.id}" ${String(params.itemId) === String(i.id) ? 'selected' : ''}>${UI.esc(i.name)} (${UI.esc(i.sku)}) — ${UI.formatNumber(i.current_quantity)} ${UI.esc(i.unit)}</option>`).join('')}
                </select>
              </div>

              <div id="soPreview" class="stock-preview-box form-field full" style="display:none;">
                <div>
                  <div style="font-size:12px; color:var(--text-muted);">SKU: <span id="soSku" class="mono"></span></div>
                  <div>Available Stock: <strong id="soCurrentQty"></strong></div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:12px; color:var(--text-muted);">Remaining Balance</div>
                  <strong id="soProjectedQty">—</strong>
                </div>
              </div>

              <div id="soWarn" class="form-field full" style="display:none; padding:10px 12px; border-radius:6px; background:var(--danger-bg); border:1px solid var(--danger-border); color:var(--danger); font-size:12.5px;"></div>

              <div class="form-field">
                <label class="form-label">Quantity Issued *</label>
                <input class="input" type="number" step="0.01" min="0.01" id="soQty" name="quantity" placeholder="0.00" required />
              </div>

              <div class="form-field">
                <label class="form-label">Unit</label>
                <input class="input" id="soUnit" readonly placeholder="Auto-filled" style="background:var(--bg-canvas);" />
              </div>

              <div class="form-field">
                <label class="form-label">Issued To / Department</label>
                <input class="input" name="supplierOrRecipient" placeholder="e.g. Site B — Civil Works" />
              </div>

              <div class="form-field">
                <label class="form-label">Reference / Slip No.</label>
                <input class="input" name="referenceNumber" placeholder="e.g. REQ-2026-088" />
              </div>

              <div class="form-field full">
                <label class="form-label">Purpose / Reason *</label>
                <input class="input" name="reason" value="Site Dispatch" required />
              </div>

              <div class="form-field full">
                <label class="form-label">Notes</label>
                <textarea class="textarea" name="notes" placeholder="Optional dispatch notes..."></textarea>
              </div>

              <div class="form-field full" style="flex-direction:row; justify-content:flex-end; gap:8px;">
                <button type="reset" class="btn">Reset</button>
                <button type="submit" id="soSubmitBtn" class="btn btn-primary">Confirm Stock Out</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Recent Stock-Out Entries</h2></div>
          <div class="table-wrap" id="soRecentList">
            <div class="empty-state">Loading recent entries...</div>
          </div>
        </div>
      </div>
    `;

    const selectEl = document.getElementById('soItemSelect');
    const qtyEl = document.getElementById('soQty');
    const previewEl = document.getElementById('soPreview');
    const warnEl = document.getElementById('soWarn');
    const submitBtn = document.getElementById('soSubmitBtn');

    function updatePreview() {
      const item = items.find((i) => String(i.id) === selectEl.value);
      if (!item) {
        previewEl.style.display = 'none';
        warnEl.style.display = 'none';
        document.getElementById('soUnit').value = '';
        submitBtn.disabled = false;
        return;
      }
      previewEl.style.display = 'flex';
      document.getElementById('soSku').textContent = item.sku;
      document.getElementById('soUnit').value = item.unit;
      document.getElementById('soCurrentQty').textContent = `${UI.formatNumber(item.current_quantity)} ${item.unit}`;

      const reqQty = Number(qtyEl.value || 0);
      const remaining = Number(item.current_quantity) - reqQty;
      const projEl = document.getElementById('soProjectedQty');

      if (reqQty > Number(item.current_quantity)) {
        warnEl.style.display = 'block';
        warnEl.textContent = `Insufficient stock: requested ${UI.formatNumber(reqQty)} ${item.unit}, but only ${UI.formatNumber(item.current_quantity)} ${item.unit} available.`;
        projEl.textContent = 'Blocked (Negative)';
        projEl.style.color = 'var(--danger)';
        submitBtn.disabled = true;
      } else {
        warnEl.style.display = 'none';
        projEl.textContent = `${UI.formatNumber(remaining)} ${item.unit}`;
        projEl.style.color = remaining <= Number(item.minimum_stock_level) ? 'var(--warning)' : 'var(--text-primary)';
        submitBtn.disabled = false;
      }
    }

    selectEl.addEventListener('change', updatePreview);
    qtyEl.addEventListener('input', updatePreview);
    updatePreview();

    async function loadRecent() {
      const txRes = await API.get('/stock/transactions?type=OUT&limit=8');
      const rows = txRes.data || [];
      document.getElementById('soRecentList').innerHTML = rows.length === 0
        ? '<div class="empty-state">No stock-out transactions yet.</div>'
        : `<table>
            <thead><tr><th>Product</th><th>Qty</th><th>Balance</th><th>Date</th></tr></thead>
            <tbody>
              ${rows.map((r) => `
                <tr>
                  <td>
                    <div style="font-weight:500;">${UI.esc(r.item_name)}</div>
                    <div class="mono" style="color:var(--text-muted);">${UI.esc(r.transaction_code)}</div>
                  </td>
                  <td style="color:var(--warning); font-weight:600;">-${UI.formatNumber(r.quantity)} ${UI.esc(r.unit)}</td>
                  <td>${UI.formatNumber(r.previous_quantity)} &rarr; ${UI.formatNumber(r.new_quantity)}</td>
                  <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(r.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
    }

    document.getElementById('stockOutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      submitBtn.disabled = true;

      try {
        const result = await API.post('/stock/out', payload);
        UI.toast(result.message, 'success');
        const idx = items.findIndex((i) => String(i.id) === String(payload.itemId));
        if (idx !== -1) items[idx].current_quantity = result.data.newQuantity;
        e.target.reset();
        updatePreview();
        await loadRecent();
        App.refreshAlertsBadge();
      } catch (err) {
        UI.toast(err.message || 'Stock-Out failed', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });

    await loadRecent();
  }

  App.registerPage('stock-out', render);
})();

