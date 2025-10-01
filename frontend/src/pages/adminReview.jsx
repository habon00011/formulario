// src/pages/AdminReview.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./adminReview.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const STAFF_ALLOW = (import.meta.env.VITE_STAFF_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Ruta de login (con redirect a /admin)
const LOGIN_URL = `${API}/auth/discord/login?redirect=${encodeURIComponent(
  "/wl/admin"
)}`;

const QUESTIONS = [
  { key: "que_es_rp", label: "¿Qué es el rol (RP)?" },
  { key: "uso_me_do", label: "¿Para qué sirve /do y /me? Uso correcto." },
  { key: "fair_play", label: "¿Qué es Fair-play?" },
  { key: "pg_y_mg", label: "¿Qué es PG y MG?" },
  {
    key: "como_robarias_base_militar",
    label: "¿Cómo robarías armas de la base militar?",
  },
  {
    key: "caso_pinchan_ruedas",
    label: "Te pinchan ruedas y al /report se lía a tiros: ¿qué está mal?",
  },
  {
    key: "reaccion_robo_policia",
    label: "Robo y llega policía antes: ¿qué haces?",
  },
  { key: "que_harias_vdm", label: "Te atropellan (VDM): ¿qué haces?" },
  {
    key: "que_harias_desconecta_secuestro",
    label: "Secuestran y se desconecta: ¿qué haces?",
  },
  { key: "minimo_policias_flecca", label: "¿Mínimo de policías para Flecca?" },
  { key: "rol_pensado", label: "¿Qué rol tienes pensado (Legal/Ilegal/Otro)?" },
  { key: "tiempo_roleando", label: "Tiempo roleando" },
  { key: "historia_personaje", label: "Historia del personaje" },
];

function SteamLinkChip({ url }) {
  if (!url) return <span className="muted">—</span>;
  const withProto = url.startsWith("http") ? url : `https://${url}`;
  const pretty =
    withProto.replace(/^https?:\/\//, "").slice(0, 60) +
    (withProto.length > 60 ? "…" : "");
  return (
    <a
      href={withProto}
      target="_blank"
      rel="noreferrer"
      className="chip-link"
      title={withProto}
    >
      {pretty}
    </a>
  );
}

export default function AdminReview() {
  // ---------- Auth ----------

  const [steamCheck, setSteamCheck] = useState(null); // 'ok' | 'no_hours' | 'private' | null

  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function fetchMe() {
    try {
      setAuthLoading(true);
      const r = await fetch(`${API}/auth/me`, { credentials: "include" });
      if (!r.ok) throw new Error("NO_AUTH");
      const j = await r.json();
      setMe(j);
    } catch {
      setMe(null);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
  }, []);

  const isStaff = useMemo(() => {
    if (!me) return false;
    return Boolean(me.is_staff) || STAFF_ALLOW.includes(String(me.discord_id));
  }, [me]);

  const authHeaders = me
    ? { "x-staff-id": me.discord_id, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  // ---------- Datos panel ----------
  const [pending, setPending] = useState([]);
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState(null);
  const [dec, setDec] = useState({});
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const allTrue = QUESTIONS.every((q) => dec[q.key] === true);

  async function apiListPending() {
    const r = await fetch(`${API}/wl/pending`, {
      headers: authHeaders,
      credentials: "include",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  async function apiGetDetail(id) {
    const r = await fetch(`${API}/wl/detail/${id}`, {
      headers: authHeaders,
      credentials: "include",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  async function apiSendReview(id, payload) {
    const r = await fetch(`${API}/wl/review/${id}`, {
      method: "POST",
      headers: authHeaders,
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  const loadPending = async () => {
    try {
      setMsg("");
      const data = await apiListPending();
      setPending(Array.isArray(data) ? data : []);
    } catch (e) {
      setPending([]);
      setMsg(e.message || "Error cargando pendientes");
    }
  };

  useEffect(() => {
    if (me && isStaff) loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isStaff]);

  const openOne = async (id) => {
    setMsg("");
    try {
      const data = await apiGetDetail(id);
      setSel(data);
      const init = {};
      QUESTIONS.forEach((q) => {
        init[q.key] = null;
      });
      setDec(init);
      setNotes("");
      setSteamCheck(null);
    } catch (e) {
      setSel(null);
      setMsg(e.message || "Error cargando WL");
    }
  };

  const {
    score,
    total,
    pct,
    wrongCount,
    unansweredCount,
    allAnswered,
    allCorrect,
  } = useMemo(() => {
    const t = QUESTIONS.length;
    const vals = Object.values(dec);
    const s = vals.filter((v) => v === true).length;
    const wrong = vals.filter((v) => v === false).length;
    const answered = vals.filter((v) => v !== null).length;
    const unanswered = t - answered;
    const p = t ? Math.round((s / t) * 100) : 0;

    return {
      score: s,
      total: t,
      pct: p,
      wrongCount: wrong,
      unansweredCount: unanswered,
      allAnswered: unanswered === 0,
      allCorrect: unanswered === 0 && wrong === 0,
    };
  }, [dec]);

  const setAll = (val) => {
    if (!sel) return;
    const next = {};
    QUESTIONS.forEach((q) => {
      next[q.key] = val;
    });
    setDec(next);
  };

  const toggle = (k, val) => setDec((d) => ({ ...d, [k]: val }));

  const approve = async (ok) => {
    if (!sel) return;

    // Si intentas APROBAR, valida primero: todo respondido y todo correcto.
    if (ok) {
      if (!allAnswered) {
        const txt = `No puedes aprobar: faltan ${unansweredCount} pregunta(s) por marcar.`;
        setMsg(txt);
        // Si quieres popup además del mensaje, descomenta:
        // alert(txt);
        return;
      }

      if (steamCheck !== "ok") {
        setMsg(
          'No puedes aprobar: Steam no verificado (selecciona "Steam OK (≥50h)").'
        );
        return;
      }

      if (!allCorrect) {
        const txt = `No puedes aprobar: hay ${wrongCount} respuesta(s) incorrecta(s).`;
        setMsg(txt);
        // alert(txt);
        return;
      }
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await apiSendReview(sel.id, {
        decisions: dec,
        notas: notes,
        steam_check: steamCheck, // <<<<<< ENVÍA EL MOTIVO
        aprobar: ok,
      });
      const data = res?.data || {};
      setMsg(
        `Guardado: ${String(data.estado || "OK").toUpperCase()} • Puntuación ${
          data.puntuacion_total ?? score
        }/${total}`
      );
      setSel(null);
      loadPending();
    } catch (e) {
      setMsg(e.message || "Error guardando revisión");
    } finally {
      setLoading(false);
    }
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(
      (x) =>
        String(x.id).includes(q) ||
        (x.discord_username || "").toLowerCase().includes(q)
    );
  }, [pending, filter]);

  // ---------- UI ----------
  if (authLoading) {
    return (
      <div className="shell">
        <div className="app-bg" />
        <div className="container-vila">
          <div className="sub admin-loading">Cargando…</div>
        </div>
      </div>
    );
  }

  // Sin sesión o no autorizado
  if (!me || !isStaff) {
    return (
      <div className="shell">
        <div className="app-bg" />
        <div className="container-vila">
          <div className="admin-center">
            <div className="card section admin-authCard">
              <h2 className="h2 admin-authTitle">Acceso al Panel de Staff</h2>
              <p className="sub admin-authText">
                {me
                  ? "Tu cuenta no está autorizada. Entra con una cuenta de staff."
                  : "Debes iniciar sesión con Discord para continuar."}
              </p>
              <a href={LOGIN_URL} className="btn btn-primary">
                Entrar con Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Panel
  return (
    <div className="shell">
      <div className="app-bg" />
      <div className="container-vila admin-wide">
        <header className="admin-header">
          <h1 className="h1">Panel de corrección WL</h1>
          <div className="admin-header-actions">
            <button className="btn btn-ghost" onClick={loadPending}>
              Refrescar
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                    window.location.href = `${API}/auth/discord/login?redirect=${encodeURIComponent(
                      "/wl/admin/all"
                    )}`;
                  }}
            >
              Ver todas las WL
            </button>
          </div>
        </header>

        <div className="card section admin-grid">
          {/* Columna izquierda */}
          <div className="admin-left">
            <div className="field admin-search">
              <input
                className="input"
                placeholder=" "
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <label>Buscar por usuario o ID</label>
            </div>

            <div className="card section admin-list">
              {visible.length === 0 ? (
                <div className="sub">No hay pendientes.</div>
              ) : (
                <ul className="admin-ul">
                  {visible.map((item) => (
                    <li
                      key={item.id}
                      className="card section admin-list-item"
                      onClick={() => openOne(item.id)}
                    >
                      <div className="admin-list-item-row">
                        <div>
                          <b>#{item.id}</b> — {item.discord_username}
                        </div>
                        <small>
                          {new Date(
                            item.created_at || Date.now()
                          ).toLocaleString()}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Columna derecha */}
          <div className="admin-right">
            {!sel ? (
              <div className="sub">
                Selecciona una solicitud a la izquierda.
              </div>
            ) : (
              <div className="card section admin-detail">
                {/* Barra de progreso DENTRO del card, arriba del título */}
                <div
                  className="admin-progress-top"
                  style={{ marginBottom: 12 }}
                >
                  <div className="progress admin-progress">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <small className="sub admin-progress-caption">
                    Debes acertar el 100% para aprobar.
                    {!allAnswered &&
                      ` • Te faltan ${unansweredCount} por marcar.`}
                    {allAnswered &&
                      !allCorrect &&
                      ` • ${wrongCount} incorrecta(s).`}
                  </small>
                </div>

                {/* Cabecera compacta */}
                <h2 className="admin-title">
                  WL #{sel?.id ?? "—"} — {sel?.discord_username ?? "—"}
                </h2>

                <p>
                  <strong>Intentos usados</strong>: {sel.intentos_usados} / 3
                </p>

                {/* Discord ID clicable */}
                <div className="form-row form-row--link">
                  <div className="form-row__label">Discord ID:</div>
                  <div className="form-row__content">
                    {sel?.discord_id ? (
                      <a
                        href={`https://discord.com/users/${sel.discord_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="chip-link"
                        title="Abrir perfil de Discord"
                      >
                        {sel.discord_id}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                </div>

                {/* Steam link */}
                <div className="form-row form-row--link">
                  <div className="form-row__label">Steam:</div>
                  <div className="form-row__content">
                    <SteamLinkChip url={sel?.steam_link} />
                  </div>
                </div>

                {/* Verificación de Steam */}
                <div className="form-row">
                  <div className="form-row__label">Verificación:</div>
                  <div className="form-row__content">
                    <div className="chip-row">
                      <button
                        type="button"
                        className={`btn chip ${
                          steamCheck === "ok" ? "active" : ""
                        }`}
                        onClick={() => setSteamCheck("ok")}
                        title="Perfil visible y ≥ 50h FiveM"
                      >
                        Steam OK (≥50h)
                      </button>
                      <button
                        type="button"
                        className={`btn chip ${
                          steamCheck === "no_hours" ? "active" : ""
                        }`}
                        onClick={() => setSteamCheck("no_hours")}
                        title="Menos de 50 horas en FiveM"
                      >
                        Sin 50h
                      </button>
                      <button
                        type="button"
                        className={`btn chip ${
                          steamCheck === "private" ? "active" : ""
                        }`}
                        onClick={() => setSteamCheck("private")}
                        title="Perfil no público / no visible"
                      >
                        No público
                      </button>
                    </div>
                  </div>
                </div>

                {/* —— PREGUNTAS —— */}
                <div className="admin-questions">
                  {QUESTIONS.map((q) => (
                    <div key={q.key} className="section card admin-question">
                      <div className="admin-question-label">{q.label}</div>
                      <div className="answer-box">
                        {sel?.[q.key] ? (
                          String(sel[q.key])
                        ) : (
                          <i className="answer-empty">(sin respuesta)</i>
                        )}
                      </div>

                      <div className="answer-actions">
                        <button
                          type="button"
                          onClick={() => toggle(q.key, true)}
                          className={`btn answer-btn yes ${
                            dec[q.key] === true ? "active" : ""
                          }`}
                        >
                          ✅ Correcta
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(q.key, false)}
                          className={`btn answer-btn no ${
                            dec[q.key] === false ? "active" : ""
                          }`}
                        >
                          ❌ Incorrecta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Marcado masivo */}
                <div className="admin-bulk">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setAll(true)}
                  >
                    Marcar todas ✓
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setAll(false)}
                  >
                    Marcar todas ✗
                  </button>
                </div>

                {/* Notas */}
                <div className="section admin-notes">
                  <div className="field">
                    <textarea
                      rows={4}
                      className="textarea"
                      placeholder=" "
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <label>Notas internas (solo staff)</label>
                  </div>
                </div>

                {/* Acciones */}
                <div className="admin-actions">
                  <button
                    disabled={loading}
                    className="btn btn-primary"
                    onClick={() => approve(true)}
                  >
                    {loading ? "Guardando…" : "Aprobar ✅"}
                  </button>
                  <button
                    disabled={loading}
                    className="btn btn-ghost"
                    onClick={() => approve(false)}
                  >
                    {loading ? "Guardando…" : "Rechazar ❌"}
                  </button>
                  {msg && <div className="sub admin-msg">{msg}</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="sub admin-footer">
          VilanovaCity • Panel de Staff
        </footer>
      </div>
    </div>
  );
}
