// db.js - versión PostgreSQL
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("⚠️ Falta la variable de entorno DATABASE_URL");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // necesario en muchos entornos de Render
  },
});

// Crear tablas si no existen
async function init() {
  console.log("🟢 Conectando a PostgreSQL...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      sold_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      last_status_change TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT
    );
  `);

  console.log("✅ Tablas verificadas/creadas en PostgreSQL");
}

init().catch((err) => {
  console.error("❌ Error inicializando base de datos:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
