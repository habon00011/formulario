// src/lib/auth.js
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function loginWithDiscord(redirectTo = window.location.pathname) {
  const r = encodeURIComponent(redirectTo || '/');
  // Enviamos a nuestro backend con el destino deseado
  window.location.href = `${API}/auth/discord?redirect=${r}`;
}

export async function getMe() {
  try {
    const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
