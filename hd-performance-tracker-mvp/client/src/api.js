const API_BASE = 'http://localhost:4000';
const ZAPIER_SECRET = import.meta.env.VITE_ZAPIER_WEBHOOK_SECRET || '';

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

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
}

export const api = {
  getMetadata: () => request('/metadata'),
  getMessages: (params) => request(`/messages${toQuery(params) ? `?${toQuery(params)}` : ''}`),
  getMessage: (id) => request(`/messages/${id}`),
  createMessage: (payload) => request('/messages', { method: 'POST', body: JSON.stringify(payload) }),
  updateMessage: (id, payload) => request(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getSavedReplies: () => request('/saved-replies'),
  createSavedReply: (payload) => request('/saved-replies', { method: 'POST', body: JSON.stringify(payload) }),
  updateSavedReply: (id, payload) => request(`/saved-replies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  sendApprovedToZapier: (payload) =>
    request('/api/messages/send-approved', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZAPIER_SECRET}`
      },
      body: JSON.stringify(payload)
    })
};
