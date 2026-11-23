window.UI = (() => {
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(val, decimals = 2) {
    const num = Number(val || 0);
    return Number.isInteger(num)
      ? num.toLocaleString('en-IN')
      : num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  function formatCurrency(val, symbol = '₹') {
    if (val === null || val === undefined || val === '') return '—';
    return `${symbol}${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDateTime(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function stockBadge(status) {
    if (status === 'OUT_OF_STOCK') {
      return '<span class="badge badge-danger">Out of Stock</span>';
    }
    if (status === 'LOW_STOCK') {
      return '<span class="badge badge-warning">Low Stock</span>';
    }
    return '<span class="badge badge-success">In Stock</span>';
  }

  function txBadge(type) {
    if (type === 'IN') return '<span class="badge badge-success">Stock In</span>';
    if (type === 'OUT') return '<span class="badge badge-warning">Stock Out</span>';
    return '<span class="badge badge-accent">Adjustment</span>';
  }

  function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3800);
  }

  function openModal({ title, bodyHtml, footerHtml = '', onMount = null }) {
    const overlay = document.getElementById('appModalOverlay');
    document.getElementById('appModalTitle').textContent = title;
    document.getElementById('appModalBody').innerHTML = bodyHtml;
    document.getElementById('appModalFooter').innerHTML = footerHtml;
    overlay.classList.add('open');
    refreshIcons();
    if (typeof onMount === 'function') onMount();
  }

  function closeModal() {
    document.getElementById('appModalOverlay').classList.remove('open');
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', danger = false, onConfirm }) {
    openModal({
      title,
      bodyHtml: `<p style="margin:0; color:var(--text-secondary);">${esc(message)}</p>`,
      footerHtml: `
        <button type="button" class="btn" id="confirmCancelBtn">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOkBtn">${esc(confirmText)}</button>
      `,
      onMount: () => {
        document.getElementById('confirmCancelBtn').onclick = closeModal;
        document.getElementById('confirmOkBtn').onclick = async () => {
          const btn = document.getElementById('confirmOkBtn');
          btn.disabled = true;
          try {
            await onConfirm();
            closeModal();
          } catch (err) {
            toast(err.message || 'Operation failed', 'error');
            btn.disabled = false;
          }
        };
      },
    });
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  return {
    esc,
    formatNumber,
    formatCurrency,
    formatDateTime,
    stockBadge,
    txBadge,
    toast,
    openModal,
    closeModal,
    confirmDialog,
    refreshIcons,
  };
})();
