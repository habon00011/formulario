// services/wlStats.js
const { pool } = require("../db");

const CHANNEL_ID = process.env.WL_CHANNEL_ID; // canal donde se publica el estado
const ROLE_ID = process.env.WL_ROLE_ID;       // rol a etiquetar (Encargados)
const LOG_CHANNEL_ID = process.env.WL_LOG_CHANNEL_ID; // canal de logs Whitelist enviadas

let messageId = null;   // ID del mensaje principal (se edita)
let clientRef = null;   // referencia al bot

// Aviso actual independiente del mensaje principal
// level: 'warn' (4h), 'urgent' (8h), 'critical' (24h)
let currentAlert = { level: null, id: null };

// Determina el nivel según segundos de espera
function getLevelBySeconds(s) {
  if (s > 24 * 3600) return 'critical';
  if (s >  8 * 3600) return 'urgent';
  if (s >  4 * 3600) return 'warn';
  return null;
}

function init(c) {
  clientRef = c;

  // Pendientes cada 5 min
  setInterval(updatePendingMessage, 5 * 60 * 1000);

  // Ranking cada domingo a las 11:00
  scheduleWeeklyRanking();
}

// ---------------- LOG WHITELIST ENVIADA ----------------
async function notifyNewWhitelist(id, discordUser, discordId) {
  if (!clientRef) return;
  try {
    const channel = await clientRef.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    await channel.send(
      `📨 Hemos recibido tu Whitelist \`${id}\` — <@${discordId}>`
    );
  } catch (err) {
    console.error("[wlStats] Error notificando nueva WL:", err);
  }
}

/* ---------------- PENDIENTES ---------------- */
async function updatePendingMessage() {
  if (!clientRef) return;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS pendientes 
       FROM public.wl_solicitudes 
       WHERE estado = 'pendiente'`
    );

    const pendientes = rows[0]?.pendientes ?? 0;

    // Buscar la más antigua
    let tiempoTexto = "✅ Todas corregidas.";
    let segundos = 0;

    if (pendientes > 0) {
      const { rows: oldest } = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS segundos
         FROM public.wl_solicitudes 
         WHERE estado = 'pendiente'
         ORDER BY created_at ASC
         LIMIT 1`
      );

      segundos = oldest[0]?.segundos ?? 0;
      const horas = Math.floor(segundos / 3600);
      const minutos = Math.floor((segundos % 3600) / 60);

      tiempoTexto = `⏰ La más antigua lleva esperando: \`${horas}h:${minutos}m\``;
    }

    const channel = await clientRef.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    const ultimaActualizacion = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // -------- Mensaje PRINCIPAL (se edita) SIN menciones --------
    let content =
      `# 📋 **Whitelist pendientes:** \`${pendientes}\`\n` +
      `${tiempoTexto}\n\n` +
      `-# (Última actualización: ${ultimaActualizacion})`;

    if (messageId) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit(content);
      } else {
        const sent = await channel.send(content);
        messageId = sent.id;
      }
    } else {
      const sent = await channel.send(content);
      messageId = sent.id;
    }

    // --------- AVISOS ESCALONADOS (mensaje NUEVO + borrar el anterior) ---------
    // Horario permitido para avisos (08:00–01:00)
    const horaActual = new Date().getHours();
    const horarioPermitido = horaActual >= 8 || horaActual < 1;

    // Nivel deseado según antigüedad (solo si hay pendientes)
    const desiredLevel = (pendientes > 0) ? getLevelBySeconds(segundos) : null;

    // Si no hay nivel/rol/horario → borrar aviso existente si lo hay y salir
    if (!desiredLevel || !ROLE_ID || !horarioPermitido) {
      if (currentAlert.id) {
        const old = await channel.messages.fetch(currentAlert.id).catch(() => null);
        if (old) await old.delete().catch(() => {});
        currentAlert = { level: null, id: null };
      }
      return;
    }

    // Si el nivel es el mismo que el actual → no reenviar ni hacer nada
    if (currentAlert.level && currentAlert.level === desiredLevel) {
      return;
    }

    // Si hay aviso anterior y cambia el nivel → borrar el anterior
    if (currentAlert.id) {
      const old = await channel.messages.fetch(currentAlert.id).catch(() => null);
      if (old) await old.delete().catch(() => {});
      currentAlert = { level: null, id: null };
    }

    // Enviar el nuevo aviso según el nivel (MENSAJE NUEVO → sí notifica)
    let aviso = "";
    if (desiredLevel === 'warn') {
      aviso = `🟡 **Aviso** <@&${ROLE_ID}> — Hay **Whitelist pendientes** desde hace más de **4 horas**. ¡Revisadlas cuanto antes!`;
    } else if (desiredLevel === 'urgent') {
      aviso = `🔴 **Urgente** <@&${ROLE_ID}> — Hay **Whitelist pendientes** desde hace más de **8 horas**. ⚡ ¡Prioridad máxima!`;
    } else if (desiredLevel === 'critical') {
      aviso = `🚨 **CRÍTICO** <@&${ROLE_ID}> — ¡Existen **Whitelist pendientes** desde hace más de **24 horas**!`;
    }

    const sentAlert = await channel.send(aviso);
    currentAlert = { level: desiredLevel, id: sentAlert.id };

  } catch (err) {
    console.error("[wlStats] Error actualizando pendientes:", err);
  }
}

/* ---------------- RANKING ---------------- */
function formatRanking(rows) {
  if (rows.length === 0) return "Nadie ha corregido WL todavía.";

  return rows
    .map((r, i) => `#${i + 1} <@${r.staff_id}> — ${r.total} WL corregidas`)
    .join("\n");
}

async function postWeeklyRanking() {
  if (!clientRef) return;
  try {
    const { rows } = await pool.query(`
      SELECT staff_id, COUNT(*) AS total
      FROM public.wl_logs
      WHERE accion IN ('aceptar','rechazar')
        AND created_at >= date_trunc('week', NOW())
      GROUP BY staff_id
      ORDER BY total DESC
      LIMIT 10
    `);

    const channel = await clientRef.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    const content = `🏆 **Ranking semanal de corrección WL** 🏆\n\n${formatRanking(rows)}`;

    const sent = await channel.send(content);

    // ⏰ Borrar después de 24h
    setTimeout(async () => {
      try {
        await sent.delete().catch(() => {});
      } catch (_) {}
    }, 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error("[wlStats] Error generando ranking:", err);
  }
}

/* ---------------- PROGRAMADOR ---------------- */
function scheduleWeeklyRanking() {
  const now = new Date();
  const next = new Date(now);

  // Calcular próximo domingo a las 11:00
  next.setDate(now.getDate() + ((7 - now.getDay()) % 7)); // domingo
  next.setHours(11, 0, 0, 0);

  // Si ya pasó hoy a las 11:00, pasa al domingo siguiente
  if (next <= now) {
    next.setDate(next.getDate() + 7);
  }

  const msUntilNext = next.getTime() - now.getTime();
  console.log(`[wlStats] Ranking programado para: ${next}`);

  setTimeout(async () => {
    await postWeeklyRanking();
    scheduleWeeklyRanking(); // volver a programar el siguiente domingo
  }, msUntilNext);
}

module.exports = { init, updatePendingMessage, postWeeklyRanking, notifyNewWhitelist };
