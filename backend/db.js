// Conexión a PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render/Hobby en PG suele requerir SSL
});

module.exports = { pool };
