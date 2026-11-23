(() => {
  function openUserModal(user = null, onSaved) {
    const isEdit = Boolean(user);
    UI.openModal({
      title: isEdit ? `Edit User — ${user.username}` : 'Create New User',
      bodyHtml: `
        <form id="userForm" class="form-grid">
          <div class="form-field">
            <label class="form-label">Full Name *</label>
            <input class="input" name="name" value="${UI.esc(user?.name || '')}" required />
          </div>
          <div class="form-field">
            <label class="form-label">Username *</label>
            <input class="input" name="username" value="${UI.esc(user?.username || '')}" ${isEdit ? 'disabled' : 'required'} />
          </div>
          <div class="form-field">
            <label class="form-label">Email *</label>
            <input class="input" type="email" name="email" value="${UI.esc(user?.email || '')}" required />
          </div>
          <div class="form-field">
            <label class="form-label">Role *</label>
            <select class="select" name="role" required>
              <option value="STAFF" ${user?.role === 'STAFF' ? 'selected' : ''}>STAFF</option>
              <option value="ADMIN" ${user?.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            </select>
          </div>
          <div class="form-field full">
            <label class="form-label">${isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <input class="input" type="password" name="password" minlength="6" ${isEdit ? '' : 'required'} placeholder="Minimum 6 characters" />
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn" id="uCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="uSaveBtn">${isEdit ? 'Save Changes' : 'Create User'}</button>
      `,
      onMount: () => {
        document.getElementById('uCancelBtn').onclick = UI.closeModal;
        document.getElementById('uSaveBtn').onclick = async () => {
          const form = document.getElementById('userForm');
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());
          if (isEdit && !payload.password) delete payload.password;

          const btn = document.getElementById('uSaveBtn');
          btn.disabled = true;
          try {
            if (isEdit) {
              await API.put(`/users/${user.id}`, payload);
              UI.toast('User updated successfully.', 'success');
            } else {
              await API.post('/users', payload);
              UI.toast('User created successfully.', 'success');
            }
            UI.closeModal();
            onSaved();
          } catch (err) {
            UI.toast(err.message || 'Failed to save user', 'error');
            btn.disabled = false;
          }
        };
      },
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">User Management</h1>
          <p class="page-subtitle">Manage Admin and Staff accounts, roles, and access status.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="addUserBtn"><i data-lucide="user-plus"></i>Add User</button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap" id="usersTableWrap">
          <div class="empty-state">Loading users...</div>
        </div>
      </div>
    `;
    UI.refreshIcons();

    const loadUsers = async () => {
      const res = await API.get('/users');
      const rows = res.data || [];
      const wrap = document.getElementById('usersTableWrap');

      wrap.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((u) => `
              <tr>
                <td style="font-weight:500;">${UI.esc(u.name)}</td>
                <td class="mono">${UI.esc(u.username)}</td>
                <td>${UI.esc(u.email)}</td>
                <td><span class="badge ${u.role === 'ADMIN' ? 'badge-accent' : 'badge-neutral'}">${u.role}</span></td>
                <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
                <td style="font-size:12px; color:var(--text-muted);">${UI.formatDateTime(u.last_login)}</td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm" data-u-edit="${u.id}">Edit / Reset PW</button>
                    ${u.id !== App.state.user.id ? `
                      <button class="btn btn-sm" data-u-toggle="${u.id}" data-next="${u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}">
                        ${u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      wrap.querySelectorAll('[data-u-edit]').forEach((b) => {
        b.addEventListener('click', () => {
          const u = rows.find((r) => String(r.id) === b.dataset.uEdit);
          if (u) openUserModal(u, loadUsers);
        });
      });

      wrap.querySelectorAll('[data-u-toggle]').forEach((b) => {
        b.addEventListener('click', async () => {
          const nextStatus = b.dataset.next;
          await API.patch(`/users/${b.dataset.uToggle}/status`, { status: nextStatus });
          UI.toast(`User ${nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`, 'success');
          loadUsers();
        });
      });
    };

    document.getElementById('addUserBtn').onclick = () => openUserModal(null, loadUsers);
    await loadUsers();
  }

  App.registerPage('users', render);
})();
