// routes/wl.js
// Rutas WL: submit, list, detail, pending, review
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// --- Staff permitido por .env ---
const ALLOWED_STAFF = (process.env.STAFF_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function requireStaff(req, res, next) {
  const sid = (req.user?.discord_id) || req.headers['x-staff-id'];
  if (!sid) return res.status(401).json({ error: 'LOGIN_STAFF_REQUERIDO' });
  if (ALLOWED_STAFF.length && !ALLOWED_STAFF.includes(String(sid))) {
    return res.status(403).json({ error: 'STAFF_NO_AUTORIZADO' });
  }
  req.staff_id = String(sid);
  next();
}

/* -------------------- helpers -------------------- */

// 1 punto por pregunta (puedes pasar pesos si quieres)
function computeScore(decisions, weights = {}) {
  const entries = Object.entries(decisions || {});
  let total = 0;
  let score = 0;
  for (const [k, ok] of entries) {
    const w = Number(weights[k] ?? 1);
    total += w;
    if (ok) score += w;
  }
  return { score, total };
}

// Webhook opcional a Discord
async function postDiscordEmbed(embed) {
  try {
    const url = process.env.DISCORD_RESULT_WEBHOOK;
    if (!url) return;
    const f = (typeof fetch !== 'undefined') ? fetch : (await import('node-fetch')).default;
    await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Revisiones WL', embeds: [embed] }),
    });
  } catch (_) {}
}

/* -------------------- submit -------------------- */

// POST /wl/submit
router.post('/submit', async (req, res) => {
  try {
    const p = req.body;

    const reqd = [
      'discord_id','discord_username',
      'nombre_y_id_discord','edad_ooc','steam_link',
      'que_es_rp','uso_me_do','fair_play','pg_y_mg',
      'reaccion_robo_policia','que_harias_vdm','que_harias_desconecta_secuestro',
      'minimo_policias_flecca',
      'como_robarias_base_militar','caso_pinchan_ruedas',
      'rol_pensado','tiempo_roleando','historia_personaje'
    ];
    for (const k of reqd) {
      if (!p[k] || String(p[k]).trim() === '') {
        return res.status(400).json({ error: `FALTA_${k}` });
      }
    }

    // Cooldown del último intento (si existe)
    const { rows: prev } = await pool.query(
      `SELECT intentos, cooldown_until
         FROM public.wl_solicitudes
        WHERE discord_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [p.discord_id]
    );

    if (prev[0]?.cooldown_until && new Date(prev[0].cooldown_until) > new Date()) {
      return res.status(429).json({
        error: 'COOLDOWN_ACTIVO',
        until: prev[0].cooldown_until,
        intentos: prev[0].intentos ?? 0
      });
    }

    const minFlecca = Number.isFinite(+p.minimo_policias_flecca) ? +p.minimo_policias_flecca : 0;

    const ins = await pool.query(
      `
      INSERT INTO public.wl_solicitudes (
        discord_id, discord_username, discord_avatar, is_in_guild, estado,
        nombre_y_id_discord, edad_ooc, steam_link,
        que_es_rp, uso_me_do, fair_play, pg_y_mg,
        reaccion_robo_policia, que_harias_vdm, que_harias_desconecta_secuestro, minimo_policias_flecca,
        como_robarias_base_militar, caso_pinchan_ruedas, rol_pensado, tiempo_roleando, historia_personaje,
        puntuacion_total
      ) VALUES (
        $1,$2,$3,COALESCE($4,false),'pendiente',
        $5,$6,$7,
        $8,$9,$10,$11,
        $12,$13,$14,$15,
        $16,$17,$18,$19,$20,
        COALESCE($21,0)
      ) RETURNING id
      `,
      [
        p.discord_id, p.discord_username, p.discord_avatar || null, p.is_in_guild || false,
        p.nombre_y_id_discord, p.edad_ooc, p.steam_link,
        p.que_es_rp, p.uso_me_do, p.fair_play, p.pg_y_mg,
        p.reaccion_robo_policia, p.que_harias_vdm, p.que_harias_desconecta_secuestro, minFlecca,
        p.como_robarias_base_militar, p.caso_pinchan_ruedas, p.rol_pensado, p.tiempo_roleando, p.historia_personaje,
        p.puntuacion_total || 0
      ]
    );

    const id = ins.rows[0].id;

    // Log auditoría
    await pool.query(
      `INSERT INTO public.wl_logs (solicitud_id, staff_id, accion, motivo, meta)
       VALUES ($1,$2,'enviar',NULL,$3::jsonb)`,
      [id, p.discord_id, JSON.stringify({ ip: req.ip })]
    );

    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* -------------------- list & detail -------------------- */

// GET /wl/list
router.get('/list', requireStaff, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, discord_username, estado, created_at, puntuacion_total
       FROM public.wl_solicitudes
      ORDER BY created_at DESC
      LIMIT 50`
  );
  res.json(rows);
});

// GET /wl/detail/:id
router.get('/detail/:id', requireStaff, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM public.wl_solicitudes WHERE id=$1`, [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error:'NOT_FOUND' });
  res.json(rows[0]);
});

/* -------------------- pendientes -------------------- */

// GET /wl/pending  (sin cooldown activo)
router.get('/pending', requireStaff, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT id, discord_id, discord_username, created_at, intentos, estado
    FROM public.wl_solicitudes
    WHERE estado = 'pendiente'
      AND (cooldown_until IS NULL OR NOW() >= cooldown_until)
    ORDER BY created_at ASC
    LIMIT 100
  `);
  res.json(rows);
});

/* -------------------- revisar -------------------- */

// POST /wl/review/:id
// body = { decisions: {campo: boolean}, notas?: string }
// 👆 ya NO exigimos "aprobar" en el body: aprobamos solo si TODAS son true
router.post('/review/:id', requireStaff, async (req, res) => {
  const id = Number(req.params.id);
  const { decisions = {}, notas = '' } = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID_INVALIDO' });

  // Calcular puntuación (solo informativo)
  const { score, total } = computeScore(decisions);
  const pct = total ? score/total : 0;

  // ✅ Regla dura: aprobar solo si TODAS las respuestas son true
  const allCorrect = Object.values(decisions || {}).every(v => v === true);
  const aprobado = allCorrect;

  const reviewerId = req.staff_id;

  try {
    await pool.query('BEGIN');

    const cur = await pool.query(
      `SELECT intentos, estado FROM public.wl_solicitudes WHERE id=$1 FOR UPDATE`, [id]
    );
    if (!cur.rows[0]) { await pool.query('ROLLBACK'); return res.status(404).json({ error: 'NOT_FOUND' }); }
    if (cur.rows[0].estado !== 'pendiente') { await pool.query('ROLLBACK'); return res.status(409).json({ error: 'YA_REVISADA' }); }

    const nextIntentos = aprobado ? cur.rows[0].intentos : cur.rows[0].intentos + 1;
    const reachedMax = !aprobado && nextIntentos >= 3;
    const cooldownSql = reachedMax ? `NOW() + INTERVAL '7 days'` : 'NULL';

    const notasJson = {
      decisiones: decisions,
      notas,
      score,
      total,
      pct,
      aprobado,
      fecha: new Date().toISOString(),
    };

    const upd = await pool.query(
      `
      UPDATE public.wl_solicitudes
         SET estado           = $1,
             puntuacion_total = $2,
             notas_internas   = $3::jsonb,
             reviewed_by      = $4,
             intentos         = $5,
             cooldown_until   = ${cooldownSql},
             updated_at       = NOW()
       WHERE id = $6
       RETURNING id, discord_id, discord_username, estado, intentos, cooldown_until, puntuacion_total
      `,
      [aprobado ? 'aprobada' : 'rechazada', score, JSON.stringify(notasJson), reviewerId, nextIntentos, id]
    );

    const accion = aprobado ? 'aceptar' : 'rechazar';   // debe existir en tu CHECK
    const motivo = aprobado ? 'aprobada' : 'rechazada';

    await pool.query(
      `INSERT INTO public.wl_logs (solicitud_id, staff_id, accion, motivo, meta)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [id, reviewerId, accion, motivo, JSON.stringify({ score, total, pct, nextIntentos })]
    );

    await pool.query('COMMIT');

    // (Opcional) Webhook Discord
    // try {
    //   await postDiscordEmbed({
    //     title: `WL #${id} ${aprobado ? 'APROBADA ✅' : 'RECHAZADA ❌'}`,
    //     description: `Usuario: **${upd.rows[0].discord_username}**\nStaff: <@${reviewerId}>`,
    //     color: aprobado ? 0x2ecc71 : 0xe74c3c,
    //     fields: [
    //       { name: 'Puntuación', value: `${score}/${total} (${Math.round(pct*100)}%)`, inline: true },
    //       { name: 'Intentos', value: String(upd.rows[0].intentos), inline: true },
    //       upd.rows[0].cooldown_until ? { name: 'Cooldown hasta', value: String(upd.rows[0].cooldown_until), inline: false } : null,
    //     ].filter(Boolean),
    //   });
    // } catch {}

    res.json({ ok:true, data: upd.rows[0] });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
