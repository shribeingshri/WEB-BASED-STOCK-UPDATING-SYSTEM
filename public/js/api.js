window.API = (() => {
  async function request(path, options = {}) {
    const config = {
      credentials: 'include',
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.headers || {}),
      },
      ...options,
    };

    const res = await fetch(`/api${path}`, config);

    if (res.status === 401 && !path.startsWith('/auth/login')) {
      window.location.replace('/login');
      throw new Error('Session expired');
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || 'Request failed');
        err.status = res.status;
        err.details = data.details;
        throw err;
      }
      return data;
    }

    if (!res.ok) {
      throw new Error('Request failed');
    }
    return res;
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
    del: (path) => request(path, { method: 'DELETE' }),
  };
})();

