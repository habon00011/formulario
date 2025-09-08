// src/pages/AdminReview.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const STAFF_ALLOW = (import.meta.env.VITE_STAFF_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ⬇️ Usa la ruta de login de TU backend.
//    Si tu backend expone /auth/discord/login, cambia la constante siguiente a '/auth/discord/login'
const LOGIN_PATH = '/auth/discord';

// ⬇️ Importante: forzamos el redirect a /admin (no usamos window.location.href)
const LOGIN_URL = `${API}/auth/discord/login?redirect=${encodeURIComponent('/admin')}`;



const QUESTIONS = [
  { key: 'que_es_rp', label: '¿Qué es el rol (RP)?' },
  { key: 'uso_me_do', label: '¿Para qué sirve /do y /me? Uso correcto.' },
  { key: 'fair_play', label: '¿Qué es Fair-play?' },
  { key: 'pg_y_mg', label: '¿Qué es PG y MG?' },
  { key: 'reaccion_robo_policia', label: 'Robo y llega policía antes: ¿qué haces?' },
  { key: 'que_harias_vdm', label: 'Te atropellan (VDM): ¿qué haces?' },
  { key: 'que_harias_desconecta_secuestro', label: 'Secuestran y se desconecta: ¿qué haces?' },
  { key: 'minimo_policias_flecca', label: '¿Mínimo de policías para Flecca?' },
  { key: 'como_robarias_base_militar', label: '¿Cómo robarías armas de la base militar?' },
  { key: 'caso_pinchan_ruedas', label: 'Te pinchan ruedas y al /report se lía a tiros: ¿qué está mal?' },
  { key: 'rol_pensado', label: '¿Qué rol tienes pensado (Legal/Ilegal/Otro)?' },
  { key: 'historia_personaje', label: 'Historia del personaje' },
];

export default function AdminReview() {
  // ---------- Auth ----------
  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function fetchMe() {
    try {
      setAuthLoading(true);
      const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (!r.ok) throw new Error('NO_AUTH');
      const j = await r.json();
      setMe(j);
    } catch {
      setMe(null);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => { fetchMe(); }, []);

  const isStaff = useMemo(() => {
    if (!me) return false;
    return Boolean(me.is_staff) || STAFF_ALLOW.includes(String(me.discord_id));
  }, [me]);

  const authHeaders = me
    ? { 'x-staff-id': me.discord_id, 'Content-Type': 'application/json' } // header en minúsculas por Node
    : { 'Content-Type': 'application/json' };

  // ---------- Datos panel ----------
  const [pending, setPending] = useState([]);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState(null);
  const [dec, setDec] = useState({});
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function apiListPending() {
    const r = await fetch(`${API}/wl/pending`, { headers: authHeaders, credentials: 'include' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  async function apiGetDetail(id) {
    const r = await fetch(`${API}/wl/detail/${id}`, { headers: authHeaders, credentials: 'include' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  async function apiSendReview(id, payload) {
    const r = await fetch(`${API}/wl/review/${id}`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  const loadPending = async () => {
    try {
      setMsg('');
      const data = await apiListPending();
      setPending(Array.isArray(data) ? data : []);
    } catch (e) {
      setPending([]);
      setMsg(e.message || 'Error cargando pendientes');
    }
  };

  useEffect(() => {
    if (me && isStaff) loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, isStaff]);

  const openOne = async (id) => {
    setMsg('');
    try {
      const data = await apiGetDetail(id);
      setSel(data);
      const init = {};
      QUESTIONS.forEach(q => { init[q.key] = null; });
      setDec(init);
      setNotes('');
    } catch (e) {
      setSel(null);
      setMsg(e.message || 'Error cargando WL');
    }
  };

  const { score, total, pct } = useMemo(() => {
    const t = QUESTIONS.length;
    const s = Object.values(dec).filter(v => v === true).length;
    const p = t ? Math.round((s / t) * 100) : 0;
    return { score: s, total: t, pct: p };
  }, [dec]);

  const setAll = (val) => {
    if (!sel) return;
    const next = {};
    QUESTIONS.forEach(q => { next[q.key] = val; });
    setDec(next);
  };
  const toggle = (k, val) => setDec(d => ({ ...d, [k]: val }));

  const approve = async (ok) => {
    if (!sel) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await apiSendReview(sel.id, { decisions: dec, notes, aprobar: ok });
      const data = res?.data || {};
      setMsg(`Guardado: ${String(data.estado || 'OK').toUpperCase()} • Puntuación ${data.puntuacion_total ?? score}/${total}`);
      setSel(null);
      loadPending();
    } catch (e) {
      setMsg(e.message || 'Error guardando revisión');
    } finally {
      setLoading(false);
    }
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(x =>
      String(x.id).includes(q) || (x.discord_username || '').toLowerCase().includes(q)
    );
  }, [pending, filter]);

  // ---------- UI ----------
  if (authLoading) {
    return (
      <div className="shell"><div className="app-bg" /><div className="container-vila">
        <div className="sub" style={{textAlign:'center', marginTop:40}}>Cargando…</div>
      </div></div>
    );
  }

  // Un único botón (si no hay sesión o no está autorizado)
  if (!me || !isStaff) {
    return (
      <div className="shell">
        <div className="app-bg" />
        <div className="container-vila">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="card section" style={{maxWidth:420, width:'100%', textAlign:'center'}}>
              <h2 className="h2" style={{marginBottom:8}}>Acceso al Panel de Staff</h2>
              <p className="sub" style={{marginBottom:16}}>
                {me ? 'Tu cuenta no está autorizada. Entra con una cuenta de staff.' : 'Debes iniciar sesión con Discord para continuar.'}
              </p>
              <a href={LOGIN_URL} className="btn btn-primary">Entrar con Discord</a>
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
      <div className="container-vila">
        <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <h1 className="h1">Panel de corrección WL</h1>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-ghost" onClick={loadPending}>Refrescar</button>
          </div>
        </header>

        <div className="card section" style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:16}}>
          {/* Columna izquierda */}
          <div>
            <div className="field" style={{marginBottom:10}}>
              <input className="input" placeholder=" " value={filter} onChange={e=>setFilter(e.target.value)} />
              <label>Buscar por usuario o ID</label>
            </div>

            <div className="card section" style={{maxHeight: '60vh', overflow:'auto', padding:12}}>
              {visible.length === 0 ? (
                <div className="sub">No hay pendientes.</div>
              ) : (
                <ul style={{listStyle:'none', padding:0, margin:0}}>
                  {visible.map(item => (
                    <li key={item.id}
                        className="card section"
                        style={{padding:10, marginBottom:8, cursor:'pointer'}}
                        onClick={()=>openOne(item.id)}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div><b>#{item.id}</b> — {item.discord_username}</div>
                        <small style={{color:'var(--muted)'}}>
                          {new Date(item.created_at || Date.now()).toLocaleString()}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Columna derecha */}
          <div>
            {!sel ? (
              <div className="sub">Selecciona una solicitud a la izquierda.</div>
            ) : (
              <div className="card section">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                  <div>
                    <h2 style={{margin:0}}>WL #{sel.id} — {sel.discord_username}</h2>
                    <small className="sub">Discord ID: {sel.discord_id}</small>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="progress" style={{width:240, marginLeft:'auto'}}>
                      <span style={{width:`${pct}%`}} />
                    </div>
                    <small className="sub">{score}/{total} correctas ({pct}%)</small>
                  </div>
                </div>

                {QUESTIONS.map(q => (
                  <div key={q.key} className="section card" style={{marginBottom:12}}>
                    <div style={{fontWeight:700, marginBottom:8}}>{q.label}</div>
                    <div style={{
                      background:'rgba(255,255,255,.04)',
                      border:'1px solid var(--stroke)',
                      borderRadius:12, padding:12, whiteSpace:'pre-wrap'
                    }}>
                      {sel[q.key] ?? <i style={{color:'var(--muted)'}}>(sin respuesta)</i>}
                    </div>
                    <div style={{display:'flex', gap:8, marginTop:8}}>
                      <button
                        type="button"
                        onClick={()=>toggle(q.key, true)}
                        className="btn"
                        style={{
                          background: dec[q.key] === true ? '#1f8b4c' : 'rgba(255,255,255,.08)',
                          border: '1px solid var(--stroke)'
                        }}
                      >
                        ✅ Correcta
                      </button>
                      <button
                        type="button"
                        onClick={()=>toggle(q.key, false)}
                        className="btn"
                        style={{
                          background: dec[q.key] === false ? '#8b1f1f' : 'rgba(255,255,255,.08)',
                          border: '1px solid var(--stroke)'
                        }}
                      >
                        ❌ Incorrecta
                      </button>
                    </div>
                  </div>
                ))}

                <div style={{display:'flex', gap:8, marginTop:6}}>
                  <button className="btn btn-ghost" onClick={()=>setAll(true)}>Marcar todas ✓</button>
                  <button className="btn btn-ghost" onClick={()=>setAll(false)}>Marcar todas ✗</button>
                </div>

                <div className="section" style={{marginTop:8}}>
                  <div className="field">
                    <textarea rows={4} className="textarea" placeholder=" "
                              value={notes} onChange={e=>setNotes(e.target.value)} />
                    <label>Notas internas (solo staff)</label>
                  </div>
                </div>

                <div style={{display:'flex', gap:10, marginTop:8}}>
                  <button disabled={loading} className="btn btn-primary" onClick={()=>approve(true)}>
                    {loading ? 'Guardando…' : 'Aprobar ✅'}
                  </button>
                  <button disabled={loading} className="btn btn-ghost" onClick={()=>approve(false)}>
                    {loading ? 'Guardando…' : 'Rechazar ❌'}
                  </button>
                  {msg && <div className="sub" style={{marginLeft:10}}>{msg}</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="sub" style={{textAlign:'center', marginTop:20}}>
          VilanovaCity • Panel de Staff
        </footer>
      </div>
    </div>
  );
}
