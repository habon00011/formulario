// services/discordBot.js
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { updatePendingMessage, init } = require("./wlStats");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const RESULT_CHANNEL_ID = process.env.DISCORD_RESULT_CHANNEL_ID;

const ROLE_WL_OK = process.env.DISCORD_ROLE_WL_APROBADA;
const ROLE_SUSP1 = process.env.DISCORD_ROLE_WL_SUSP1;
const ROLE_SUSP2 = process.env.DISCORD_ROLE_WL_SUSP2;
const ROLE_SUSP3 = process.env.DISCORD_ROLE_WL_SUSP3;

const MAX_ATTEMPTS = 3;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

let ready = false;
client.once("ready", async () => {
  ready = true;
  console.log("[bot] listo");

  init(client); // 👉 pasamos el client aquí

  await updatePendingMessage();
  setInterval(updatePendingMessage, 60 * 1000); // cada 1 min para pruebas
});

if (!client.isReady?.()) client.login(TOKEN);

/* ---------- helpers de roles ---------- */
async function setApprovedRole(userId) {
  if (!ready) return;
  try {
    const g = await client.guilds.fetch(GUILD_ID);
    const m = await g.members.fetch(userId);

    // Quita roles de suspensión
    for (const r of [ROLE_SUSP1, ROLE_SUSP2, ROLE_SUSP3]) {
      if (r) await m.roles.remove(r).catch(() => {});
    }
    // Añade “WL aprobada”
    if (ROLE_WL_OK) await m.roles.add(ROLE_WL_OK).catch(() => {});
  } catch (e) {
    console.error("[discordBot] setApprovedRole error", e);
  }
}

async function setSuspensionRole(userId, intentoNum /* 1..3 */) {
  if (!ready) return;
  try {
    const g = await client.guilds.fetch(GUILD_ID);
    const m = await g.members.fetch(userId);

    // Quita aprobada
    if (ROLE_WL_OK) await m.roles.remove(ROLE_WL_OK).catch(() => {});

    // Quita suspensiones previas
    for (const r of [ROLE_SUSP1, ROLE_SUSP2, ROLE_SUSP3]) {
      if (r) await m.roles.remove(r).catch(() => {});
    }

    // Pone la que toca
    const map = { 1: ROLE_SUSP1, 2: ROLE_SUSP2, 3: ROLE_SUSP3 };
    const target = map[intentoNum] || ROLE_SUSP3;
    if (target) await m.roles.add(target).catch(() => {});
  } catch (e) {
    console.error("[discordBot] setSuspensionRole error", e);
  }
}

/* ---------- mensaje de resultado ---------- */
/**
 * Envía un mensaje simple con mención (para notificar al usuario).
 * Si es rechazo, añade intentos restantes y, si se pasa, el motivo.
 */
async function sendResultMessage({
  userId,
  approved,
  attemptsUsed = 0,
  triesDone,
  rejectReasons = [], // motivo de rechazo opcional (p.ej. "Horas de FiveM insuficientes" | "Steam no público" | "Respuestas incorrectas")
}) {
  if (!ready) return;
  try {
    const channel =
      client.channels.cache.get(RESULT_CHANNEL_ID) ||
      (await client.channels.fetch(RESULT_CHANNEL_ID));

    const used = Math.min(
      MAX_ATTEMPTS,
      Math.max(0, Number(attemptsUsed ?? triesDone ?? 0))
    );

    // Siempre calcula en base al máximo
    const left = Math.max(0, MAX_ATTEMPTS - used);

    let content;
    if (approved) {
      // ✅ Aprobado
      content = `🎉 **¡Felicidades, <@${userId}>! Has aprobado la Whitelist de VilanovaCity. ¡Te esperamos en la ciudad!**`;
    } else {
      // ❌ Rechazado
      content = `❌ Has suspendido la Whitelist <@${userId}> — Intentos restantes: \`${left}\``;
      if (rejectReasons && rejectReasons.length > 0) {
        content += `\n**Motivos:** ` + rejectReasons.map((r) => `• ${r}`).join(" ");
      }
    }

    await channel.send({
      content,
      // así solo se notifica al usuario mencionado
      allowedMentions: { users: [userId] },
    });
  } catch (e) {
    console.error("[discordBot] sendResultMessage error", e);
  }
}

module.exports = {
  client,
  setSuspensionRole,
  setApprovedRole,
  sendResultMessage,
};
