(() => {
  async function render(container, params = {}) {
    const res = await API.get('/items?limit=100&sortBy=name&sortOrder=ASC');
    const items = res.data || [];
    const suppliers = App.state.suppliers || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Stock In (Receive Inventory)</h1>
          <p class="page-subtitle">Record incoming materials, supplier deliveries, and opening replenishments.</p>
        </div>
      </div>

      <div class="grid-equal">
        <div class="card">
          <div class="card-header"><h2 class="card-title">Receive Stock Entry</h2></div>
          <div class="card-body">
            <form id="stockInForm" class="form-grid">
              <div class="form-field full">
                <label class="form-label">Select Product *</label>
                <select class="select" id="siItemSelect" name="itemId" required>
                  <option value="">Choose a product...</option>
                  ${items.map((i) => `<option value="${i.id}" ${String(params.itemId) === String(i.id) ? 'selected' : ''}>${UI.esc(i.name)} (${UI.esc(i.sku)})</option>`).join('')}
                </select>
              </div>

              <div id="siPreview" class="stock-preview-box form-field full" style="display:none;">
                <div>
                  <div style="font-size:12px; color:var(--text-muted);">SKU: <span id="siSku" class="mono"></span></div>
                  <div>Current Available: <strong id="siCurrentQty"></strong></div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:12px; color:var(--text-muted);">Projected Balance</div>
                  <strong id="siProjectedQty" style="color:var(--success);">—</strong>
                </div>
              </div>

              <div class="form-field">
                <label class="form-label">Quantity Received *</label>
                <input class="input" type="number" step="0.01" min="0.01" id="siQty" name="quantity" placeholder="0.00" required />
              </div>

              <div class="form-field">
                <label class="form-label">Unit</label>
                <input class="input" id="siUnit" readonly placeholder="Auto-filled" style="background:var(--bg-canvas);" />
              </div>

              <div class="form-field">
                <label class="form-label">Supplier (Optional)</label>
                <input class="input" list="supplierDatalist" name="supplierOrRecipient" placeholder="Select or type supplier name" />
                <datalist id="supplierDatalist">
                  ${suppliers.map((s) => `<option value="${UI.esc(s.name)}"></option>`).join('')}
                </datalist>
              </div>

              <div class="form-field">
                <label class="form-label">Invoice / Reference No.</label>
                <input class="input" name="referenceNumber" placeholder="e.g. INV-2026-0142" />
              </div>

              <div class="form-field full">
                <label class="form-label">Transaction Remarks / Reason</label>
                <input class="input" name="reason" value="Stock Received" />
              </div>

              <div class="form-field full">
                <label class="form-label">Notes</label>
                <textarea class="textarea" name="notes" placeholder="Batch details, vehicle number, inspection remarks..."></textarea>
              </div>

              <div class="form-field full" style="flex-direction:row; justify-content:flex-end; gap:8px;">
                <button type="reset" class="btn">Reset</button>
                <button type="submit" id="siSubmitBtn" class="btn btn-primary">Confirm Stock In</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Recent Stock-In Entries</h2></div>
          <div class="table-wrap" id="siRecentList">
            <div class="empty-state">Loading recent entries...</div>
          </div>
        </div>
      </div>
    `;

    const selectEl = document.getElementById('siItemSelect');
    const qtyEl = document.getElementById('siQty');
    const previewEl = document.getElementById('siPreview');

    function updatePreview() {
      const item = items.find((i) => String(i.id) === selectEl.value);
      if (!item) {
        previewEl.style.display = 'none';
        document.getElementById('siUnit').value = '';
        return;
      }
      previewEl.style.display = 'flex';
      document.getElementById('siSku').textContent = item.sku;
      document.getElementById('siUnit').value = item.unit;
      document.getElementById('siCurrentQty').textContent = `${UI.formatNumber(item.current_quantity)} ${item.unit}`;
      const add = Number(qtyEl.value || 0);
      const projected = add > 0 ? Number(item.current_quantity) + add : Number(item.current_quantity);
      document.getElementById('siProjectedQty').textContent = `${UI.formatNumber(projected)} ${item.unit}`;
    }

    selectEl.addEventListener('change', updatePreview);
    qtyEl.addEventListener('input', updatePreview);
    updatePreview();

    async function loadRecent() {
      const txRes = await API.get('/stock/transactions?type=IN&limit=8');
      const rows = txRes.data || [];
      document.getElementById('siRecentList').innerHTML = rows.length === 0
        ? '<div class="empty-state">No stock-in transactions yet.</div>'
        : `<table>
            <thead><tr><th>Product</th><th>Qty</th><th>Balance</th><th>Date</th></tr></thead>
            <tbody>
              ${rows.map((r) => `
                <tr>
                  <td>
                    <div style="font-weight:500;">${UI.esc(r.item_name)}</div>
                    <div class="mono" style="color:var(--text-muted);">${UI.esc(r.transaction_code)}</div>
                  </td>
                  <td style="color:var(--success); font-weight:600;">+${UI.formatNumber(r.quantity)} ${UI.esc(r.unit)}</td>
                  <td>${UI.formatNumber(r.previous_quantity)} &rarr; ${UI.formatNumber(r.new_quantity)}</td>
                  <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(r.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
    }

    document.getElementById('stockInForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      const btn = document.getElementById('siSubmitBtn');
      btn.disabled = true;

      try {
        const result = await API.post('/stock/in', payload);
        UI.toast(result.message, 'success');
        const idx = items.findIndex((i) => String(i.id) === String(payload.itemId));
        if (idx !== -1) items[idx].current_quantity = result.data.newQuantity;
        e.target.reset();
        updatePreview();
        await loadRecent();
        App.refreshAlertsBadge();
      } catch (err) {
        UI.toast(err.message || 'Stock-In failed', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    await loadRecent();
  }

  App.registerPage('stock-in', render);
})();

