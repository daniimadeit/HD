const API_BASE = 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  getDashboard: () => request('/dashboard'),
  getStudents: () => request('/students'),
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (payload) => request('/students', { method: 'POST', body: JSON.stringify(payload) }),
  createPackage: (payload) => request('/packages', { method: 'POST', body: JSON.stringify(payload) }),
  getRenewals: () => request('/packages/renewals'),
  createSession: (payload) => request('/sessions', { method: 'POST', body: JSON.stringify(payload) }),
  createNote: (payload) => request('/notes', { method: 'POST', body: JSON.stringify(payload) })
};
