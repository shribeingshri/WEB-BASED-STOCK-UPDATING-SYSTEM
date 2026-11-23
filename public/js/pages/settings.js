(() => {
  async function render(container) {
    const [setRes, catRes, supRes, auditRes] = await Promise.all([
      API.get('/settings'),
      API.get('/categories'),
      API.get('/suppliers'),
      API.get('/settings/audit-logs?limit=15'),
    ]);

    const settings = setRes.data || {};
    const categories = catRes.data || [];
    const suppliers = supRes.data || [];
    const logs = auditRes.data || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings &amp; Master Data</h1>
          <p class="page-subtitle">Configure company defaults, categories, suppliers, and review system audit logs.</p>
        </div>
      </div>

      <div class="grid-equal">
        <div class="card">
          <div class="card-header"><h2 class="card-title">Application Configuration</h2></div>
          <div class="card-body">
            <form id="settingsForm" class="form-grid">
              <div class="form-field full">
                <label class="form-label">Company Name</label>
                <input class="input" name="company_name" value="${UI.esc(settings.company_name || 'Buildmore Ventures LLP')}" required />
              </div>
              <div class="form-field">
                <label class="form-label">Currency Symbol</label>
                <input class="input" name="currency_symbol" value="${UI.esc(settings.currency_symbol || '₹')}" required />
              </div>
              <div class="form-field">
                <label class="form-label">Default Min Stock Threshold</label>
                <input class="input" type="number" min="0" name="default_min_stock" value="${UI.esc(settings.default_min_stock || '10')}" required />
              </div>
              <div class="form-field full" style="flex-direction:row; justify-content:flex-end;">
                <button type="submit" class="btn btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Categories</h2>
            <form id="addCatForm" style="display:flex; gap:6px;">
              <input class="input" id="newCatName" placeholder="New category name..." style="height:30px;" required />
              <button type="submit" class="btn btn-sm btn-primary">Add</button>
            </form>
          </div>
          <div class="table-wrap" style="max-height:260px; overflow-y:auto;">
            <table>
              <thead><tr><th>Name</th><th>Items</th><th>Action</th></tr></thead>
              <tbody>
                ${categories.map((c) => `
                  <tr>
                    <td style="font-weight:500;">${UI.esc(c.name)}</td>
                    <td>${c.item_count}</td>
                    <td>
                      <button class="btn btn-sm" data-del-cat="${c.id}" ${c.item_count > 0 ? 'disabled title="In use"' : ''}>Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid-equal">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Suppliers</h2>
            <button class="btn btn-sm btn-primary" id="addSupBtn">Add Supplier</button>
          </div>
          <div class="table-wrap" style="max-height:280px; overflow-y:auto;">
            <table>
              <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th></tr></thead>
              <tbody>
                ${suppliers.length === 0 ? '<tr><td colspan="3" class="empty-state">No suppliers added.</td></tr>' : suppliers.map((s) => `
                  <tr>
                    <td style="font-weight:500;">${UI.esc(s.name)}</td>
                    <td>${UI.esc(s.contact_person || '—')}</td>
                    <td>${UI.esc(s.phone || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Recent System Audit Logs</h2></div>
          <div class="table-wrap" style="max-height:280px; overflow-y:auto;">
            <table>
              <thead><tr><th>Action</th><th>Description</th><th>User</th><th>Time</th></tr></thead>
              <tbody>
                ${logs.map((l) => `
                  <tr>
                    <td class="mono">${UI.esc(l.action)}</td>
                    <td style="font-size:12.5px;">${UI.esc(l.description)}</td>
                    <td>${UI.esc(l.user_name || 'System')}</td>
                    <td style="font-size:11.5px; color:var(--text-muted);">${UI.formatDateTime(l.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await API.put('/settings', Object.fromEntries(fd.entries()));
      await App.loadSharedLookups();
      UI.toast('Settings saved.', 'success');
    });

    document.getElementById('addCatForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newCatName').value.trim();
      if (!name) return;
      try {
        await API.post('/categories', { name });
        await App.loadSharedLookups();
        UI.toast('Category added.', 'success');
        render(container);
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });

    document.querySelectorAll('[data-del-cat]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await API.del(`/categories/${b.dataset.delCat}`);
          await App.loadSharedLookups();
          UI.toast('Category deleted.', 'success');
          render(container);
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });

    document.getElementById('addSupBtn').addEventListener('click', () => {
      UI.openModal({
        title: 'Add Supplier',
        bodyHtml: `
          <form id="supForm" class="form-grid">
            <div class="form-field full"><label class="form-label">Supplier Name *</label><input class="input" name="name" required /></div>
            <div class="form-field"><label class="form-label">Contact Person</label><input class="input" name="contact_person" /></div>
            <div class="form-field"><label class="form-label">Phone</label><input class="input" name="phone" /></div>
            <div class="form-field full"><label class="form-label">Email</label><input class="input" type="email" name="email" /></div>
            <div class="form-field full"><label class="form-label">Address</label><textarea class="textarea" name="address"></textarea></div>
          </form>
        `,
        footerHtml: `<button class="btn" id="supCancel">Cancel</button><button class="btn btn-primary" id="supSave">Save Supplier</button>`,
        onMount: () => {
          document.getElementById('supCancel').onclick = UI.closeModal;
          document.getElementById('supSave').onclick = async () => {
            const form = document.getElementById('supForm');
            if (!form.reportValidity()) return;
            await API.post('/suppliers', Object.fromEntries(new FormData(form).entries()));
            await App.loadSharedLookups();
            UI.closeModal();
            UI.toast('Supplier added.', 'success');
            render(container);
          };
        },
      });
    });
  }

  App.registerPage('settings', render);
})();
