// script.js
const API_BASE = "";
let authToken = null;
let clientsCache = [];
let licensesCache = [];

document.addEventListener("DOMContentLoaded", () => {
  // Login
  const storedToken = localStorage.getItem("authToken");
  if (storedToken) {
    authToken = storedToken;
    showApp();
    initAppEvents();
    loadClients();
    loadLicenses();
  } else {
    showLogin();
  }

  const loginForm = document.getElementById("loginForm");
  loginForm.addEventListener("submit", handleLogin);

  document.getElementById("logoutBtn").addEventListener("click", () => {
    authToken = null;
    localStorage.removeItem("authToken");
    showLogin();
  });
});

function showLogin() {
  document.getElementById("loginSection").classList.remove("d-none");
  document.getElementById("appSection").classList.add("d-none");
}

function showApp() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("appSection").classList.remove("d-none");
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      showAlert("Usuario o contraseña incorrectos", "danger");
      return;
    }

    const data = await res.json();
    authToken = data.token;
    localStorage.setItem("authToken", authToken);

    showApp();
    initAppEvents();
    loadClients();
    loadLicenses();
    showAlert("Sesión iniciada", "success");
  } catch (err) {
    console.error(err);
    showAlert("Error al iniciar sesión", "danger");
  }
}

// Añade Authorization a todos los fetch
async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (authToken) {
    headers["Authorization"] = "Bearer " + authToken;
  }
  return fetch(url, { ...options, headers });
}

function initAppEvents() {
  // Evitar registrar múltiples veces
  if (initAppEvents._done) return;
  initAppEvents._done = true;

  const clientForm = document.getElementById("clientForm");
  const licenseForm = document.getElementById("licenseForm");

  document
    .getElementById("reloadClients")
    .addEventListener("click", loadClients);
  document
    .getElementById("reloadLicenses")
    .addEventListener("click", loadLicenses);
  document
    .getElementById("applyFilters")
    .addEventListener("click", loadLicenses);
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterClient").value = "";
    loadLicenses();
  });

  clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await createClient();
  });

  licenseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await createLicense();
  });

  // Exportar CSV
  document
    .getElementById("exportClients")
    .addEventListener("click", () => exportClientsCsv());
  document
    .getElementById("exportLicenses")
    .addEventListener("click", () => exportLicensesCsv());
}

// ---------- ALERTAS ----------
function showAlert(message, type = "success") {
  const container = document.getElementById("alertContainer");
  const wrapper = document.createElement("div");
  wrapper.className = `alert alert-${type} alert-dismissible fade show mb-2`;
  wrapper.role = "alert";
  wrapper.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  container.appendChild(wrapper);
  setTimeout(() => {
    wrapper.classList.remove("show");
    wrapper.addEventListener("transitionend", () => wrapper.remove());
  }, 4000);
}

// ---------- CLIENTES ----------
async function loadClients() {
  try {
    const res = await apiFetch(`${API_BASE}/clients`);
    if (!res.ok) throw new Error("Error HTTP " + res.status);
    const clients = await res.json();
    clientsCache = clients;
    renderClientsTable(clients);
    fillClientFilter(clients);
  } catch (err) {
    console.error(err);
    showAlert("Error al cargar clientes", "danger");
  }
}

function renderClientsTable(clients) {
  const tbody = document.querySelector("#clientsTable tbody");
  tbody.innerHTML = "";
  clients.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.name || ""}</td>
      <td>${c.email || ""}</td>
      <td>${c.phone || ""}</td>
      <td>${c.notes || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function fillClientFilter(clients) {
  const select = document.getElementById("filterClient");
  const previous = select.value;
  select.innerHTML = '<option value="">Todos</option>';
  clients.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.id} - ${c.name}`;
    select.appendChild(opt);
  });
  if ([...select.options].some((o) => o.value === previous)) {
    select.value = previous;
  }
}

async function createClient() {
  const name = document.getElementById("clientName").value.trim();
  const email = document.getElementById("clientEmail").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const notes = document.getElementById("clientNotes").value.trim();

  if (!name) {
    showAlert("El nombre es obligatorio", "warning");
    return;
  }

  try {
    const res = await apiFetch(`${API_BASE}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, notes }),
    });

    if (!res.ok) throw new Error("Error al crear cliente");

    document.getElementById("clientForm").reset();
    showAlert("Cliente creado correctamente");
    loadClients();
  } catch (err) {
    console.error(err);
    showAlert("No se pudo crear el cliente", "danger");
  }
}

// ---------- LICENCIAS ----------
async function loadLicenses() {
  const status = document.getElementById("filterStatus").value;
  const client_id = document.getElementById("filterClient").value;

  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (client_id) params.append("client_id", client_id);

  const query = params.toString() ? `?${params.toString()}` : "";

  try {
    const res = await apiFetch(`${API_BASE}/licenses${query}`);
    if (!res.ok) throw new Error("Error HTTP " + res.status);
    const licenses = await res.json();
    licensesCache = licenses;
    renderLicensesTable(licenses);
  } catch (err) {
    console.error(err);
    showAlert("Error al cargar licencias", "danger");
  }
}

function renderLicensesTable(licenses) {
  const tbody = document.querySelector("#licensesTable tbody");
  tbody.innerHTML = "";

  licenses.forEach((l) => {
    const tr = document.createElement("tr");

    const clientText = l.client_id ? `Cliente #${l.client_id}` : "—";

    let actionsHtml = "";

    if (!l.client_id) {
      actionsHtml += `
        <button class="btn btn-sm btn-outline-primary me-1" data-action="sell" data-id="${l.id}">
          Vender
        </button>
      `;
    }

    actionsHtml += `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-success" data-action="status" data-status="habilitada" data-id="${l.id}">Habilitar</button>
        <button class="btn btn-warning" data-action="status" data-status="deshabilitada" data-id="${l.id}">Deshabilitar</button>
        <button class="btn btn-danger" data-action="status" data-status="bloqueada" data-id="${l.id}">Bloquear</button>
      </div>
    `;

    tr.innerHTML = `
      <td>${l.id}</td>
      <td>${l.token}</td>
      <td>${l.status}</td>
      <td>${clientText}</td>
      <td>${actionsHtml}</td>
    `;

    tr.querySelectorAll('button[data-action="sell"]').forEach((btn) => {
      btn.addEventListener("click", () => openSellPrompt(l.id));
    });

    tr.querySelectorAll('button[data-action="status"]').forEach((btn) => {
      btn.addEventListener("click", () =>
        changeLicenseStatus(l.id, btn.getAttribute("data-status"))
      );
    });

    tbody.appendChild(tr);
  });
}

async function createLicense() {
  const token = document.getElementById("licenseToken").value.trim();
  const status = document.getElementById("licenseStatus").value;
  const notes = document.getElementById("licenseNotes").value.trim();

  if (!token) {
    showAlert("El token es obligatorio", "warning");
    return;
  }

  try {
    const res = await apiFetch(`${API_BASE}/licenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, status, notes }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || "Error al crear licencia";
      throw new Error(msg);
    }

    document.getElementById("licenseForm").reset();
    showAlert("Licencia creada correctamente");
    loadLicenses();
  } catch (err) {
    console.error(err);
    showAlert(`No se pudo crear la licencia: ${err.message}`, "danger");
  }
}

async function openSellPrompt(licenseId) {
  const clientId = prompt(
    "Ingrese el ID del cliente al que desea asignar esta licencia:"
  );

  if (!clientId) return;

  if (!/^\d+$/.test(clientId)) {
    showAlert("ID de cliente inválido", "warning");
    return;
  }

  try {
    const res = await apiFetch(`${API_BASE}/licenses/${licenseId}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: Number(clientId) }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || "Error al vender licencia";
      throw new Error(msg);
    }

    showAlert("Licencia asignada al cliente correctamente");
    loadLicenses();
  } catch (err) {
    console.error(err);
    showAlert(`No se pudo vender la licencia: ${err.message}`, "danger");
  }
}

async function changeLicenseStatus(licenseId, newStatus) {
  try {
    const res = await apiFetch(`${API_BASE}/licenses/${licenseId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || "Error al cambiar estado";
      throw new Error(msg);
    }

    showAlert(`Estado de licencia #${licenseId} cambiado a ${newStatus}`);
    loadLicenses();
  } catch (err) {
    console.error(err);
    showAlert(`No se pudo cambiar el estado: ${err.message}`, "danger");
  }
}

// ---------- EXPORTAR CSV ----------
function exportClientsCsv() {
  if (!clientsCache.length) {
    showAlert("No hay clientes para exportar", "warning");
    return;
  }
  const headers = ["ID", "Nombre", "Email", "Teléfono", "Notas"];
  const rows = clientsCache.map((c) => [
    c.id,
    c.name || "",
    c.email || "",
    c.phone || "",
    c.notes || "",
  ]);
  downloadCsv("clientes.csv", [headers, ...rows]);
}

function exportLicensesCsv() {
  if (!licensesCache.length) {
    showAlert("No hay licencias para exportar", "warning");
    return;
  }
  const headers = ["ID", "Token", "Estado", "ClienteID", "Notas"];
  const rows = licensesCache.map((l) => [
    l.id,
    l.token,
    l.status,
    l.client_id || "",
    l.notes || "",
  ]);
  downloadCsv("licencias.csv", [headers, ...rows]);
}

function downloadCsv(filename, rows) {
  const escapeCell = (cell) => {
    if (cell == null) return "";
    const str = String(cell).replace(/"/g, '""');
    if (str.search(/("|,|\n)/g) >= 0) {
      return `"${str}"`;
    }
    return str;
  };

  const csvContent = rows.map((r) => r.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
