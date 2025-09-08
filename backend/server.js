// Servidor Express base
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./db');

const app = express();

// CORS para tu Vite/React local
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/auth', require('./auth/discord'));


// Salud + ping a DB
app.get('/health', (_req,res)=> res.json({ ok:true }));
app.get('/db/ping', async (_req,res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) AS n FROM public.wl_solicitudes;');
    res.json(r.rows[0]); // { n: "0" } si está vacía
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rutas WL (crear/listar/detalle)
app.use('/wl', require('./routes/wl'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API lista en http://localhost:${PORT}`));
