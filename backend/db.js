// Conexión a PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render/Hobby en PG suele requerir SSL
});

// Forzar zona horaria a Madrid al iniciar la conexión
pool.query(`SET TIME ZONE 'Europe/Madrid'`).catch(err => {
  console.error("Error al fijar zona horaria:", err);
});

module.exports = { pool };
