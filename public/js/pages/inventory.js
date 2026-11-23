(() => {
  let filters = {
    search: '',
    categoryId: '',
    stockStatus: '',
    sortBy: 'updated_at',
    sortOrder: 'DESC',
    page: 1,
    limit: 12,
  };

  function getUnits() {
    return Array.isArray(App.state.settings.available_units)
      ? App.state.settings.available_units
      : ['Pieces', 'Kilograms', 'Grams', 'Litres', 'Bags', 'Boxes', 'Metres', 'Units'];
  }

  function openItemFormModal(item = null, onSaved) {
    const isEdit = Boolean(item);
    const categories = App.state.categories || [];
    const suppliers = App.state.suppliers || [];
    const units = getUnits();

    const bodyHtml = `
      <form id="itemModalForm" class="form-grid">
        <div class="form-field">
          <label class="form-label">Product Name *</label>
          <input class="input" name="name" value="${UI.esc(item?.name || '')}" required />
        </div>
        <div class="form-field">
          <label class="form-label">SKU / Item Code *</label>
          <input class="input mono" name="sku" value="${UI.esc(item?.sku || '')}" placeholder="e.g. CEM-OPC53-50" required />
        </div>
        <div class="form-field">
          <label class="form-label">Category *</label>
          <select class="select" name="category_id" required>
            <option value="">Select category</option>
            ${categories.map((c) => `<option value="${c.id}" ${Number(item?.category_id) === c.id ? 'selected' : ''}>${UI.esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Unit of Measurement *</label>
          <select class="select" name="unit" required>
            ${units.map((u) => `<option value="${UI.esc(u)}" ${(item?.unit || 'Pieces') === u ? 'selected' : ''}>${UI.esc(u)}</option>`).join('')}
          </select>
        </div>
        ${!isEdit ? `
        <div class="form-field">
          <label class="form-label">Opening Stock Quantity *</label>
          <input class="input" type="number" step="0.01" min="0" name="opening_quantity" value="0" required />
          <span class="form-hint">Creates an initial ledger transaction if &gt; 0.</span>
        </div>` : ''}
        <div class="form-field">
          <label class="form-label">Minimum Stock Threshold *</label>
          <input class="input" type="number" step="0.01" min="0" name="minimum_stock_level" value="${item?.minimum_stock_level ?? 10}" required />
        </div>
        <div class="form-field">
          <label class="form-label">Unit Purchase Cost (Optional)</label>
          <input class="input" type="number" step="0.01" min="0" name="unit_cost" value="${item?.unit_cost ?? ''}" placeholder="0.00" />
        </div>
        <div class="form-field">
          <label class="form-label">Preferred Supplier (Optional)</label>
          <select class="select" name="supplier_id">
            <option value="">None</option>
            ${suppliers.map((s) => `<option value="${s.id}" ${Number(item?.supplier_id) === s.id ? 'selected' : ''}>${UI.esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field full">
          <label class="form-label">Description</label>
          <textarea class="textarea" name="description" placeholder="Specifications, grade, dimensions...">${UI.esc(item?.description || '')}</textarea>
        </div>
      </form>
    `;

    UI.openModal({
      title: isEdit ? `Edit Product — ${item.sku}` : 'Add New Product',
      bodyHtml,
      footerHtml: `
        <button type="button" class="btn" id="itemCancelBtn">Cancel</button>
        <button type="button" class="btn btn-primary" id="itemSaveBtn">${isEdit ? 'Save Changes' : 'Create Product'}</button>
      `,
      onMount: () => {
        document.getElementById('itemCancelBtn').onclick = UI.closeModal;
        document.getElementById('itemSaveBtn').onclick = async () => {
          const form = document.getElementById('itemModalForm');
          if (!form.reportValidity()) return;

          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());
          const btn = document.getElementById('itemSaveBtn');
          btn.disabled = true;

          try {
            if (isEdit) {
              await API.put(`/items/${item.id}`, payload);
              UI.toast('Product updated successfully.', 'success');
            } else {
              await API.post('/items', payload);
              UI.toast('Product created successfully.', 'success');
            }
            UI.closeModal();
            onSaved();
          } catch (err) {
            UI.toast(err.message || 'Failed to save product.', 'error');
            btn.disabled = false;
          }
        };
      },
    });
  }

  async function openItemDetailModal(id) {
    try {
      const [itemRes, txRes, qrRes] = await Promise.all([
        API.get(`/items/${id}`),
        API.get(`/items/${id}/transactions?limit=10`),
        API.get(`/items/${id}/qr`),
      ]);
      const item = itemRes.data;
      const txs = txRes.data || [];

      UI.openModal({
        title: `${item.name} (${item.sku})`,
        bodyHtml: `
          <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:16px;">
            <img src="${qrRes.data.qrDataUrl}" alt="Product QR Code" style="width:110px; height:110px; border:1px solid var(--border); border-radius:8px; padding:4px;" />
            <div style="flex:1; min-width:200px; font-size:13px;">
              <div style="margin-bottom:6px;">${UI.stockBadge(item.stock_status)}</div>
              <div><strong>Category:</strong> ${UI.esc(item.category_name)}</div>
              <div><strong>Available Stock:</strong> ${UI.formatNumber(item.current_quantity)} ${UI.esc(item.unit)}</div>
              <div><strong>Min Threshold:</strong> ${UI.formatNumber(item.minimum_stock_level)} ${UI.esc(item.unit)}</div>
              <div><strong>Unit Cost:</strong> ${UI.formatCurrency(item.unit_cost, App.state.settings.currency_symbol || '₹')}</div>
              <div><strong>Supplier:</strong> ${UI.esc(item.supplier_name || '—')}</div>
              ${item.description ? `<div style="margin-top:6px; color:var(--text-secondary);">${UI.esc(item.description)}</div>` : ''}
            </div>
          </div>
          <h3 style="font-size:13px; margin:0 0 8px;">Recent Movement Ledger</h3>
          <div class="table-wrap" style="border:1px solid var(--border); border-radius:6px;">
            ${txs.length === 0 ? '<div class="empty-state" style="padding:18px;">No movements yet.</div>' : `
              <table>
                <thead><tr><th>Code</th><th>Type</th><th>Qty</th><th>Balance</th><th>Date</th></tr></thead>
                <tbody>
                  ${txs.map((t) => `
                    <tr>
                      <td class="mono">${UI.esc(t.transaction_code)}</td>
                      <td>${UI.txBadge(t.transaction_type)}</td>
                      <td>${UI.formatNumber(t.quantity)}</td>
                      <td>${UI.formatNumber(t.previous_quantity)} &rarr; ${UI.formatNumber(t.new_quantity)}</td>
                      <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(t.created_at)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        `,
        footerHtml: `<button class="btn" id="detailCloseBtn">Close</button>`,
        onMount: () => {
          document.getElementById('detailCloseBtn').onclick = UI.closeModal;
        },
      });
    } catch (err) {
      UI.toast(err.message || 'Failed to load item details', 'error');
    }
  }

  function openAdjustModal(item, onSaved) {
    UI.openModal({
      title: `Stock Adjustment — ${item.name}`,
      bodyHtml: `
        <form id="adjustForm" class="form-grid">
          <div class="stock-preview-box form-field full">
            <div>
              <div style="font-size:12px; color:var(--text-muted);">Current System Balance</div>
              <strong>${UI.formatNumber(item.current_quantity)} ${UI.esc(item.unit)}</strong>
            </div>
          </div>
          <div class="form-field full">
            <label class="form-label">Verified Physical Quantity *</label>
            <input class="input" type="number" step="0.01" min="0" name="newQuantity" value="${item.current_quantity}" required />
          </div>
          <div class="form-field full">
            <label class="form-label">Adjustment Reason *</label>
            <input class="input" name="reason" placeholder="e.g. Physical cycle count reconciliation" required />
          </div>
          <div class="form-field full">
            <label class="form-label">Notes</label>
            <textarea class="textarea" name="notes" placeholder="Optional audit remarks"></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn" id="adjCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="adjSaveBtn">Record Adjustment</button>
      `,
      onMount: () => {
        document.getElementById('adjCancelBtn').onclick = UI.closeModal;
        document.getElementById('adjSaveBtn').onclick = async () => {
          const form = document.getElementById('adjustForm');
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const btn = document.getElementById('adjSaveBtn');
          btn.disabled = true;
          try {
            await API.post('/stock/adjust', {
              itemId: item.id,
              newQuantity: fd.get('newQuantity'),
              reason: fd.get('reason'),
              notes: fd.get('notes'),
            });
            UI.toast('Stock adjustment recorded.', 'success');
            UI.closeModal();
            onSaved();
          } catch (err) {
            UI.toast(err.message || 'Adjustment failed', 'error');
            btn.disabled = false;
          }
        };
      },
    });
  }

  async function render(container, params = {}) {
    if (params.search !== undefined) {
      filters.search = params.search;
      filters.page = 1;
    }

    const isAdmin = App.state.user?.role === 'ADMIN';
    const categories = App.state.categories || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Inventory Management</h1>
          <p class="page-subtitle">Centralized product catalog, real-time balances, and minimum stock thresholds.</p>
        </div>
        <div class="page-actions">
          ${isAdmin ? `<button class="btn btn-primary" id="addItemBtn"><i data-lucide="plus"></i>Add Product</button>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="toolbar-group">
            <input class="input" id="invSearch" type="search" placeholder="Search name, SKU, category..." value="${UI.esc(filters.search)}" style="min-width:240px;" />
            <select class="select" id="invCatFilter">
              <option value="">All Categories</option>
              ${categories.map((c) => `<option value="${c.id}" ${String(filters.categoryId) === String(c.id) ? 'selected' : ''}>${UI.esc(c.name)}</option>`).join('')}
            </select>
            <select class="select" id="invStatusFilter">
              <option value="">All Statuses</option>
              <option value="IN_STOCK" ${filters.stockStatus === 'IN_STOCK' ? 'selected' : ''}>In Stock</option>
              <option value="LOW_STOCK" ${filters.stockStatus === 'LOW_STOCK' ? 'selected' : ''}>Low Stock</option>
              <option value="OUT_OF_STOCK" ${filters.stockStatus === 'OUT_OF_STOCK' ? 'selected' : ''}>Out of Stock</option>
            </select>
            <button class="btn btn-sm" id="invClearBtn">Clear</button>
          </div>
        </div>

        <div class="table-wrap" id="invTableWrap">
          <div class="empty-state">Loading inventory...</div>
        </div>
        <div class="pagination" id="invPagination"></div>
      </div>
    `;

    UI.refreshIcons();

    const loadTable = async () => {
      const qs = new URLSearchParams({
        search: filters.search,
        categoryId: filters.categoryId,
        stockStatus: filters.stockStatus,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        limit: filters.limit,
      });

      const res = await API.get(`/items?${qs.toString()}`);
      const rows = res.data || [];
      const pg = res.pagination;
      const currency = App.state.settings.currency_symbol || '₹';

      const wrap = document.getElementById('invTableWrap');
      if (rows.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><i data-lucide="package-open"></i><div>No inventory items match your filters.</div></div>`;
        UI.refreshIcons();
      } else {
        wrap.innerHTML = `
          <table>
            <thead>
              <tr>
                <th class="sortable" data-sort="sku">SKU</th>
                <th class="sortable" data-sort="name">Product</th>
                <th class="sortable" data-sort="category">Category</th>
                <th class="sortable" data-sort="current_quantity">Available</th>
                <th>Min Level</th>
                <th class="sortable" data-sort="unit_cost">Unit Cost</th>
                <th>Status</th>
                <th class="sortable" data-sort="updated_at">Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((item) => `
                <tr>
                  <td class="mono">${UI.esc(item.sku)}</td>
                  <td>
                    <div style="font-weight:500;">${UI.esc(item.name)}</div>
                    ${item.description ? `<div style="font-size:12px; color:var(--text-muted); max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${UI.esc(item.description)}</div>` : ''}
                  </td>
                  <td>${UI.esc(item.category_name)}</td>
                  <td><strong>${UI.formatNumber(item.current_quantity)}</strong> ${UI.esc(item.unit)}</td>
                  <td>${UI.formatNumber(item.minimum_stock_level)} ${UI.esc(item.unit)}</td>
                  <td>${UI.formatCurrency(item.unit_cost, currency)}</td>
                  <td>${UI.stockBadge(item.stock_status)}</td>
                  <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(item.updated_at)}</td>
                  <td>
                    <div style="display:flex; gap:5px;">
                      <button class="btn btn-sm" data-view="${item.id}" title="View details & QR">View</button>
                      ${isAdmin ? `
                        <button class="btn btn-sm" data-edit="${item.id}" title="Edit product">Edit</button>
                        <button class="btn btn-sm" data-adjust="${item.id}" title="Stock adjustment">Adjust</button>
                        <button class="btn btn-sm" data-delete="${item.id}" title="Archive or delete" style="color:var(--danger);">Delete</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll('th.sortable').forEach((th) => {
          th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (filters.sortBy === col) {
              filters.sortOrder = filters.sortOrder === 'ASC' ? 'DESC' : 'ASC';
            } else {
              filters.sortBy = col;
              filters.sortOrder = 'ASC';
            }
            loadTable();
          });
        });

        wrap.querySelectorAll('[data-view]').forEach((b) => {
          b.addEventListener('click', () => openItemDetailModal(b.dataset.view));
        });
        wrap.querySelectorAll('[data-edit]').forEach((b) => {
          b.addEventListener('click', () => {
            const item = rows.find((r) => String(r.id) === b.dataset.edit);
            if (item) openItemFormModal(item, loadTable);
          });
        });
        wrap.querySelectorAll('[data-adjust]').forEach((b) => {
          b.addEventListener('click', () => {
            const item = rows.find((r) => String(r.id) === b.dataset.adjust);
            if (item) openAdjustModal(item, loadTable);
          });
        });
        wrap.querySelectorAll('[data-delete]').forEach((b) => {
          b.addEventListener('click', () => {
            const item = rows.find((r) => String(r.id) === b.dataset.delete);
            if (!item) return;
            UI.confirmDialog({
              title: 'Delete / Archive Product',
              message: `Are you sure you want to remove "${item.name}" (${item.sku})? Items with existing transaction history are archived to preserve the audit trail.`,
              confirmText: 'Proceed',
              danger: true,
              onConfirm: async () => {
                const delRes = await API.del(`/items/${item.id}`);
                UI.toast(delRes.message, 'success');
                loadTable();
              },
            });
          });
        });
      }

      document.getElementById('invPagination').innerHTML = `
        <span>Showing page ${pg.page} of ${pg.totalPages} (${pg.total} total items)</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" id="invPrevBtn" ${pg.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-sm" id="invNextBtn" ${pg.page >= pg.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `;

      document.getElementById('invPrevBtn').onclick = () => {
        filters.page -= 1;
        loadTable();
      };
      document.getElementById('invNextBtn').onclick = () => {
        filters.page += 1;
        loadTable();
      };
    };

    if (isAdmin) {
      document.getElementById('addItemBtn').onclick = () => openItemFormModal(null, loadTable);
    }

    let timer = null;
    document.getElementById('invSearch').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        filters.search = e.target.value;
        filters.page = 1;
        loadTable();
      }, 250);
    });

    document.getElementById('invCatFilter').addEventListener('change', (e) => {
      filters.categoryId = e.target.value;
      filters.page = 1;
      loadTable();
    });

    document.getElementById('invStatusFilter').addEventListener('change', (e) => {
      filters.stockStatus = e.target.value;
      filters.page = 1;
      loadTable();
    });

    document.getElementById('invClearBtn').addEventListener('click', () => {
      filters = { ...filters, search: '', categoryId: '', stockStatus: '', page: 1 };
      document.getElementById('invSearch').value = '';
      document.getElementById('invCatFilter').value = '';
      document.getElementById('invStatusFilter').value = '';
      loadTable();
    });

    await loadTable();
  }

  App.registerPage('inventory', render);
})();

