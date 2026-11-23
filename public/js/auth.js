document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  // If already logged in, redirect to dashboard
  fetch('/api/auth/me', { credentials: 'include' })
    .then((res) => {
      if (res.ok) window.location.replace('/');
    })
    .catch(() => {});

  const form = document.getElementById('loginForm');
  const identifierEl = document.getElementById('identifier');
  const passwordEl = document.getElementById('password');
  const rememberEl = document.getElementById('rememberMe');
  const togglePwBtn = document.getElementById('togglePwBtn');
  const errorBox = document.getElementById('authError');
  const loginBtn = document.getElementById('loginBtn');

  togglePwBtn.addEventListener('click', () => {
    const isPassword = passwordEl.type === 'password';
    passwordEl.type = isPassword ? 'text' : 'password';
    togglePwBtn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
    if (window.lucide) window.lucide.createIcons();
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('visible');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const identifier = identifierEl.value.trim();
    const password = passwordEl.value;

    if (!identifier || !password) {
      showError('Please enter both your email/username and password.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          identifier,
          password,
          rememberMe: rememberEl.checked,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.message || 'Sign in failed.');
        return;
      }

      window.location.replace('/');
    } catch {
      showError('Unable to reach the server. Please check your connection.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
});
