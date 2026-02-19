(() => {
  const consoleEl = document.getElementById("console");
  const apiStatusEl = document.getElementById("apiStatus");
  const authStatusEl = document.getElementById("authStatus");

  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");

  const createAssessmentForm = document.getElementById("createAssessmentForm");
  const refreshAssessmentsBtn = document.getElementById("refreshAssessmentsBtn");
  const assessmentsListEl = document.getElementById("assessmentsList");
  const genAssessmentRefBtn = document.getElementById("genAssessmentRefBtn");

  const uploadEvidenceForm = document.getElementById("uploadEvidenceForm");
  const genEvidenceRefBtn = document.getElementById("genEvidenceRefBtn");

  const selectedAssessmentIdEl = document.getElementById("selectedAssessmentId");
  const selectedAssessmentRefEl = document.getElementById("selectedAssessmentRef");
  const selectedAssessmentStatusEl = document.getElementById("selectedAssessmentStatus");

  const storage = {
    get access() {
      return localStorage.getItem("ws_access") || "";
    },
    set access(v) {
      if (!v) localStorage.removeItem("ws_access");
      else localStorage.setItem("ws_access", v);
    },
    get refresh() {
      return localStorage.getItem("ws_refresh") || "";
    },
    set refresh(v) {
      if (!v) localStorage.removeItem("ws_refresh");
      else localStorage.setItem("ws_refresh", v);
    },
  };

  let selectedAssessment = null;

  function log(obj) {
    const ts = new Date().toISOString();
    const line = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    consoleEl.textContent = `${ts}\n${line}\n\n` + consoleEl.textContent;
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    // fallback (not cryptographically strong)
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  function setBadge(el, kind, text) {
    el.className = `badge ${kind}`;
    el.textContent = text;
  }

  function authHeaders() {
    const h = { "Content-Type": "application/json" };
    if (storage.access) h["Authorization"] = `Bearer ${storage.access}`;
    return h;
  }

  async function apiFetch(path, options = {}) {
    const url = path.startsWith("http") ? path : path;
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    let body = null;
    if (contentType.includes("application/json")) body = await res.json();
    else body = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async function checkApi() {
    try {
      await apiFetch("/schema/", { method: "GET" });
      setBadge(apiStatusEl, "badge-ok", "API: OK");
    } catch (e) {
      setBadge(apiStatusEl, "badge-bad", "API: FAIL");
      log({ api_check_error: String(e), status: e.status, body: e.body });
    }
  }

  function updateAuthBadge() {
    if (storage.access) setBadge(authStatusEl, "badge-ok", "Auth: Token");
    else setBadge(authStatusEl, "badge-muted", "Auth: —");
  }

  function setSelectedAssessment(a) {
    selectedAssessment = a;
    selectedAssessmentIdEl.textContent = a ? String(a.id) : "—";
    selectedAssessmentRefEl.textContent = a?.client_ref || "—";
    selectedAssessmentStatusEl.textContent = a?.status || "—";
  }

  function renderAssessments(items) {
    assessmentsListEl.innerHTML = "";
    if (!items || items.length === 0) {
      assessmentsListEl.innerHTML = `<div class="hint">Nenhum assessment ainda.</div>`;
      return;
    }
    for (const a of items) {
      const el = document.createElement("div");
      el.className = "list-item";
      el.innerHTML = `
        <div><strong>#${a.id}</strong> ${a.title || ""}</div>
        <div class="meta">status=${a.status} client_ref=${a.client_ref || "—"}</div>
      `;
      el.addEventListener("click", () => setSelectedAssessment(a));
      assessmentsListEl.appendChild(el);
    }
  }

  async function refreshAssessments() {
    if (!storage.access) {
      log("Faça login antes de listar assessments.");
      return;
    }
    try {
      const items = await apiFetch("/assessments/", { headers: authHeaders() });
      renderAssessments(items);
      if (items[0]) setSelectedAssessment(items[0]);
      log({ assessments_count: items.length });
    } catch (e) {
      log({ error: "refreshAssessments", status: e.status, body: e.body });
    }
  }

  loginForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(loginForm);
    const email = fd.get("email");
    const password = fd.get("password");
    try {
      const data = await apiFetch("/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      storage.access = data.access;
      storage.refresh = data.refresh;
      updateAuthBadge();
      log({ login: "ok", user: data.user });
      await refreshAssessments();
    } catch (e) {
      log({ login: "fail", status: e.status, body: e.body });
    }
  });

  logoutBtn.addEventListener("click", () => {
    storage.access = "";
    storage.refresh = "";
    updateAuthBadge();
    setSelectedAssessment(null);
    assessmentsListEl.innerHTML = "";
    log("Logout local (tokens removidos).");
  });

  genAssessmentRefBtn.addEventListener("click", () => {
    createAssessmentForm.elements.client_ref.value = uuid();
  });

  createAssessmentForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!storage.access) {
      log("Faça login antes de criar assessment.");
      return;
    }
    const fd = new FormData(createAssessmentForm);
    const client_ref = fd.get("client_ref") || uuid();
    createAssessmentForm.elements.client_ref.value = client_ref;
    const payload = {
      client_ref,
      title: fd.get("title") || "",
      description: fd.get("description") || "",
      status: fd.get("status") || "captured",
    };
    try {
      const data = await apiFetch("/assessments/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      log({ create_assessment: "ok", data });
      await refreshAssessments();
      setSelectedAssessment(data);
    } catch (e) {
      log({ create_assessment: "fail", status: e.status, body: e.body });
    }
  });

  refreshAssessmentsBtn.addEventListener("click", refreshAssessments);

  genEvidenceRefBtn.addEventListener("click", () => {
    uploadEvidenceForm.elements.client_ref.value = uuid();
  });

  uploadEvidenceForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!storage.access) {
      log("Faça login antes de enviar evidence.");
      return;
    }
    if (!selectedAssessment) {
      log("Selecione um assessment antes de enviar evidence.");
      return;
    }
    const fd = new FormData(uploadEvidenceForm);
    if (!fd.get("client_ref")) {
      const v = uuid();
      uploadEvidenceForm.elements.client_ref.value = v;
      fd.set("client_ref", v);
    }
    try {
      const res = await fetch(`/assessments/${selectedAssessment.id}/evidences/`, {
        method: "POST",
        headers: storage.access ? { Authorization: `Bearer ${storage.access}` } : {},
        body: fd,
      });
      const contentType = res.headers.get("content-type") || "";
      const body = contentType.includes("application/json") ? await res.json() : await res.text();
      log({ upload_evidence_status: res.status, body });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      log({ upload_evidence: "fail", error: String(e) });
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/static/webapp/sw.js")
        .then(() => log("Service worker registrado."))
        .catch((e) => log({ sw_register_error: String(e) }));
    });
  }

  updateAuthBadge();
  checkApi();
})();
