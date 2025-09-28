// services/wlStats.js
const { pool } = require("../db");

const CHANNEL_ID = process.env.WL_CHANNEL_ID; // canal donde se publica
const ROLE_ID = process.env.WL_ROLE_ID; // rol a etiquetar (Encargados)
const LOG_CHANNEL_ID = process.env.WL_LOG_CHANNEL_ID; // canal de logs Whitelist enviadas

let messageId = null;
let clientRef = null; // referencia al bot

function init(c) {
  clientRef = c;

  // Pendientes cada 5 min (ahora cada 1 min para test)
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

    let content = `# 📋 **Whitelist pendientes:** \`${pendientes}\`\n` + `${tiempoTexto}\n\n`;
    // 🚨 Avisos en horarios permitidos (08:00–01:00)
    const horaActual = new Date().getHours();
    const horarioPermitido = horaActual >= 8 || horaActual < 1;

    if (pendientes > 0 && ROLE_ID && horarioPermitido) {
      if (segundos > 4 * 3600 && segundos <= 8 * 3600) {
        content += `\n🟡 **Aviso** <@&${ROLE_ID}> — Hay **Whitelist pendientes** desde hace más de **4 horas**. ¡Revisadlas cuanto antes!`;
      }
      if (segundos > 8 * 3600 && segundos <= 24 * 3600) {
        content += `\n🔴 **Urgente** <@&${ROLE_ID}> — Hay **Whitelist pendientes** desde hace más de **8 horas**. ⚡ ¡Prioridad máxima!`;
      }
      if (segundos > 24 * 3600) {
        content += `\n🚨 **CRÍTICO** <@&${ROLE_ID}> — ¡Existen **Whitelist pendientes** desde hace más de **24 horas**!`;
      }

      content += `\n\n-# (Última actualización: ${ultimaActualizacion})`;
    }

    if (messageId) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit(content);
        return;
      }
    }

    const sent = await channel.send(content);
    messageId = sent.id;
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

    const content = `🏆 **Ranking semanal de corrección WL** 🏆\n\n${formatRanking(
      rows
    )}`;

    const sent = await channel.send(content);

    // ⏰ Borrar después de 24h (lunes 11:00 si se publica el domingo 11:00)
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
