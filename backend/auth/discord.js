// backend/auth/discord.js
const express = require('express');
const fetch = require('node-fetch');   // npm i node-fetch@2
const jwt = require('jsonwebtoken');   // npm i jsonwebtoken

const router = express.Router();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI, // p.ej. http://localhost:4000/auth/discord/callback
  DISCORD_GUILD_ID,     // opcional: comprobar si está en tu servidor
  FRONTEND_ORIGIN,      // p.ej. http://localhost:5173
  JWT_SECRET = 'cambia-esto',
} = process.env;

const API_BASE = 'https://discord.com/api';
const SCOPE = ['identify', 'guilds'].join(' '); // identify + guilds

function buildOAuthUrl(state) {
  const u = new URL(`${API_BASE}/oauth2/authorize`);
  u.searchParams.set('client_id', DISCORD_CLIENT_ID);
  u.searchParams.set('redirect_uri', DISCORD_REDIRECT_URI);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPE);
  u.searchParams.set('prompt', 'none');
  if (state) u.searchParams.set('state', state);
  return u.toString();
}

function sanitizeRedirect(v, fallback = '/') {
  return (typeof v === 'string' && v.startsWith('/')) ? v : fallback;
}

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: true, // ⚠️ en producción con HTTPS => true
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
};

/* -------------------- Rutas -------------------- */

// Alias útil: /auth/discord -> /auth/discord/login?redirect=<path>
router.get('/discord', (req, res) => {
  const redirect = sanitizeRedirect(req.query.redirect, '/');
  res.redirect(`/auth/discord/login?redirect=${encodeURIComponent(redirect)}`);
});

// /auth/discord/login?redirect=/  ó  /auth/discord/login?redirect=/admin
router.get('/discord/login', (req, res) => {
  const redirect = sanitizeRedirect(req.query.redirect, '/');
  const state = Buffer.from(JSON.stringify({ redirect })).toString('base64url');
  res.redirect(buildOAuthUrl(state));
});

// Callback de Discord
router.get('/discord/callback', async (req, res) => {
  const code = req.query.code;
  const stateRaw = req.query.state || '';

  let redirect = '/';
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
    redirect = sanitizeRedirect(parsed.redirect, '/');
  } catch {}

  if (!code) return res.status(400).send('Missing code');

  try {
    // 1) Intercambiar code -> access_token
    const body = new URLSearchParams();
    body.set('client_id', DISCORD_CLIENT_ID);
    body.set('client_secret', DISCORD_CLIENT_SECRET);
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', DISCORD_REDIRECT_URI);

    const tokenRes = await fetch(`${API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const token = await tokenRes.json();
    if (!token.access_token) {
      console.error('OAuth token error:', token);
      return res.status(400).send('OAuth error');
    }

    // 2) Datos del usuario
    const meRes = await fetch(`${API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = await meRes.json();

    // 3) (Opcional) comprobar si está en tu servidor
    let isInGuild = false;
    try {
      const gRes = await fetch(`${API_BASE}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (gRes.ok) {
        const guilds = await gRes.json();
        isInGuild = Array.isArray(guilds) && guilds.some(g => g.id === DISCORD_GUILD_ID);
      }
    } catch {}

    const profile = {
      discord_id: me.id,
      discord_username:
        me.discriminator && me.discriminator !== '0'
          ? `${me.username}#${me.discriminator}`
          : me.global_name || me.username,
      discord_avatar: me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=64`
        : null,
      is_in_guild: isInGuild,
    };

    // 4) Guardar sesión en cookie (JWT)
    const tokenJwt = jwt.sign(profile, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('session', tokenJwt, cookieOpts);

    // 5) Volver al front al path solicitado
    const front = (FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
    res.redirect(front + redirect);
  } catch (e) {
    console.error(e);
    res.status(500).send('Callback failed');
  }
});

// Devuelve el perfil (compatible con ambos fronts):
//   - Tu formulario espera { ok:true, user: {...} }
//   - Tu panel lee los campos en la raíz (spread)
router.get('/me', (req, res) => {
  const raw = req.cookies?.session;
  if (!raw) return res.status(401).json({ ok: false });
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    res.json({ ok: true, user: payload, ...payload });
  } catch {
    res.status(401).json({ ok: false });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('session', cookieOpts);
  res.json({ ok: true });
});

module.exports = router;
