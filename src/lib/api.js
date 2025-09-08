export const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const getMe = () =>
  fetch(`${API}/auth/me`, { credentials: 'include' }).then(r => r.json());

export const submitWL = (payload) =>
  fetch(`${API}/wl/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }).then(r => r.json());

export const logout = () =>
  fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });

export async function listPending() {
  const r = await fetch(`${import.meta.env.VITE_API_URL}/wl/pending`, {
    credentials: 'include',
  });
  return r.json();
}

export async function getWL(id) {
  const r = await fetch(`${import.meta.env.VITE_API_URL}/wl/detail/${id}`, {
    credentials: 'include',
  });
  return r.json();
}

export async function sendReview(id, payload) {
  const r = await fetch(`${import.meta.env.VITE_API_URL}/wl/review/${id}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

