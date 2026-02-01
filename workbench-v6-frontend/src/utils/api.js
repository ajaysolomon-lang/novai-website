const API_BASE = 'https://works-v6-api.ajay-solomon.workers.dev';

export function getToken() {
  return localStorage.getItem('wb_token');
}

export function setToken(token) {
  localStorage.setItem('wb_token', token);
}

export function clearToken() {
  localStorage.removeItem('wb_token');
  localStorage.removeItem('wb_user');
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('wb_user')); } catch { return null; }
}

export function setUser(user) {
  localStorage.setItem('wb_user', JSON.stringify(user));
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function login(email, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

export async function register(email, password, name, phone) {
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, phone })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

export function logout() {
  clearToken();
  window.location.hash = '#login';
}
