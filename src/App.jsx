import React, { useEffect, useMemo, useState } from "react";
import { submitWL } from "./lib/api";
import "./App.css";

const API = import.meta.env.VITE_API_URL;
const LOGIN_URL = `${API}/auth/discord/login?redirect=${encodeURIComponent(
  "/"
)}`;

// --- Reglas de validación (auto-contenidas) ---
const RULES = {
  nombre_y_id_discord: (v) => req(v),
  edad_ooc: (v) => req(v) || numRange(v, 18, 80, "Edad inválida (18–80)"),
  steam_link: (v) => req(v) || urlSteam(v),

  que_es_rp: (v) => len(v, 30, 600, "Explica en 30–600 caracteres"),
  uso_me_do: (v) => len(v, 40, 400, "Explica en 40–400 caracteres"),
  fair_play: (v) => len(v, 30, 600, "Explica en 30–600 caracteres"),
  pg_y_mg: (v) => len(v, 30, 600, "Explica en 30–600 caracteres"),

  como_robarias_base_militar: (v) =>
    len(v, 40, 600, "Detalla en 40–600 caracteres"),
  caso_pinchan_ruedas: (v) => len(v, 40, 600, "Detalla en 40–600 caracteres"),

  rol_pensado: (v) => req(v),
  tiempo_roleando: (v) => len(v, 1, 60, "Indica un valor (1–60 caracteres)"),
  historia_personaje: (v) => len(v, 80, 1200, "Cuenta algo 80–1200 caracteres"),

  reaccion_robo_policia: (v) => len(v, 40, 600, "Detalla en 40–600"),
  que_harias_vdm: (v) => len(v, 40, 600, "Detalla en 40–600"),
  que_harias_desconecta_secuestro: (v) => len(v, 40, 600, "Detalla en 40–600"),
  minimo_policias_flecca: (v) =>
    /^\d{1,2}$/.test(String(v).trim()) ? "" : "Número válido (0–99)",
};

function req(v) {
  return String(v || "").trim() ? "" : "Requerido";
}
function len(v, min, max, msg) {
  const n = String(v || "").trim().length;
  return n < min || n > max ? msg : "";
}
function numRange(v, min, max, msg) {
  const s = String(v || "").trim();
  if (!/^\d{1,2}$/.test(s)) return "Solo números";
  const n = +s;
  return n < min || n > max ? msg : "";
}
function urlSteam(v) {
  const s = String(v || "").trim();
  return /^https?:\/\/(steamcommunity\.com|store\.steampowered\.com)\//i.test(s)
    ? ""
    : "Pega un enlace de Steam válido";
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [okId, setOkId] = useState(null);
  const [err, setErr] = useState("");
  const [me, setMe] = useState(null);

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [form, setForm] = useState({
    discord_id: "",
    discord_username: "",
    discord_avatar: null,
    is_in_guild: false,

    nombre_y_id_discord: "",
    edad_ooc: "",
    steam_link: "",
    que_es_rp: "",
    uso_me_do: "",
    fair_play: "",
    pg_y_mg: "",
    como_robarias_base_militar: "",
    caso_pinchan_ruedas: "",
    rol_pensado: "",
    tiempo_roleando: "",
    historia_personaje: "",
    reaccion_robo_policia: "",
    que_harias_vdm: "",
    que_harias_desconecta_secuestro: "",
    minimo_policias_flecca: "",
  });

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (d?.ok) {
          setMe(d.user);
          setForm((f) => ({
            ...f,
            discord_id: d.user.discord_id,
            discord_username: d.user.discord_username,
            discord_avatar: d.user.discord_avatar,
            is_in_guild: d.user.is_in_guild,
            nombre_y_id_discord: `${d.user.discord_username} | ${d.user.discord_id}`,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const update = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (touched[k]) {
      setErrors((errs) => ({
        ...errs,
        [k]: validateField(k, value, { ...form, [k]: value }),
      }));
    }
  };

  const required = [
    "nombre_y_id_discord",
    "edad_ooc",
    "steam_link",
    "que_es_rp",
    "uso_me_do",
    "fair_play",
    "pg_y_mg",
    "como_robarias_base_militar",
    "caso_pinchan_ruedas",
    "rol_pensado",
    "tiempo_roleando",
    "historia_personaje",

    "reaccion_robo_policia",
    "que_harias_vdm",
    "que_harias_desconecta_secuestro",
    "minimo_policias_flecca",
  ];

  const progress = useMemo(() => {
    const filled = required.filter(
      (k) => String(form[k] || "").trim() !== ""
    ).length;
    return Math.round((filled / required.length) * 100);
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setOkId(null);

    if (!me) {
      setErr("Primero entra con Discord.");
      return;
    }

    // ✅ VALIDACIÓN NUEVA
    const nextErrors = {};
    Object.keys(RULES).forEach((k) => {
      nextErrors[k] = RULES[k](form[k]);
    });
    setErrors(nextErrors);
    setTouched((t) => ({
      ...t,
      ...Object.fromEntries(Object.keys(RULES).map((k) => [k, true])),
    }));

    const firstBad = Object.keys(nextErrors).find((k) => nextErrors[k]);
    if (firstBad) {
      setErr("Revisa los campos marcados en rojo.");
      const el = document.querySelector(
        `[data-field="${firstBad}"] input, [data-field="${firstBad}"] textarea`
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      setLoading(true);

      const data = await submitWL(form);

      // 👇 NUEVO: manejar cooldown devuelto por el server
      if (data?.error === "COOLDOWN_ACTIVO") {
        const until = data.until ? new Date(data.until) : null;
        setErr(
          `Has alcanzado el límite de intentos. ${
            until
              ? `Podrás volver a intentarlo el ${until.toLocaleString()}.`
              : ""
          }`
        );
        setLoading(false);
        return;
      }

      if (data?.error) throw new Error(data.error);

      const newId = data?.id ?? data?.data?.id;
      if (!newId) throw new Error("Respuesta inválida del servidor");

      setOkId(newId);
      localStorage.removeItem("wl_draft");

      // Limpia solo respuestas, mantiene identidad de Discord
      setForm((f) => ({
        ...f,
        nombre_y_id_discord: `${f.discord_username} | ${f.discord_id}`,
        edad_ooc: "",
        steam_link: "",
        que_es_rp: "",
        uso_me_do: "",
        fair_play: "",
        pg_y_mg: "",
        como_robarias_base_militar: "",
        caso_pinchan_ruedas: "",
        rol_pensado: "",
        tiempo_roleando: "",
        historia_personaje: "",
        reaccion_robo_policia: "",
        que_harias_vdm: "",
        que_harias_desconecta_secuestro: "",
        minimo_policias_flecca: "",
      }));
      setTouched({});
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e.message || "Error enviando WL");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem("wl_draft");
    if (raw)
      try {
        setForm((f) => ({ ...f, ...JSON.parse(raw) }));
      } catch {}
  }, []);

  useEffect(() => {
    const toSave = {
      ...form,
      discord_id: "",
      discord_username: "",
      discord_avatar: null,
      is_in_guild: false,
    };
    const t = setTimeout(
      () => localStorage.setItem("wl_draft", JSON.stringify(toSave)),
      400
    );
    return () => clearTimeout(t);
  }, [form]);

  const validateField = (k, value) => {
    const fn = RULES[k];
    if (!fn) return "";
    return fn(value ?? form[k] ?? "");
  };

  const validateAll = () => {
    const next = {};
    Object.keys(RULES).forEach((k) => {
      next[k] = validateField(k);
    });
    setErrors(next);
    const ok = Object.values(next).every((m) => !m);
    return { ok, map: next };
  };

  const onBlur = (k) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors((errs) => ({ ...errs, [k]: validateField(k, form[k], form) }));
  };

  return (
    <>
      <div className="app-bg" />
      <div className="shell">
        <div className="container-vila">
          {/* Header */}
          <header
            style={{
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div>
              <h1 className="h1">
                WL de{" "}
                <span style={{ color: "var(--accent)" }}>VilanovaCity</span>
              </h1>
              <p className="sub">
                Rellena el formulario con calma. Nuestro staff lo revisará.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {me ? (
                <>
                  <div className="user">
                    {me.discord_avatar && (
                      <img src={me.discord_avatar} alt="" />
                    )}
                    <span>{me.discord_username}</span>
                  </div>
                  <button
                    onClick={async () => {
                      await fetch(`${API}/auth/logout`, {
                        method: "POST",
                        credentials: "include",
                      });
                      setMe(null);
                      setForm((f) => ({
                        ...f,
                        discord_id: "",
                        discord_username: "",
                        discord_avatar: null,
                        is_in_guild: false,
                        nombre_y_id_discord: "",
                      }));
                    }}
                    className="btn btn-ghost"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    window.location.href = `${API}/auth/discord/login?redirect=${encodeURIComponent(
                      "/"
                    )}`;
                  }}
                  className="btn btn-primary"
                >
                  Entrar con Discord
                </button>
              )}
            </div>
          </header>

          {/* Progreso */}
          <div className="card section" style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <strong style={{ color: "var(--title)" }}>
                Progreso del formulario
              </strong>
              <span style={{ color: "var(--muted)" }}>{progress}%</span>
            </div>
            <div className="progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Alertas */}
          {okId && (
            <div className="alert ok" style={{ margin: "12px 0" }}>
              ✅ ¡Enviado! ID de solicitud: <b>#{okId}</b>. Estate atento a
              Discord.
            </div>
          )}
          {err && (
            <div className="alert err" style={{ margin: "12px 0" }}>
              ⚠️ {err}
            </div>
          )}
          {!me && (
            <div className="alert warn" style={{ margin: "12px 0" }}>
              🔐 Para enviar tu WL, primero pulsa <b>Entrar con Discord</b>.
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit}>
            {/* Identidad */}
            <div className="card section">
              <h2>Identidad</h2>
              <div className="grid-2">
                <Field label="ID de Discord">
                  <input
                    className="input"
                    placeholder=" "
                    value={form.discord_id}
                    readOnly
                    disabled
                  />
                </Field>
                <Field label="Usuario de Discord">
                  <input
                    className="input"
                    placeholder=" "
                    value={form.discord_username}
                    readOnly
                    disabled
                  />
                </Field>
              </div>
              <p className="sub" style={{ marginTop: 10 }}>
                {" "}
                * Se autocompleta con tu cuenta de Discord.
              </p>
            </div>

            {/* Generales */}
            <div className="card section">
              <h2>Preguntas generales</h2>

              <Field
                name="nombre_y_id_discord"
                label="Nombre & ID de usuario en Discord"
                error={
                  touched.nombre_y_id_discord && errors.nombre_y_id_discord
                }
                onBlur={onBlur("nombre_y_id_discord")}
              >
                <input
                  className="input"
                  placeholder=" "
                  value={form.nombre_y_id_discord}
                  onChange={update("nombre_y_id_discord")}
                />
              </Field>

              <div className="grid-2">
                <Field
                  name="edad_ooc"
                  label="Edad OOC"
                  error={touched.edad_ooc && errors.edad_ooc}
                  onBlur={onBlur("edad_ooc")}
                >
                  <input
                    className="input"
                    placeholder=" "
                    value={form.edad_ooc}
                    onChange={update("edad_ooc")}
                  />
                </Field>

                <Field
                  name="steam_link"
                  label="Link de Steam (en Público, incluidos los juegos)"
                  error={touched.steam_link && errors.steam_link}
                  onBlur={onBlur("steam_link")}
                >
                  <input
                    className="input"
                    placeholder=" "
                    value={form.steam_link}
                    onChange={update("steam_link")}
                  />
                </Field>
              </div>
            </div>

            {/* Teoría */}
            <div className="card section">
              <h2>Teoría básica</h2>

              <Counter value={form.que_es_rp} max={600}>
                <Field
                  name="que_es_rp"
                  label="¿Qué es el rol (RP)?"
                  error={touched.que_es_rp && errors.que_es_rp}
                  onBlur={onBlur("que_es_rp")}
                >
                  <textarea
                    className="textarea"
                    placeholder=" "
                    value={form.que_es_rp}
                    onChange={update("que_es_rp")}
                  />
                </Field>
              </Counter>

              <Counter value={form.uso_me_do} max={400}>
                <Field
                  name="uso_me_do"
                  label="¿Para qué sirve el /do y /me? Explícanos su correcto uso."
                  error={touched.uso_me_do && errors.uso_me_do}
                  onBlur={onBlur("uso_me_do")}
                >
                  <textarea
                    className="textarea"
                    placeholder=" "
                    value={form.uso_me_do}
                    onChange={update("uso_me_do")}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                  />
                </Field>
              </Counter>

              <div className="grid-2">
                <Counter value={form.fair_play} max={600}>
                  <Field
                    name="fair_play"
                    label="¿Qué es Fair-play?"
                    error={touched.fair_play && errors.fair_play}
                    onBlur={onBlur("fair_play")}
                  >
                    <textarea
                      className="textarea"
                      placeholder=" "
                      value={form.fair_play}
                      onChange={update("fair_play")}
                    />
                  </Field>
                </Counter>

                <Counter value={form.pg_y_mg} max={600}>
                  <Field
                    name="pg_y_mg"
                    label="¿Qué es PG y MG?"
                    error={touched.pg_y_mg && errors.pg_y_mg}
                    onBlur={onBlur("pg_y_mg")}
                  >
                    <textarea
                      className="textarea"
                      placeholder=" "
                      value={form.pg_y_mg}
                      onChange={update("pg_y_mg")}
                    />
                  </Field>
                </Counter>
              </div>
            </div>

            {/* Supuestos */}
            <div className="card section">
              <h2>Supuestos de rol</h2>

              <Counter value={form.como_robarias_base_militar} max={600}>
                <Field
                  name="como_robarias_base_militar"
                  label="¿Cómo robarías las armas de la base militar?"
                  error={
                    touched.como_robarias_base_militar &&
                    errors.como_robarias_base_militar
                  }
                  onBlur={onBlur("como_robarias_base_militar")}
                >
                  <textarea
                    className="textarea"
                    placeholder=" "
                    value={form.como_robarias_base_militar}
                    onChange={update("como_robarias_base_militar")}
                  />
                </Field>
              </Counter>
              <p>
                Te encuentras con un jugador que se acerca sin motivo, te
                insulta y te pincha las ruedas del coche. Mientras ocurre esto,
                decides mandar un /report y después comienzas a dispararle.
                ¿Cuáles son los errores de rol que se cometen en esta situación?
              </p>
              <Counter value={form.caso_pinchan_ruedas} max={600}>
                <Field
                  name="caso_pinchan_ruedas"
                  label="Tu respuesta aqui"
                  error={
                    touched.caso_pinchan_ruedas && errors.caso_pinchan_ruedas
                  }
                  onBlur={onBlur("caso_pinchan_ruedas")}
                >
                  <textarea
                    className="textarea"
                    placeholder=" "
                    value={form.caso_pinchan_ruedas}
                    onChange={update("caso_pinchan_ruedas")}
                  />
                </Field>
              </Counter>

              <Counter value={form.reaccion_robo_policia} max={600}>
                <Field
                  name="reaccion_robo_policia"
                  label="Estás en medio de un robo y llega la policía antes de lo esperado. ¿Cómo reaccionarías para mantener el rol realista?"
                  error={
                    touched.reaccion_robo_policia &&
                    errors.reaccion_robo_policia
                  }
                  onBlur={onBlur("reaccion_robo_policia")}
                >
                  <textarea
                    className="textarea"
                    value={form.reaccion_robo_policia}
                    onChange={update("reaccion_robo_policia")}
                  />
                </Field>
              </Counter>

              <Counter value={form.que_harias_vdm} max={600}>
                <Field
                  name="que_harias_vdm"
                  label="Un jugador te atropella sin motivo (VDM). ¿Qué harías dentro del rol y después fuera de rol?"
                  error={touched.que_harias_vdm && errors.que_harias_vdm}
                  onBlur={onBlur("que_harias_vdm")}
                >
                  <textarea
                    className="textarea"
                    value={form.que_harias_vdm}
                    onChange={update("que_harias_vdm")}
                  />
                </Field>
              </Counter>

              <Counter value={form.que_harias_desconecta_secuestro} max={600}>
                <Field
                  name="que_harias_desconecta_secuestro"
                  label="Estás secuestrando a alguien y de repente se desconecta. ¿Qué harías?"
                  error={
                    touched.que_harias_desconecta_secuestro &&
                    errors.que_harias_desconecta_secuestro
                  }
                  onBlur={onBlur("que_harias_desconecta_secuestro")}
                >
                  <textarea
                    className="textarea"
                    value={form.que_harias_desconecta_secuestro}
                    onChange={update("que_harias_desconecta_secuestro")}
                  />
                </Field>
              </Counter>

              <Field
                name="minimo_policias_flecca"
                label="¿Cuántos policías se necesitan mínimo para robar un flecca en este servidor?"
                error={
                  touched.minimo_policias_flecca &&
                  errors.minimo_policias_flecca
                }
                onBlur={onBlur("minimo_policias_flecca")}
              >
                <input
                  type="number"
                  className="input"
                  value={form.minimo_policias_flecca}
                  onChange={update("minimo_policias_flecca")}
                  min={0}
                  step={1}
                />
              </Field>
            </div>

            {/* Perfil */}
            <div className="card section">
              <h2>Tu perfil</h2>

              <div className="grid-2">
                <Field
                  name="rol_pensado"
                  label="¿Qué rol tienes pensado hacer? (Legal / Ilegal / Otro)"
                  error={touched.rol_pensado && errors.rol_pensado}
                  onBlur={onBlur("rol_pensado")}
                >
                  <input
                    className="input"
                    placeholder=" "
                    value={form.rol_pensado}
                    onChange={update("rol_pensado")}
                  />
                </Field>

                <Field
                  name="tiempo_roleando"
                  label="¿Cuánto tiempo llevas roleando?"
                  error={touched.tiempo_roleando && errors.tiempo_roleando}
                  onBlur={onBlur("tiempo_roleando")}
                >
                  <input
                    className="input"
                    placeholder=" "
                    value={form.tiempo_roleando}
                    onChange={update("tiempo_roleando")}
                  />
                </Field>
              </div>

              <Counter value={form.historia_personaje} max={1200}>
                <Field
                  name="historia_personaje"
                  label="Historia del personaje"
                  error={
                    touched.historia_personaje && errors.historia_personaje
                  }
                  onBlur={onBlur("historia_personaje")}
                >
                  <textarea
                    className="textarea"
                    placeholder=" "
                    value={form.historia_personaje}
                    onChange={update("historia_personaje")}
                  />
                </Field>
              </Counter>
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="submit"
                disabled={loading || !me}
                className="btn btn-primary"
              >
                {loading ? "Enviando…" : "Enviar solicitud"}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-ghost"
              >
                Limpiar
              </button>
            </div>
          </form>

          <footer
            className="sub"
            style={{ textAlign: "center", marginTop: 26 }}
          >
            VilanovaCity • A tope para ser el mejor servidor de España 💜
          </footer>
        </div>
      </div>
    </>
  );
}

/* ---------- Helpers UI ---------- */
function Field({ label, name, error, onBlur, children }) {
  const id = useMemo(() => "f_" + Math.random().toString(36).slice(2, 8), []);
  const child = React.cloneElement(children, {
    id,
    placeholder: " ",
    onBlur,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-err` : undefined,
    className: (children.props.className || "") + (error ? " error" : ""),
  });

  return (
    <div className="field" data-field={name}>
      {child}
      <label htmlFor={id}>{label}</label>
      {error ? (
        <div id={`${id}-err`} className="error-msg">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Counter({ value, max = 600, children }) {
  const used = (value || "").length;
  return (
    <div>
      {children}
      <div className="counter">
        <span>
          {used}/{max}
        </span>
      </div>
    </div>
  );
}
