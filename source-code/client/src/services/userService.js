import { API_URL } from '../utils/api';

// Saved postcodes and travel preferences, stored in Neon via the Worker.
async function request(user, method, body) {
  const token = await user.getIdToken();
  const response = await fetch(`${API_URL}/me`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export const loadUserData = (user) => request(user, 'GET');
export const saveUserData = (user, patch) => request(user, 'PUT', patch);
