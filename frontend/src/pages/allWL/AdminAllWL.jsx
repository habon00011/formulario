import React, { useEffect, useMemo, useState } from "react";
import "../adminReview.css"; // puedes usar el mismo css del panel de corrección

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const STAFF_ALLOW = (import.meta.env.VITE_STAFF_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Preguntas con su key en la BD
const QUESTIONS = [
  { key: "que_es_rp", label: "¿Qué es el rol (RP)?" },
  { key: "uso_me_do", label: "¿Para qué sirve /do y /me? Uso correcto." },
  { key: "fair_play", label: "¿Qué es Fair-play?" },
  { key: "pg_y_mg", label: "¿Qué es PG y MG?" },
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
  {
    key: "como_robarias_base_militar",
    label: "¿Cómo robarías armas de la base militar?",
  },
  {
    key: "caso_pinchan_ruedas",
    label: "Te pinchan ruedas y al /report se lía a tiros: ¿qué está mal?",
  },
  { key: "rol_pensado", label: "¿Qué rol tienes pensado (Legal/Ilegal/Otro)?" },
  { key: "historia_personaje", label: "Historia del personaje" },
];

export default function AdminAllWL() {
  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState("");

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

  const isStaff = useMemo(() => {
    if (!me) return false;
    return Boolean(me.is_staff) || STAFF_ALLOW.includes(String(me.discord_id));
  }, [me]);

  const authHeaders = me
    ? { "x-staff-id": me.discord_id, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  async function apiListAll() {
    const r = await fetch(`${API}/wl/all`, {
      headers: authHeaders,
      credentials: "include",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    if (me && isStaff) {
      apiListAll()
        .then((data) => setPending(Array.isArray(data) ? data : []))
        .catch((e) => setMsg(e.message || "Error cargando WL"));
    }
  }, [me, isStaff]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(
      (x) =>
        String(x.id).includes(q) ||
        (x.discord_username || "").toLowerCase().includes(q)
    );
  }, [pending, filter]);

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
              <a
                href={`${API}/auth/discord/login?redirect=/admin`}
                className="btn btn-primary"
              >
                Entrar con Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="app-bg" />
      <div className="container-vila admin-wide">
        <header className="admin-header">
          <h1 className="h1">Todas las Whitelist</h1>
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
                <div className="sub">No hay WL enviadas.</div>
              ) : (
                <ul className="admin-ul">
                  {visible.map((item) => (
                    <li
                      key={item.id}
                      className="card section admin-list-item"
                      onClick={() => setSelected(item)}
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
            {!selected ? (
              <div className="sub">Selecciona una WL a la izquierda.</div>
            ) : (
              <div className="card section admin-detail">
                <h2 className="admin-title">
                  WL #{selected?.id ?? "—"} —{" "}
                  {selected?.discord_username ?? "—"}
                </h2>

                <div className="form-row">
                  <div className="form-row__label">Discord ID:</div>
                  <div className="form-row__content">
                    {selected?.discord_id ? (
                      <a
                        href={`https://discord.com/users/${selected.discord_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="chip-link"
                      >
                        {selected.discord_id}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-row__label">Steam:</div>
                  <div className="form-row__content">
                    {selected?.steam_link ? (
                      <a
                        href={selected.steam_link}
                        target="_blank"
                        rel="noreferrer"
                        className="chip-link"
                      >
                        {selected.steam_link}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                </div>

                {/* Verificación de Steam */}
                <div className="form-row">
                  <div className="form-row__label">Verificación:</div>
                  <div className="form-row__content">
                    {(() => {
                      let notasInternas = null;
                      if (selected?.notas_internas) {
                        try {
                          notasInternas =
                            typeof selected.notas_internas === "string"
                              ? JSON.parse(selected.notas_internas)
                              : selected.notas_internas;
                        } catch {
                          notasInternas = null;
                        }
                      }
                      const steamCheck = notasInternas?.steam_check;

                      if (steamCheck === "ok")
                        return (
                          <span className="chip chip-steam ok">
                            Steam OK (≥50h)
                          </span>
                        );
                      if (steamCheck === "no_hours")
                        return (
                          <span className="chip chip-steam warn">Sin 50h</span>
                        );
                      if (steamCheck === "private")
                        return (
                          <span className="chip chip-steam private">
                            No público
                          </span>
                        );

                      return <span className="muted">(sin verificar)</span>;
                    })()}
                  </div>
                </div>

                {/* Preguntas */}
                <div className="admin-questions">
                  {QUESTIONS.map((q) => {
                    // comprobar si esta pregunta fue marcada correcta/incorrecta en las notas
                    let notasInternas = null;
                    if (selected?.notas_internas) {
                      if (typeof selected.notas_internas === "string") {
                        try {
                          notasInternas = JSON.parse(selected.notas_internas);
                        } catch {
                          notasInternas = null;
                        }
                      } else {
                        notasInternas = selected.notas_internas;
                      }
                    }

                    const correcta =
                      notasInternas?.decisiones?.[q.key] === true;
                    const incorrecta =
                      notasInternas?.decisiones?.[q.key] === false;

                    return (
                      <div
                        key={q.key}
                        className={`section card admin-question ${
                          correcta
                            ? "answer-correct"
                            : incorrecta
                            ? "answer-wrong"
                            : ""
                        }`}
                      >
                        <div className="admin-question-label">{q.label}</div>
                        <div className="answer-box">
                          {selected[q.key] ? (
                            String(selected[q.key])
                          ) : (
                            <i className="answer-empty">(sin respuesta)</i>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Notas internas */}
                <div className="section admin-notes">
                  <h3>Notas internas (solo staff)</h3>
                  <div className="answer-box">
                    {(() => {
                      try {
                        if (!selected.notas_internas)
                          return <i className="answer-empty">(ninguna)</i>;
                        const parsed =
                          typeof selected.notas_internas === "string"
                            ? JSON.parse(selected.notas_internas)
                            : selected.notas_internas;
                        return parsed.notas && parsed.notas.trim() !== "" ? (
                          parsed.notas
                        ) : (
                          <i className="answer-empty">(ninguna)</i>
                        );
                      } catch {
                        return (
                          <i className="answer-empty">(error al leer notas)</i>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {msg && <div className="sub admin-msg">{msg}</div>}

        <footer className="sub admin-footer">
          VilanovaCity • Panel de Staff
        </footer>
      </div>
    </div>
  );
}
