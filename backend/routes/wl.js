// routes/wl.js
// Rutas WL: submit, list, detail, pending, review
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Mapa: clave -> etiqueta legible (para mostrar qué preguntas falló)
const QUESTION_LABELS = Object.freeze({
  que_es_rp: '¿Qué es el rol (RP)?',
  uso_me_do: '¿Para qué sirve /do y /me? Uso correcto.',
  fair_play: '¿Qué es Fair-play?',
  pg_y_mg: '¿Qué es PG y MG?',
  reaccion_robo_policia: 'Robo y llega policía antes: ¿qué haces?',
  que_harias_vdm: 'Te atropellan (VDM): ¿qué haces?',
  que_harias_desconecta_secuestro: 'Secuestran y se desconecta: ¿qué haces?',
  minimo_policias_flecca: '¿Mínimo de policías para Flecca?',
  como_robarias_base_militar: '¿Cómo robarías armas de la base militar?',
  caso_pinchan_ruedas: 'Te pinchan ruedas y al /report se lía a tiros: ¿qué está mal?',
  rol_pensado: '¿Qué rol tienes pensado (Legal/Ilegal/Otro)?',
  historia_personaje: 'Historia del personaje',
});


// --- Bot de Discord: roles y anuncios ---
const { setSuspensionRole, setApprovedRole, sendResultMessage } = require('../services/discordBot');

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
      'edad_ooc','steam_link',
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

// ---- Límite de 3 rechazos (histórico) usando COUNT, no MAX(intentos)
const { rows: lim } = await pool.query(
  `SELECT COUNT(*)::int AS fails
     FROM public.wl_solicitudes
    WHERE discord_id = $1 AND estado = 'rechazada'`,
  [p.discord_id]
);
const fails = lim[0]?.fails ?? 0;
if (fails >= 3) {
  return res.status(403).json({ error: 'LIMITE_INTENTOS' });
}

// ---- Bloqueo por COOLDOWN (si el último review impuso espera)
const { rows: last } = await pool.query(
  `SELECT cooldown_until
     FROM public.wl_solicitudes
    WHERE discord_id = $1
    ORDER BY created_at DESC
    LIMIT 1`,
  [p.discord_id]
);
if (last[0]?.cooldown_until && new Date(last[0].cooldown_until) > new Date()) {
  return res.status(429).json({
    error: 'COOLDOWN_ACTIVO',
    until: last[0].cooldown_until,
  });
}


    const minFlecca = Number.isFinite(+p.minimo_policias_flecca) ? +p.minimo_policias_flecca : 0;

    // ✅ Derivar en servidor (ya no viene del formulario)
    const nombreId = `${p.discord_username} | ${p.discord_id}`;

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
        nombreId, p.edad_ooc, p.steam_link,
        p.que_es_rp, p.uso_me_do, p.fair_play, p.pg_y_mg,
        p.reaccion_robo_policia, p.que_harias_vdm, p.que_harias_desconecta_secuestro, minFlecca,
        p.como_robarias_base_militar, p.caso_pinchan_ruedas, p.rol_pensado, p.tiempo_roleando, p.historia_personaje,
        p.puntuacion_total || 0
      ]
    );

    const id = ins.rows[0].id;

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
// body = { decisions: {campo:boolean}, notas?: string }
router.post('/review/:id', requireStaff, async (req, res) => {
  const id = Number(req.params.id);
  const { decisions = {}, notas = '', steam_check: rawSteamCheck } = req.body || {};
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'ID_INVALIDO' });
  }

  const allowedSteam = new Set(['ok','no_hours','private',null,undefined]);
  const steam_check = allowedSteam.has(rawSteamCheck) ? (rawSteamCheck || null) : null;


  // Puntuación solo informativa
  const entries = Object.values(decisions || {});
  const total = entries.length;
  const score = entries.filter(v => v === true).length;
  const pct = total ? score / total : 0;

  // Regla: aprobar SOLO si todas están correctas
  const allCorrect = entries.every(v => v === true);
  const aprobado = allCorrect && steam_check === 'ok';

  const reviewerId = req.staff_id;

  try {
    await pool.query('BEGIN');

    // Cargamos la solicitud y bloqueamos la fila
    const cur = await pool.query(
      `SELECT id, discord_id, discord_username, estado, intentos
         FROM public.wl_solicitudes
        WHERE id = $1
        FOR UPDATE`,
      [id]
    );
    const row = cur.rows[0];
    if (!row) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    if (row.estado !== 'pendiente') {
      await pool.query('ROLLBACK');
      return res.status(409).json({ error: 'YA_REVISADA' });
    }

    // === ACUMULADO DE RECHAZOS DEL USUARIO ===
    const cnt = await pool.query(
      `SELECT COUNT(*)::int AS fails
         FROM public.wl_solicitudes
        WHERE discord_id = $1 AND estado = 'rechazada'`,
      [row.discord_id]
    );
    const failsPrev  = cnt.rows[0]?.fails || 0;        // antes de esta revisión
    const failsAfter = aprobado ? failsPrev : failsPrev + 1; // después de esta revisión


    const STEAM_REASON = {
  no_hours: 'Horas de FiveM insuficientes',
  private: 'Steam no público',
};

let rejectReason = null;
if (!aprobado) {
  if (steam_check && steam_check !== 'ok') {
    rejectReason = STEAM_REASON[steam_check] || 'Steam no verificado';
  } else if (!allCorrect) {
    rejectReason = 'Respuestas incorrectas';
  }
}


    const reachedMax = !aprobado && failsAfter >= 3;
    const cooldownSql = reachedMax ? `NOW() + INTERVAL '7 days'` : 'NULL';

    const notasJson = {
      decisiones: decisions,
      notas,
      score,
      total,
      pct,
      aprobado,
      fecha: new Date().toISOString(),
      steam_check,
    };

    // Guardamos la revisión y dejamos 'intentos' = ACUMULADO
    const upd = await pool.query(
      `
      UPDATE public.wl_solicitudes
         SET estado           = $1,
             puntuacion_total = $2,
             notas_internas   = $3::jsonb,
             reviewed_by      = $4,
             intentos         = $5,                  -- ACUMULADO
             cooldown_until   = ${cooldownSql},
             updated_at       = NOW()
       WHERE id = $6
       RETURNING id, discord_id, discord_username, estado, intentos, cooldown_until, puntuacion_total
      `,
      [
        (aprobado ? 'aprobada' : 'rechazada'),
        score,
        JSON.stringify(notasJson),
        reviewerId,
        failsAfter, // 👈 acumulado
        id
      ]
    );

    // Log
    const accion = aprobado ? 'aceptar' : 'rechazar';
    const motivo = aprobado ? 'aprobada' : 'rechazada';
    await pool.query(
      `INSERT INTO public.wl_logs (solicitud_id, staff_id, accion, motivo, meta)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [id, reviewerId, accion, motivo, JSON.stringify({ score, total, pct, failsAfter })]
    );

    await pool.query('COMMIT');

 const wlRow = upd.rows[0]; // fila retornada por el UPDATE

(async () => {
  try {
    const userId   = String(wlRow.discord_id);
    const username = wlRow.discord_username;

    // intentos GUARDADOS tras esta revisión
    const intentosActuales  = Number(wlRow.intentos) || 0;
    const intentosClamped   = Math.min(intentosActuales, 3);  // 1..3
    const intentosRestantes = Math.max(3 - intentosClamped, 0);

    if (aprobado) {
      await setApprovedRole(userId);               // da WL y quita suspendidos
    } else {
      await setSuspensionRole(userId, intentosClamped); // pone WL suspendida 1/2/3
    }

    await sendResultMessage({
      approved: aprobado,
      wlId: id,
      userId,
      username,
      reviewerId,
      attemptsUsed: intentosClamped,
      rejectReason,
    });
  } catch (e) {
    console.error('[discordBot] error', e);
  }
})();

return res.json({ ok: true, data: wlRow });

    // ------------------------------------------------------------

  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});



// Todas las whitelist (solo staff)
router.get("/all", requireStaff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.wl_solicitudes ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error cargando whitelists" });
  }
});


module.exports = router;

