(() => {
  const qs = (id) => document.getElementById(id);
  const screens = {
    splash: qs("screen-splash"),
    login: qs("screen-login"),
    home: qs("screen-home"),
    newInspection: qs("screen-new-inspection"),
    capture: qs("screen-capture"),
    reviewPhotos: qs("screen-review-photos"),
    review: qs("screen-review"),
    validate: qs("screen-validate"),
  };

  const state = {
    access: "",
    refresh: "",
    keep: true,
    assessments: [],
    selectedAssessment: null,
    captureSessionKey: "",
    sessionPhotos: [],
    lastImageBlob: null,
    lastCapturedAt: null,
    lastGeo: null,
    lastQuality: null,
    privacyOn: true,
    cameraStream: null,
    reviewQueue: [],
    selectedInference: null,
    draftInspection: { environment: "", category: "general_safety" },
    reviewPhotoUrls: [],
  };

  const IMAGE_QUALITY = {
    minWidth: 640,
    minHeight: 480,
    // Variance of Laplacian on a downscaled grayscale image.
    // Lower values tend to indicate blur.
    minSharpness: 25,
    downscaleMax: 256,
  };

  const queueKey = "ws_offline_queue_v1";
  function loadQueue() {
    try {
      const raw = localStorage.getItem(queueKey);
      if (!raw) return { assessments: [], evidences: [] };
      const q = JSON.parse(raw);
      return {
        assessments: Array.isArray(q.assessments) ? q.assessments : [],
        evidences: Array.isArray(q.evidences) ? q.evidences : [],
      };
    } catch {
      return { assessments: [], evidences: [] };
    }
  }
  function saveQueue(q) {
    localStorage.setItem(queueKey, JSON.stringify(q));
  }
  function queueSize(q) {
    return (q.assessments?.length || 0) + (q.evidences?.length || 0);
  }

  function show(name) {
    for (const [k, el] of Object.entries(screens)) {
      if (!el) continue;
      el.hidden = k !== name;
    }
  }

  function loadAuth() {
    state.access = localStorage.getItem("ws_access") || "";
    state.refresh = localStorage.getItem("ws_refresh") || "";
  }

  function saveAuth() {
    if (state.keep) {
      localStorage.setItem("ws_access", state.access || "");
      localStorage.setItem("ws_refresh", state.refresh || "");
    } else {
      localStorage.removeItem("ws_access");
      localStorage.removeItem("ws_refresh");
    }
  }

  function clearAuth() {
    state.access = "";
    state.refresh = "";
    localStorage.removeItem("ws_access");
    localStorage.removeItem("ws_refresh");
  }

  function setLoginError(msg) {
    const el = qs("loginError");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.hidden = false;
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  async function apiJson(path, { method = "GET", body, headers = {} } = {}) {
    const h = { ...headers };
    if (state.access) h.Authorization = `Bearer ${state.access}`;
    if (body != null) h["Content-Type"] = "application/json";
    const res = await fetch(path, {
      method,
      headers: h,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function apiMultipart(path, formData) {
    const h = {};
    if (state.access) h.Authorization = `Bearer ${state.access}`;
    const res = await fetch(path, { method: "POST", headers: h, body: formData });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return { status: res.status, data };
  }

  function setOfflineBadges() {
    const offline = !navigator.onLine;
    const b1 = qs("offlineBadge");
    const b2 = qs("reviewOfflineBadge");
    const b3 = qs("validateOfflineBadge");
    if (b1) b1.hidden = !offline;
    if (b2) b2.hidden = !offline;
    if (b3) b3.hidden = !offline;
  }

  let toastTimer = null;
  function toast(message) {
    const el = qs("toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
      el.textContent = "";
    }, 2200);
  }

  function setPendingCount(n) {
    const el = qs("pendingCount");
    if (!el) return;
    el.textContent = `${n} PENDING`;
  }

  function pickPendingIcon(a) {
    // placeholder mapping (doc/chart/box)
    const icons = ["▦", "▤", "▢"];
    return icons[a.id % icons.length];
  }

  function renderPending() {
    const list = qs("pendingList");
    if (!list) return;
    list.innerHTML = "";
    const q = loadQueue();
    const queuedAssessments = q.assessments || [];
    const items = [...queuedAssessments, ...(state.assessments || [])];
    setPendingCount(items.length);

    for (const a of items.slice(0, 6)) {
      const el = document.createElement("div");
      el.className = "pending-card";
      const title = (a.title || "Untitled").replace(/</g, "&lt;");
      const created = (a.created_at || a.captured_at || "").slice(0, 10) || "—";
      const notSynced = a._queued ? "Not synced" : "Synced";
      el.innerHTML = `
        <div class="pending-left">
          <div class="pending-ico">${pickPendingIcon(a)}</div>
          <div>
            <div class="pending-title">${title}</div>
            <div class="pending-meta">
              <span>${created}</span>
              <span> • </span>
              <span>${notSynced}</span>
            </div>
          </div>
        </div>
        <div class="warn">⚠</div>
      `;
      el.addEventListener("click", () => {
        state.selectedAssessment = a;
        go("capture");
      });
      list.appendChild(el);
    }
  }

  async function loadAssessments() {
    if (!state.access) return;
    state.assessments = await apiJson("/assessments/");
    if (!state.selectedAssessment && state.assessments[0]) state.selectedAssessment = state.assessments[0];
    // annotate queued assessments for rendering
    const q = loadQueue();
    for (const qa of q.assessments || []) qa._queued = true;
    renderPending();
    updateSyncNowButton();
  }

  async function login(email, password, keep) {
    state.keep = keep;
    setLoginError("");
    const data = await apiJson("/auth/login/", { method: "POST", body: { email, password } });
    state.access = data.access;
    state.refresh = data.refresh;
    saveAuth();
  }

  function logout() {
    clearAuth();
    state.assessments = [];
    state.selectedAssessment = null;
    state.reviewQueue = [];
    state.selectedInference = null;
    const vbtn = qs("validateBtn");
    if (vbtn) vbtn.hidden = true;
  }

  async function startCamera() {
    const video = qs("cameraVideo");
    const preview = qs("capturePreview");
    if (preview) preview.hidden = true;
    if (video) video.hidden = false;

    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (video) video.srcObject = state.cameraStream;
    } catch {
      // ignore; fallback to file input
    }
  }

  function stopCamera() {
    if (!state.cameraStream) return;
    for (const t of state.cameraStream.getTracks()) t.stop();
    state.cameraStream = null;
  }

  function ensureCaptureSession() {
    const a = state.selectedAssessment;
    const key = a?.client_ref ? `c:${a.client_ref}` : a?.id ? `id:${a.id}` : "";
    if (!key) return;
    if (state.captureSessionKey !== key) {
      state.captureSessionKey = key;
      state.sessionPhotos = [];
      state.lastImageBlob = null;
      state.lastCapturedAt = null;
      state.lastGeo = null;
      const galleryCount = qs("galleryCount");
      if (galleryCount) galleryCount.hidden = true;
    }
  }

  function updateGalleryCount() {
    const galleryCount = qs("galleryCount");
    if (!galleryCount) return;
    const n = Array.isArray(state.sessionPhotos) ? state.sessionPhotos.length : 0;
    if (n <= 0) {
      galleryCount.hidden = true;
      galleryCount.textContent = "";
      return;
    }
    galleryCount.hidden = false;
    galleryCount.textContent = String(n);
  }

  async function captureFrame() {
    const video = qs("cameraVideo");
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob;
  }

  async function analyzeImageQuality(blob) {
    if (!blob || typeof createImageBitmap !== "function") return null;

    const bitmap = await createImageBitmap(blob);
    try {
      const width = bitmap.width || 0;
      const height = bitmap.height || 0;

      const reasons = [];
      let blockUpload = false;

      if (width < IMAGE_QUALITY.minWidth || height < IMAGE_QUALITY.minHeight) {
        reasons.push(
          `Resolução baixa (${width}x${height}). Recapture com melhor enquadramento.`,
        );
        blockUpload = true;
      }

      const scale = Math.min(1, IMAGE_QUALITY.downscaleMax / Math.max(width || 1, height || 1));
      const w = Math.max(3, Math.round(width * scale));
      const h = Math.max(3, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, w, h);

      const img = ctx.getImageData(0, 0, w, h);
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
        const r = img.data[p];
        const g = img.data[p + 1];
        const b = img.data[p + 2];
        gray[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      let sum = 0;
      let sumSq = 0;
      let count = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const c = gray[i];
          const lap = -4 * c + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
          sum += lap;
          sumSq += lap * lap;
          count++;
        }
      }
      const mean = count ? sum / count : 0;
      const variance = count ? sumSq / count - mean * mean : 0;
      const sharpness = variance;

      if (sharpness < IMAGE_QUALITY.minSharpness) {
        reasons.push("Possível baixa nitidez. Recomendado recapturar a evidência.");
      }

      return {
        width,
        height,
        sharpness,
        reasons,
        blockUpload,
      };
    } finally {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    }
  }

  async function requestGeo() {
    if (!navigator.geolocation) return null;
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
      );
    });
  }

  function setPreviewFromBlob(blob) {
    const img = qs("capturePreview");
    const video = qs("cameraVideo");
    if (!img) return;
    if (video) video.hidden = true;
    img.hidden = false;
    img.src = URL.createObjectURL(blob);
  }

  async function anonymizeEvidenceBlob(blob) {
    // Story 2.5 (F2.5): privacy mode — prefer region blur (faces) when possible, fallback to global blur.
    const PRIVACY_BLUR_PX = 14;
    const PRIVACY_FALLBACK_GLOBAL = true;

    if (!state.privacyOn) return blob;
    if (!blob || typeof createImageBitmap !== "function") return blob;

    let bitmap = null;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      // If the browser can't decode the image, do not block uploads.
      return blob;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width || 0;
      canvas.height = bitmap.height || 0;
      const ctx = canvas.getContext("2d");
      if (!ctx) return blob;

      // Draw original first
      ctx.filter = "none";
      ctx.drawImage(bitmap, 0, 0);

      let blurredAny = false;

      // FaceDetector (Chromium) — best-effort region blur for faces
      if (typeof window.FaceDetector === "function") {
        try {
          const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
          const faces = await detector.detect(bitmap);
          for (const f of faces || []) {
            const b = f?.boundingBox;
            if (!b) continue;
            const sx = Math.max(0, Math.floor(b.x || 0));
            const sy = Math.max(0, Math.floor(b.y || 0));
            const sw = Math.max(0, Math.floor(b.width || 0));
            const sh = Math.max(0, Math.floor(b.height || 0));
            if (!sw || !sh) continue;

            ctx.save();
            ctx.filter = `blur(${PRIVACY_BLUR_PX}px)`;
            ctx.drawImage(bitmap, sx, sy, sw, sh, sx, sy, sw, sh);
            ctx.restore();
            blurredAny = true;
          }
        } catch {
          // ignore detector failures
        }
      }

      if (!blurredAny && PRIVACY_FALLBACK_GLOBAL) {
        ctx.filter = `blur(${PRIVACY_BLUR_PX}px)`;
        ctx.drawImage(bitmap, 0, 0);
      }

      const out = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      return out || blob;
    } catch {
      return blob;
    } finally {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    }
  }

  async function setReview(blob) {
    const img = qs("reviewImg");
    if (img) img.src = URL.createObjectURL(blob);
    const a = state.selectedAssessment;

    state.lastQuality = null;
    setMsg("", "");
    try {
      const q = await analyzeImageQuality(blob);
      state.lastQuality = q;
      if (q && q.reasons && q.reasons.length) {
        setMsg("bad", q.reasons[0]);
      }
    } catch {
      // Ignore quality analysis failures (PWA should still work offline).
      state.lastQuality = null;
    }
    qs("reviewAssessment").textContent = a ? `#${a.id} ${a.title || ""}` : "—";
    qs("reviewCapturedAt").textContent = state.lastCapturedAt || "—";
  }

  function setMsg(kind, text) {
    const el = qs("reviewMsg");
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      el.className = "msg";
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = `msg ${kind}`;
  }

  async function uploadEvidence() {
    const a = state.selectedAssessment;
    if (!a) throw new Error("No assessment selected");
    if (!state.lastImageBlob) throw new Error("No image captured");

    const geo = state.lastGeo || { lat: 0, lon: 0 };
    const capturedAt = state.lastCapturedAt || new Date().toISOString();
    const blob = await anonymizeEvidenceBlob(state.lastImageBlob);

    // If offline or assessment not yet synced, enqueue for batch sync
    const offline = !navigator.onLine || !a.id;
    if (offline) {
      const q = loadQueue();
      // ensure assessment is queued if it's only local
      if (!a.id) {
        const exists = (q.assessments || []).some((x) => x.client_ref === a.client_ref);
        if (!exists) {
          q.assessments.push({
            client_ref: a.client_ref,
            title: a.title || "New Inspection",
            description: a.description || "",
            environment: a.environment || "",
            category: a.category || "",
            status: a.status || "captured",
            captured_at: capturedAt,
            _queued: true,
          });
        }
      }

      const fileBase64 = await blobToBase64(blob);
      q.evidences.push({
        assessment_client_ref: a.client_ref || uuid(),
        client_ref: uuid(),
        captured_at: capturedAt,
        latitude: geo.lat,
        longitude: geo.lon,
        filename: "capture.jpg",
        content_type: "image/jpeg",
        file_base64: fileBase64,
      });
      saveQueue(q);
      renderPending();
      return { status: 200, data: { queued: true } };
    }

    // Online and assessment synced: direct upload
    const fd = new FormData();
    fd.set("client_ref", uuid());
    fd.set("captured_at", capturedAt);
    fd.set("latitude", String(geo.lat));
    fd.set("longitude", String(geo.lon));
    fd.set("file", new File([blob], "capture.jpg", { type: "image/jpeg" }));
    return await apiMultipart(`/assessments/${a.id}/evidences/`, fd);
  }

  function setLastAssessmentClientRef(cref) {
    try {
      if (cref) localStorage.setItem("ws_last_assessment_client_ref", String(cref));
    } catch {
      // ignore
    }
  }

  async function uploadEvidenceItem({ blob, capturedAt, geo }) {
    state.lastImageBlob = blob;
    state.lastCapturedAt = capturedAt || new Date().toISOString();
    state.lastGeo = geo || null;
    return await uploadEvidence();
  }

  async function patchAssessmentStatus(statusValue) {
    const a = state.selectedAssessment;
    if (!a) throw new Error("No assessment selected");

    // Offline: update local queue item + in-memory object
    if (!navigator.onLine || !a.id) {
      const q = loadQueue();
      const cref = a.client_ref;
      if (cref) {
        const item = (q.assessments || []).find((x) => x.client_ref === cref);
        if (item) item.status = statusValue;
        saveQueue(q);
      }
      a.status = statusValue;
      renderPending();
      return;
    }

    const updated = await apiJson(`/assessments/${a.id}/`, { method: "PATCH", body: { status: statusValue } });
    state.selectedAssessment = updated;
  }

  function cleanupReviewPhotoUrls() {
    const urls = state.reviewPhotoUrls || [];
    for (const u of urls) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
    state.reviewPhotoUrls = [];
  }

  function openRpModal(url) {
    const modal = qs("rpModal");
    const img = qs("rpModalImg");
    if (!modal || !img) return;
    img.src = url;
    modal.hidden = false;
  }

  function closeRpModal() {
    const modal = qs("rpModal");
    const img = qs("rpModalImg");
    if (img) img.src = "";
    if (modal) modal.hidden = true;
  }

  function renderReviewPhotos() {
    const title = qs("reviewPhotosTitle");
    const grid = qs("reviewPhotosGrid");
    if (!grid) return;

    cleanupReviewPhotoUrls();

    const photos = Array.isArray(state.sessionPhotos) ? state.sessionPhotos : [];
    if (title) title.textContent = `Review Photos (${photos.length})`;

    grid.innerHTML = "";

    photos.forEach((p, idx) => {
      const url = URL.createObjectURL(p.blob);
      state.reviewPhotoUrls.push(url);

      const card = document.createElement("div");
      card.className = "rp-card";
      card.innerHTML = `
        <img class="rp-thumb" alt="Photo ${idx + 1}" />
        <div class="rp-badge">#${idx + 1}</div>
        <button type="button" class="rp-eye" aria-label="Preview">&#128065;</button>
      `;
      card.querySelector(".rp-thumb").src = url;
      card.querySelector(".rp-eye").addEventListener("click", () => openRpModal(url));
      grid.appendChild(card);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "rp-card rp-add";
    add.innerHTML = `<div class="plus" aria-hidden="true">+</div><div>Add Photo</div>`;
    add.addEventListener("click", () => go("capture"));
    grid.appendChild(add);
  }

  async function submitForAnalysis() {
    const btn = qs("submitAnalysisBtn");
    const photos = Array.isArray(state.sessionPhotos) ? state.sessionPhotos : [];
    if (!photos.length) {
      toast("Capture at least 1 photo");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting...";
    }

    try {
      for (const p of photos) {
        await uploadEvidenceItem({ blob: p.blob, capturedAt: p.capturedAt, geo: p.geo });
      }

      await patchAssessmentStatus("submitted");

      state.sessionPhotos = [];
      state.captureSessionKey = "";
      updateGalleryCount();

      toast("Submitted for analysis");
      await go("home");
    } catch (err) {
      const d = err?.data;
      const msg =
        (typeof d === "string" && d) ||
        d?.detail ||
        (d && typeof d === "object" ? JSON.stringify(d) : "") ||
        err?.message ||
        "Submit failed";
      toast(`Submit failed: ${msg}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit for Analysis";
      }
    }
  }

  async function blobToBase64(blob) {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function trySyncQueue() {
    if (!state.access || !navigator.onLine) return;
    const q = loadQueue();
    if (queueSize(q) === 0) return;
    try {
      await apiJson("/assessments/sync/", { method: "POST", body: q });
      saveQueue({ assessments: [], evidences: [] });
      await loadAssessments();
      toast("Synced ✓");
    } catch {
      // keep queue
      toast("Sync failed");
    }
  }

  function updateSyncNowButton(isSyncing = false) {
    const btn = qs("syncNowBtn");
    if (!btn) return;
    const q = loadQueue();
    const hasQueue = queueSize(q) > 0;
    const offline = !navigator.onLine;
    btn.hidden = !state.access;

    if (isSyncing) {
      btn.disabled = true;
      btn.textContent = "SYNCING…";
      return;
    }

    btn.textContent = hasQueue && !offline ? "SYNC NOW" : "SYNC";
    btn.disabled = offline || !hasQueue;
  }

  async function go(next) {
    if (next !== "reviewPhotos") {
      closeRpModal();
      cleanupReviewPhotoUrls();
    }
    if (next === "splash") {
      show("splash");
      return;
    }
    if (next === "login") {
      stopCamera();
      show("login");
      return;
    }
    if (next === "home") {
      stopCamera();
      show("home");
      await loadAssessments();
      await refreshValidateButton();
      return;
    }
    if (next === "newInspection") {
      stopCamera();
      show("newInspection");
      renderNewInspection();
      return;
    }
    if (next === "capture") {
      ensureCaptureSession();
      updateGalleryCount();
      show("capture");
      await startCamera();
      return;
    }
    if (next === "reviewPhotos") {
      stopCamera();
      show("reviewPhotos");
      renderReviewPhotos();
      return;
    }
    if (next === "review") {
      stopCamera();
      show("review");
      return;
    }
    if (next === "validate") {
      stopCamera();
      show("validate");
      await loadReviewQueue();
      return;
    }
  }

  function envLabel(env) {
    if (env === "construction") return "Construction";
    if (env === "industry") return "Industry";
    if (env === "other") return "Other";
    return "";
  }

  function renderNewInspection() {
    const env = state.draftInspection?.environment || "";
    const cards = document.querySelectorAll("#screen-new-inspection .ni-card[data-env]");
    for (const c of cards) {
      const v = String(c.getAttribute("data-env") || "");
      c.classList.toggle("is-selected", v && v === env);
    }

    const sel = qs("niCategory");
    if (sel && state.draftInspection?.category) sel.value = state.draftInspection.category;

    const btn = qs("niContinueBtn");
    if (btn) btn.disabled = !env;
  }

  function setValidateError(msg) {
    const el = qs("validateError");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function renderReviewQueue() {
    const list = qs("validateList");
    if (!list) return;
    list.innerHTML = "";
    const items = state.reviewQueue || [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "pending-meta";
      empty.textContent = "No pending inferences.";
      list.appendChild(empty);
      return;
    }
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "validate-card";
      const title = (item.assessment_title || "Untitled").replace(/</g, "&lt;");
      const createdBy = (item.created_by || "").replace(/</g, "&lt;");
      el.innerHTML = `
        <div class="t">#${item.assessment} • Inference #${item.id}</div>
        <div class="m">${title} • ${createdBy}</div>
      `;
      el.addEventListener("click", () => {
        state.selectedInference = item;
        const sel = qs("validateSelected");
        if (sel) sel.textContent = `Assessment #${item.assessment} • Inference #${item.id}`;
        const raw = qs("validateRaw");
        if (raw) raw.textContent = JSON.stringify(item.raw_result || {}, null, 2);
      });
      list.appendChild(el);
    }
  }

  async function loadReviewQueue() {
    setValidateError("");
    if (!state.access) {
      setValidateError("Login required.");
      return;
    }
    if (!navigator.onLine) {
      setValidateError("Offline: validation requires online access.");
      state.reviewQueue = [];
      renderReviewQueue();
      return;
    }
    try {
      const data = await apiJson("/assessments/review-queue/");
      state.reviewQueue = Array.isArray(data) ? data : [];
      state.selectedInference = null;
      const sel = qs("validateSelected");
      if (sel) sel.textContent = "—";
      const raw = qs("validateRaw");
      if (raw) raw.textContent = "";
      renderReviewQueue();
    } catch (err) {
      const msg = err?.data?.detail || "Failed to load validation queue.";
      setValidateError(msg);
      state.reviewQueue = [];
      renderReviewQueue();
    }
  }

  async function refreshValidateButton() {
    const btn = qs("validateBtn");
    if (!btn) return;
    btn.hidden = true;

    if (!state.access) return;
    if (!navigator.onLine) return;

    try {
      // Permission probe: only validator/admin gets 200 here.
      await apiJson("/assessments/review-queue/");
      btn.hidden = false;
    } catch {
      btn.hidden = true;
    }
  }

  function parseOverride() {
    const el = qs("validateOverride");
    const raw = String(el?.value || "").trim();
    if (!raw) return {};
    try {
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      throw new Error("override JSON inválido.");
    }
  }

  async function submitDecision(decision, { withOverride = false } = {}) {
    const item = state.selectedInference;
    if (!item) {
      toast("Select an inference first");
      return;
    }
    if (!navigator.onLine) {
      toast("Offline: cannot submit decision");
      return;
    }

    const rejectReason = String(qs("validateRejectReason")?.value || "").trim();
    const comment = String(qs("validateComment")?.value || "").trim();
    let override = {};
    if (withOverride) {
      try {
        override = parseOverride();
      } catch (e) {
        setValidateError(String(e?.message || e));
        toast("Invalid override JSON");
        return;
      }
    }

    const payload = { decision, comment, override };
    if (decision === "rejected") payload.reject_reason = rejectReason;

    try {
      await apiJson(`/assessments/${item.assessment}/inferences/${item.id}/decision/`, {
        method: "POST",
        body: payload,
      });
      toast("Decision saved ✓");
      const rr = qs("validateRejectReason");
      const ov = qs("validateOverride");
      const cm = qs("validateComment");
      if (rr) rr.value = "";
      if (ov) ov.value = "";
      if (cm) cm.value = "";
      await loadReviewQueue();
    } catch (err) {
      const msg = err?.data?.detail || "Failed to save decision.";
      setValidateError(msg);
      toast("Decision failed");
    }
  }

  // Wire events
  function wire() {
    // Splash auto transition
    setTimeout(() => {
      if (state.access) go("home");
      else go("login");
    }, 850);

    // Login
    const loginForm = qs("loginForm");
    const togglePwBtn = qs("togglePwBtn");
    const forgotBtn = qs("forgotBtn");
    const validateBtn = qs("validateBtn");

    if (togglePwBtn) {
      togglePwBtn.addEventListener("click", () => {
        const pw = loginForm?.elements?.password;
        if (!pw) return;
        pw.type = pw.type === "password" ? "text" : "password";
      });
    }
    if (forgotBtn) {
      forgotBtn.addEventListener("click", () => {
        setLoginError("Password reset UI not implemented yet. Use /auth/password-reset/ in Swagger.");
      });
    }
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(loginForm);
        const email = String(fd.get("email") || "").trim();
        const password = String(fd.get("password") || "");
        const keep = Boolean(fd.get("keep"));
        try {
          await login(email, password, keep);
          await go("home");
        } catch (err) {
          const msg = err?.data?.detail || "Login failed.";
          setLoginError(msg);
        }
      });
    }

    // Home
    const logoutBtn = qs("logoutBtn");
    const startNowBtn = qs("startNowBtn");
    const newBtn = qs("newBtn");
    const syncNowBtn = qs("syncNowBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        logout();
        go("login");
      });
    }
    if (syncNowBtn) {
      syncNowBtn.addEventListener("click", async () => {
        const q = loadQueue();
        if (!navigator.onLine) {
          toast("Offline — connect to sync");
          return;
        }
        if (queueSize(q) === 0) {
          toast("Nothing to sync");
          return;
        }
        updateSyncNowButton(true);
        await trySyncQueue();
        updateSyncNowButton(false);
      });
    }
    const startNewInspection = async () => {
      state.draftInspection = { environment: "", category: "general_safety" };
      await go("newInspection");
    };
    if (startNowBtn) startNowBtn.addEventListener("click", startNewInspection);
    if (newBtn) newBtn.addEventListener("click", startNewInspection);

    // New Inspection
    const newInspectionBackBtn = qs("newInspectionBackBtn");
    const niContinueBtn = qs("niContinueBtn");
    const niCategory = qs("niCategory");
    if (newInspectionBackBtn) newInspectionBackBtn.addEventListener("click", () => go("home"));
    if (niCategory) {
      niCategory.addEventListener("change", () => {
        state.draftInspection.category = String(niCategory.value || "general_safety");
      });
    }
    const niCards = document.querySelectorAll("#screen-new-inspection .ni-card[data-env]");
    for (const c of niCards) {
      c.addEventListener("click", () => {
        const v = String(c.getAttribute("data-env") || "");
        state.draftInspection.environment = v;
        renderNewInspection();
      });
    }

    if (niContinueBtn) {
      niContinueBtn.addEventListener("click", async () => {
        const env = state.draftInspection?.environment || "";
        const cat = state.draftInspection?.category || "general_safety";
        if (!env) return;

        const title = envLabel(env) || "New Inspection";
        const capturedAt = new Date().toISOString();

        // Always create a new assessment for a new inspection
        if (!navigator.onLine) {
          const a = {
            id: null,
            client_ref: uuid(),
            status: "captured",
            title,
            description: "",
            environment: env,
            category: cat,
            captured_at: capturedAt,
            _queued: true,
          };
          const q = loadQueue();
          q.assessments.push({
            client_ref: a.client_ref,
            title: a.title,
            description: a.description,
            environment: a.environment,
            category: a.category,
            status: a.status,
            captured_at: a.captured_at,
            _queued: true,
          });
          saveQueue(q);
          state.selectedAssessment = a;
          setLastAssessmentClientRef(a.client_ref);
          renderPending();
          ensureCaptureSession();
          await go("capture");
          return;
        }

        try {
          const clientRef = uuid();
          const created = await apiJson("/assessments/", {
            method: "POST",
            body: {
              client_ref: clientRef,
              title,
              description: "",
              environment: env,
              category: cat,
              status: "captured",
            },
          });
          state.selectedAssessment = created;
          setLastAssessmentClientRef(clientRef);
          ensureCaptureSession();
          await go("capture");
        } catch (err) {
          toast("Failed to start inspection");
        }
      });
    }

    // Capture
    const backBtn = qs("backBtn");
    const shutterBtn = qs("shutterBtn");
    const fileInput = qs("fileInput");
    const tapReviewBtn = qs("tapReviewBtn");
    const galleryCount = qs("galleryCount");

    if (backBtn) backBtn.addEventListener("click", () => go("home"));
    if (shutterBtn) {
      shutterBtn.addEventListener("click", async () => {
        ensureCaptureSession();
        const blob = await captureFrame();
        if (!blob) return;
        const capturedAt = new Date().toISOString();
        const geo = await requestGeo();

        state.sessionPhotos.push({ blob, capturedAt, geo });
        state.lastImageBlob = blob;
        state.lastCapturedAt = capturedAt;
        state.lastGeo = geo;
        setPreviewFromBlob(blob);
        updateGalleryCount();
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        ensureCaptureSession();
        const files = Array.from(fileInput.files || []);
        if (!files.length) return;

        for (const f of files) {
          const capturedAt = new Date().toISOString();
          const geo = await requestGeo();
          state.sessionPhotos.push({ blob: f, capturedAt, geo });
          state.lastImageBlob = f;
          state.lastCapturedAt = capturedAt;
          state.lastGeo = geo;
        }

        const last = files[files.length - 1];
        if (last) setPreviewFromBlob(last);
        updateGalleryCount();

        // allow selecting the same file again later
        fileInput.value = "";
      });
    }
    if (tapReviewBtn) {
      tapReviewBtn.addEventListener("click", async () => {
        const n = Array.isArray(state.sessionPhotos) ? state.sessionPhotos.length : 0;
        if (n <= 0) {
          toast("Capture at least 1 photo");
          return;
        }
        await go("reviewPhotos");
      });
    }

    // Review Photos
    const reviewPhotosBackBtn = qs("reviewPhotosBackBtn");
    const reviewPhotosAddBtn = qs("reviewPhotosAddBtn");
    const submitAnalysisBtn = qs("submitAnalysisBtn");
    const rpCloseBtn = qs("rpCloseBtn");
    const rpModal = qs("rpModal");
    if (reviewPhotosBackBtn) reviewPhotosBackBtn.addEventListener("click", () => go("capture"));
    if (reviewPhotosAddBtn) reviewPhotosAddBtn.addEventListener("click", () => go("capture"));
    if (submitAnalysisBtn) submitAnalysisBtn.addEventListener("click", submitForAnalysis);
    if (rpCloseBtn) rpCloseBtn.addEventListener("click", closeRpModal);
    if (rpModal) {
      rpModal.addEventListener("click", (e) => {
        if (e.target === rpModal) closeRpModal();
      });
    }

    // Review
    const reviewBackBtn = qs("reviewBackBtn");
    const retakeBtn = qs("retakeBtn");
    const uploadBtn = qs("uploadBtn");
    if (reviewBackBtn) reviewBackBtn.addEventListener("click", () => go("capture"));
    if (retakeBtn) retakeBtn.addEventListener("click", () => go("capture"));
    if (uploadBtn) {
      uploadBtn.addEventListener("click", async () => {
        setMsg("", "");
        try {
          if (state.lastQuality?.blockUpload) {
            setMsg("bad", "Qualidade insuficiente. Use Retake antes de enviar.");
            return;
          }
          const r = await uploadEvidence();
          if (r?.data?.queued) {
            setMsg("ok", "Queued for sync.");
          } else {
            setMsg("ok", `Uploaded (HTTP ${r.status}). Evidence id: ${r.data.id}`);
          }
        } catch (err) {
          const d = err?.data;
          const msg = typeof d === "string" ? d : JSON.stringify(d);
          setMsg("bad", `Upload failed: ${msg}`);
        }
      });
    }

    // Offline badge
    window.addEventListener("online", setOfflineBadges);
    window.addEventListener("offline", setOfflineBadges);
    setOfflineBadges();
    window.addEventListener("online", trySyncQueue);
    window.addEventListener("online", () => updateSyncNowButton(false));
    window.addEventListener("offline", () => updateSyncNowButton(false));

    // SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/static/webapp/sw.js").catch(() => {});
    }

    if (validateBtn) {
      validateBtn.addEventListener("click", async () => {
        await go("validate");
      });
    }

    const validateBackBtn = qs("validateBackBtn");
    const validateRefreshBtn = qs("validateRefreshBtn");
    const validateApproveBtn = qs("validateApproveBtn");
    const validateApproveOverrideBtn = qs("validateApproveOverrideBtn");
    const validateRejectBtn = qs("validateRejectBtn");

    if (validateBackBtn) {
      validateBackBtn.addEventListener("click", async () => {
        await go("home");
      });
    }
    if (validateRefreshBtn) {
      validateRefreshBtn.addEventListener("click", async () => {
        await loadReviewQueue();
      });
    }
    if (validateApproveBtn) {
      validateApproveBtn.addEventListener("click", async () => {
        await submitDecision("approved", { withOverride: false });
      });
    }
    if (validateApproveOverrideBtn) {
      validateApproveOverrideBtn.addEventListener("click", async () => {
        try {
          await submitDecision("approved", { withOverride: true });
        } catch (e) {
          setValidateError(String(e?.message || e));
          toast("Invalid override JSON");
        }
      });
    }
    if (validateRejectBtn) {
      validateRejectBtn.addEventListener("click", async () => {
        await submitDecision("rejected", { withOverride: true });
      });
    }
  }

  loadAuth();
  show("splash");
  wire();
})();
