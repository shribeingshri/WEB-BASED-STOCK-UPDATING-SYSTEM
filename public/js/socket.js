window.AppSocket = (() => {
  let socket = null;

  function connect(onInventoryChange) {
    if (typeof window.io !== 'function') return;

    socket = window.io({ withCredentials: true });

    const dot = document.getElementById('socketStatusDot');
    const text = document.getElementById('socketStatusText');

    socket.on('connect', () => {
      if (dot) dot.style.background = 'var(--success)';
      if (text) text.textContent = 'Live sync active';
    });

    socket.on('disconnect', () => {
      if (dot) dot.style.background = 'var(--warning)';
      if (text) text.textContent = 'Reconnecting...';
    });

    socket.on('inventory:updated', (payload) => {
      if (typeof onInventoryChange === 'function') {
        onInventoryChange(payload);
      }
    });

    socket.on('alerts:updated', () => {
      if (window.App && typeof window.App.refreshAlertsBadge === 'function') {
        window.App.refreshAlertsBadge();
      }
    });
  }

  return { connect };
})();
