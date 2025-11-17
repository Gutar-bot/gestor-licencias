// server.js
const express = require("express");
const cors = require("cors");
const db = require("./db");
const path = require("path");

const app = express();

// ====== CONFIG LOGIN (cambiá estos datos como quieras) ======
const AUTH_USER = "admin";
const AUTH_PASS = "1914";
const AUTH_TOKEN = "dibutek-super-token-123456"; // cadena cualquiera, pero que no sea fácil

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

// ====== MIDDLEWARE DE AUTORIZACIÓN (protege /clients y /licenses) ======
function authMiddleware(req, res, next) {
  const p = req.path;

  // Solo protegemos las rutas de API
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

  // Para todo lo demás (HTML, JS, CSS, login) dejamos pasar
  next();
}

app.use(authMiddleware);

// ================= CLIENTES =================

// Listar clientes
app.get("/clients", (req, res) => {
  db.all("SELECT * FROM clients ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.error("❌ Error al cargar clientes:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Crear cliente
app.post("/clients", (req, res) => {
  const { name, email, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

  db.run(
    "INSERT INTO clients (name, email, phone, notes) VALUES (?, ?, ?, ?)",
    [name, email, phone, notes || null],
    function (err) {
      if (err) {
        console.error("❌ Error al crear cliente:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID });
    }
  );
});

// ================= LICENCIAS =================

// Listar licencias
app.get("/licenses", (req, res) => {
  const { status, client_id } = req.query;
  let query = "SELECT * FROM licenses WHERE 1=1";
  const params = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (client_id) {
    query += " AND client_id = ?";
    params.push(client_id);
  }

  query += " ORDER BY id DESC";

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("❌ Error al cargar licencias:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Crear licencia
app.post("/licenses", (req, res) => {
  const { token, status, notes } = req.body;

  if (!token) return res.status(400).json({ error: "El token es obligatorio" });

  db.run(
    "INSERT INTO licenses (token, status, notes) VALUES (?, ?, ?)",
    [token, status || "disponible", notes || null],
    function (err) {
      if (err) {
        console.error("❌ Error al crear licencia:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID });
    }
  );
});

// Vender licencia
app.post("/licenses/:id/sell", (req, res) => {
  const { id } = req.params;
  const { client_id } = req.body;

  if (!client_id)
    return res.status(400).json({ error: "client_id obligatorio" });

  db.run(
    `
      UPDATE licenses SET
      client_id=?, status='vendida',
      sold_at=CURRENT_TIMESTAMP,
      last_status_change=CURRENT_TIMESTAMP
      WHERE id=?
    `,
    [client_id, id],
    function (err) {
      if (err) {
        console.error("❌ Error al vender licencia:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// Cambiar estado de licencia
app.post("/licenses/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status)
    return res.status(400).json({ error: "Estado obligatorio" });

  db.run(
    `
      UPDATE licenses SET
      status=?, notes=COALESCE(?,notes),
      last_status_change=CURRENT_TIMESTAMP
      WHERE id=?
    `,
    [status, notes || null, id],
    function (err) {
      if (err) {
        console.error("❌ Error cambiando estado:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// ================= SERVIDOR =================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🔥 Servidor ONLINE en puerto ${PORT}`);
});

