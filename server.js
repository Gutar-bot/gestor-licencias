// server.js - versión PostgreSQL
const express = require("express");
const cors = require("cors");
const db = require("./db");
const path = require("path");

const app = express();

// ====== CONFIG LOGIN (puedes cambiarlos) ======
const AUTH_USER = "admin";
const AUTH_PASS = "1234";
const AUTH_TOKEN = "dibutek-super-token-123456";

// Clave para la API de validación (cámbiala por algo más largo/propio)
const API_KEY = process.env.API_KEY || "1914-1985-1986-2025";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

console.log("🟢 Backend iniciado...");

// ====== LOGIN ======
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === AUTH_USER && password === AUTH_PASS) {
    return res.json({ token: AUTH_TOKEN });
  }

  return res.status(401).json({ error: "Credenciales inválidas" });
});

// ====== MIDDLEWARE DE AUTORIZACIÓN ======
function authMiddleware(req, res, next) {
  const p = req.path;

  if (p.startsWith("/clients") || p.startsWith("/licenses")) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (token === AUTH_TOKEN) {
      return next();
    }
    return res.status(401).json({ error: "No autorizado" });
  }

  next();
}

app.use(authMiddleware);

// ================= CLIENTES =================

// Listar clientes
app.get("/clients", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM clients ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al cargar clientes:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Crear cliente
app.post("/clients", async (req, res) => {
  const { name, email, phone, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: "El nombre es obligatorio" });
  }

  try {
    const result = await db.query(
      "INSERT INTO clients (name, email, phone, notes) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, email, phone, notes || null]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error("❌ Error al crear cliente:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= LICENCIAS =================

// Listar licencias con filtros
app.get("/licenses", async (req, res) => {
  const { status, client_id } = req.query;

  let query = "SELECT * FROM licenses WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  if (client_id) {
    query += ` AND client_id = $${paramIndex++}`;
    params.push(client_id);
  }

  query += " ORDER BY id DESC";

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error al cargar licencias:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Crear licencia
app.post("/licenses", async (req, res) => {
  const { token, status, notes } = req.body;

  if (!token) {
    return res.status(400).json({ error: "El token es obligatorio" });
  }

  try {
    const result = await db.query(
      "INSERT INTO licenses (token, status, notes) VALUES ($1, $2, $3) RETURNING id",
      [token, status || "disponible", notes || null]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error("❌ Error al crear licencia:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Vender licencia
app.post("/licenses/:id/sell", async (req, res) => {
  const { id } = req.params;
  const { client_id } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: "client_id obligatorio" });
  }

  try {
    const result = await db.query(
      `
      UPDATE licenses SET
        client_id = $1,
        status = 'vendida',
        sold_at = NOW(),
        last_status_change = NOW()
      WHERE id = $2
      RETURNING id
      `,
      [client_id, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Licencia no encontrada" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error al vender licencia:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Cambiar estado de licencia
app.post("/licenses/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Estado obligatorio" });
  }

  try {
    const result = await db.query(
      `
      UPDATE licenses SET
        status = $1,
        notes = COALESCE($2, notes),
        last_status_change = NOW()
      WHERE id = $3
      RETURNING id
      `,
      [status, notes || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Licencia no encontrada" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error cambiando estado:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= SERVIDOR =================

const PORT = process.env.PORT || 4000;

// ================= API DE VALIDACIÓN REMOTA =================

// GET /api/validate-license?token=XXXXX&machine=PC123&key=APIKEY
app.get("/api/validate-license", async (req, res) => {
  const { token, machine, key } = req.query;

  // 1. Proteger con API_KEY
  if (!key || key !== API_KEY) {
    return res.status(401).json({
      ok: false,
      status: "unauthorized",
      reason: "API key inválida",
    });
  }

  if (!token) {
    return res.status(400).json({
      ok: false,
      status: "invalid",
      reason: "Falta token de licencia",
    });
  }

  try {
    // 2. Buscar la licencia por token
    const result = await db.query("SELECT * FROM licenses WHERE token = $1", [
      token,
    ]);

    if (result.rows.length === 0) {
      return res.json({
        ok: false,
        status: "invalid",
        reason: "Token inexistente",
      });
    }

    const lic = result.rows[0];

    // 3. Lógica de validación básica
    // Puedes ajustar esto a tu gusto
    let status = "valid";
    let reason = "Licencia válida";

    if (lic.status === "bloqueada") {
      status = "blocked";
      reason = "Licencia bloqueada";
    } else if (lic.status === "deshabilitada") {
      status = "disabled";
      reason = "Licencia deshabilitada";
    } else if (lic.status === "disponible") {
      status = "unused";
      reason = "Licencia disponible pero no vendida/asignada";
    }

    // TODO: si luego agregás fecha de expiración, podés controlarla aquí

    // 4. Guardar log de uso (opcional, pero útil)
    try {
      await db.query(
        `
        INSERT INTO license_logs (license_id, machine_id, event)
        VALUES ($1, $2, $3)
        `,
        [lic.id, machine || null, `validate:${status}`]
      );
    } catch (logErr) {
      console.error("Error registrando log de licencia:", logErr.message);
      // no rompemos la respuesta al cliente
    }

    return res.json({
      ok: status === "valid",
      status,
      reason,
      license: {
        id: lic.id,
        token: lic.token,
        client_id: lic.client_id,
        db_status: lic.status,
        notes: lic.notes,
        sold_at: lic.sold_at,
        expires_at: lic.expires_at,
      },
    });
  } catch (err) {
    console.error("❌ Error en API de validación:", err.message);
    return res.status(500).json({
      ok: false,
      status: "error",
      reason: "Error interno del servidor",
    });
  }
});

// ================= ESTADÍSTICAS =================

app.get("/stats", async (req, res) => {
  try {
    // Total de clientes
    const clientsCount = await db.query("SELECT COUNT(*) AS total FROM clients");

    // Total de licencias
    const licensesCount = await db.query(
      "SELECT COUNT(*) AS total FROM licenses"
    );

    // Licencias por estado
    const byStatus = await db.query(
      "SELECT status, COUNT(*) AS total FROM licenses GROUP BY status ORDER BY status"
    );

    // Ventas por mes (últimos 12 meses)
    const salesByMonth = await db.query(
      `
      SELECT
        to_char(date_trunc('month', sold_at), 'YYYY-MM') AS month,
        COUNT(*) AS total
      FROM licenses
      WHERE sold_at IS NOT NULL
      GROUP BY date_trunc('month', sold_at)
      ORDER BY date_trunc('month', sold_at) DESC
      LIMIT 12
      `
    );

    res.json({
      clients_total: Number(clientsCount.rows[0].total),
      licenses_total: Number(licensesCount.rows[0].total),
      licenses_by_status: byStatus.rows.map((r) => ({
        status: r.status,
        total: Number(r.total),
      })),
      sales_by_month: salesByMonth.rows.map((r) => ({
        month: r.month,
        total: Number(r.total),
      })),
    });
  } catch (err) {
    console.error("❌ Error cargando estadísticas:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Servidor REST funcionando en puerto ${PORT}`);
});
