const resetTitle = document.querySelector("[data-reset-title]");
const resetCopy = document.querySelector("[data-reset-copy]");
const resetForm = document.querySelector("[data-reset-form]");
const statusMessage = document.querySelector("[data-status-message]");
const pageStatus = document.querySelector("[data-page-status]");
const submitButton = document.querySelector("[data-submit-button]");
const verifyButton = document.querySelector("[data-verify-button]");
const supabaseConfig = window.viaanSupabaseConfig;

let recoveryAccessToken = null;
let pendingTokenHash = null;
let phase = "invalid";

function readTemplate(name) {
  return document.querySelector(`[data-template="${name}"]`)?.innerHTML ?? "";
}
function setInlineStatus(name) {
  statusMessage.className = "status-message show error";
  statusMessage.innerHTML = readTemplate(name);
}
function clearInlineStatus() {
  statusMessage.className = "status-message";
  statusMessage.textContent = "";
}
function setContent(title, template) {
  resetTitle.textContent = title;
  resetCopy.innerHTML = readTemplate(template);
}
function cleanUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}
function showInvalidLink() {
  phase = "invalid";
  recoveryAccessToken = null;
  pendingTokenHash = null;
  resetForm.hidden = true;
  verifyButton.hidden = true;
  setContent("Link ungültig / Invalid link", "reset-invalid-copy");
  pageStatus.className = "status-message show error";
  pageStatus.innerHTML = readTemplate("reset-invalid");
}
function showReadyState() {
  phase = "ready";
  verifyButton.hidden = true;
  resetForm.hidden = false;
  pageStatus.className = "status-message";
  pageStatus.textContent = "";
  setContent("Passwort festlegen / Choose password", "reset-ready-copy");
}
function setSubmitting(busy) {
  submitButton.disabled = busy;
  submitButton.setAttribute("aria-busy", String(busy));
  submitButton.textContent = busy ? "Speichern … / Saving …" : "Passwort speichern / Save password";
}

async function authRequest(path, { method = "GET", token, body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${supabaseConfig.authUrl}${path}`, {
      method,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        apikey: supabaseConfig.publishableKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let payload = null;
    if (response.status !== 204) {
      try { payload = await response.json(); } catch { /* No raw errors reach copy. */ }
    }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}
async function safePayload(response) {
  return response.payload;
}
async function validateSession(token) {
  const response = await authRequest("/user", { token });
  if (!response.ok) throw new Error("session-unavailable");
}

async function verifyLink() {
  if (phase !== "awaiting_confirmation" || !pendingTokenHash) return;
  phase = "verifying";
  const tokenHash = pendingTokenHash;
  pendingTokenHash = null; // No automatic replay of a consumed or uncertain link.
  verifyButton.disabled = true;
  verifyButton.setAttribute("aria-busy", "true");
  try {
    const response = await authRequest("/verify", {
      method: "POST", body: { token_hash: tokenHash, type: "recovery" },
    });
    const payload = await safePayload(response);
    if (!response.ok || typeof payload?.access_token !== "string" || !payload.access_token) {
      showInvalidLink();
      return;
    }
    await validateSession(payload.access_token);
    recoveryAccessToken = payload.access_token;
    showReadyState();
  } catch {
    showInvalidLink();
  } finally {
    verifyButton.setAttribute("aria-busy", "false");
  }
}

function passwordError(payload) {
  const code = typeof payload?.error_code === "string" ? payload.error_code : payload?.code;
  if (code === "same_password") return "reset-password-same";
  if (code === "weak_password") {
    const reasons = payload.weak_password?.reasons;
    if (Array.isArray(reasons) && reasons.includes("pwned")) return "reset-password-exposed";
    if (Array.isArray(reasons) && reasons.includes("length")) return "reset-password-length";
    return "reset-password-weak";
  }
  return "reset-unavailable";
}

async function submitPassword(event) {
  event.preventDefault();
  if (phase !== "ready" || !recoveryAccessToken) return;
  clearInlineStatus();
  const values = new FormData(resetForm);
  const password = String(values.get("password") || "");
  const confirmation = String(values.get("confirmPassword") || "");
  if (password.length < 8) { setInlineStatus("reset-password-too-short"); return; }
  if (password !== confirmation) { setInlineStatus("reset-password-mismatch"); return; }
  phase = "saving";
  setSubmitting(true);
  const token = recoveryAccessToken;
  try {
    const response = await authRequest("/user", { method: "PUT", token, body: { password } });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) { showInvalidLink(); return; }
      const payload = await safePayload(response);
      phase = "ready";
      setInlineStatus(passwordError(payload));
      return; // Keep the verified session for password-rule retries.
    }
    phase = "complete";
    recoveryAccessToken = null;
    resetForm.reset();
    resetForm.hidden = true;
    setContent("Passwort gespeichert / Password updated", "reset-success-copy");
    pageStatus.className = "status-message show success";
    pageStatus.innerHTML = readTemplate("reset-success");
    // Provider password UPDATE already revokes older refresh sessions. This
    // later cleanup must only end this recovery session, never a newer login.
    try {
      const cleanup = await authRequest("/logout?scope=local", { method: "POST", token, timeoutMs: 2000 });
      if (!cleanup.ok) throw new Error("cleanup-unconfirmed");
    } catch {
      pageStatus.innerHTML = readTemplate("reset-success-cleanup-unconfirmed");
    }
  } catch {
    phase = "ready";
    setInlineStatus("reset-unconfirmed"); // Saving may have succeeded; never invent success.
  } finally {
    setSubmitting(false);
  }
}

async function initializeResetPage() {
  if (!resetTitle || !resetCopy || !resetForm || !statusMessage || !pageStatus || !submitButton || !verifyButton || !supabaseConfig) return;
  const rawHash = window.location.hash.replace(/^#/, "");
  const hash = new URLSearchParams(rawHash);
  const search = new URLSearchParams(window.location.search);
  cleanUrl(); // Capture and remove secret material before any provider request.
  const tokenHash = hash.get("token_hash");
  const accessToken = hash.get("access_token");
  const recoveryType = hash.get("type");
  const errors = [hash, search].some(p => ["error", "error_code", "error_description"].some(k => p.has(k)));
  const duplicates = [...new Set(hash.keys())].some(k => hash.getAll(k).length !== 1);
  if (errors || duplicates || search.toString() || (tokenHash && accessToken)) { showInvalidLink(); return; }
  if (tokenHash && [...hash.keys()].every(k => k === "token_hash") && /^[a-f0-9]{32,128}$/i.test(tokenHash)) {
    pendingTokenHash = tokenHash;
    phase = "awaiting_confirmation";
    resetForm.hidden = true;
    verifyButton.hidden = false;
    verifyButton.disabled = false;
    setContent("Passwort festlegen / Choose password", "reset-verify-copy");
    return;
  }
  if (!accessToken || recoveryType !== "recovery" || tokenHash) { showInvalidLink(); return; }
  phase = "verifying";
  try {
    await validateSession(accessToken);
    recoveryAccessToken = accessToken;
    showReadyState();
  } catch { showInvalidLink(); }
}

verifyButton?.addEventListener("click", verifyLink);
resetForm?.addEventListener("submit", submitPassword);
void initializeResetPage();
