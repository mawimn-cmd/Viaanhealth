const form = document.querySelector("[data-sign-in-form]");
const statusMessage = document.querySelector("[data-status-message]");
const submitButton = document.querySelector("[data-submit-button]");
const passwordResetForm = document.querySelector("[data-password-reset-form]");
const passwordResetStatus = document.querySelector("[data-password-reset-status]");
const passwordResetButton = document.querySelector("[data-password-reset-button]");
const supabaseConfig = window.viaanSupabaseConfig;

function readTemplate(name) {
  const template = document.querySelector(`[data-template="${name}"]`);
  return template ? template.innerHTML : "";
}

function setStatus(type, html) {
  statusMessage.className = `status-message show ${type}`;
  statusMessage.innerHTML = html;
}

function clearStatus() {
  statusMessage.className = "status-message";
  statusMessage.textContent = "";
}

function setResetStatus(type, html) {
  passwordResetStatus.className = `status-message show ${type}`;
  passwordResetStatus.innerHTML = html;
}

function clearResetStatus() {
  passwordResetStatus.className = "status-message";
  passwordResetStatus.textContent = "";
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
  submitButton.textContent = isSubmitting ? "Signing in..." : "Sign in";
}

function setResetSubmitting(isSubmitting) {
  passwordResetButton.disabled = isSubmitting;
  passwordResetButton.setAttribute("aria-busy", String(isSubmitting));
  passwordResetButton.textContent = isSubmitting ? "Sending..." : "Send reset link";
}

function hasValidShape(email, password) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length > 0;
}

function hasValidEmailShape(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeError(message) {
  const lowerMessage = String(message || "").toLowerCase();

  if (
    lowerMessage.includes("email not confirmed") ||
    lowerMessage.includes("email_not_confirmed") ||
    lowerMessage.includes("not confirmed")
  ) {
    return "email-not-confirmed";
  }

  return "invalid-credentials";
}

async function signInWithPassword(email, password) {
  if (!supabaseConfig) {
    throw new Error("auth-unavailable");
  }

  const response = await fetch(`${supabaseConfig.authUrl}/token?grant_type=password`, {
    body: JSON.stringify({
      email,
      password,
    }),
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${supabaseConfig.publishableKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const templateName = normalizeError(payload.error_description || payload.msg || payload.error);
    throw new Error(templateName);
  }

  return payload;
}

async function requestPasswordReset(email) {
  if (!supabaseConfig) {
    throw new Error("auth-unavailable");
  }

  const response = await fetch(`${supabaseConfig.url}/functions/v1/member-password-reset`, {
    body: JSON.stringify({
      email,
    }),
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${supabaseConfig.publishableKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok !== true) {
    throw new Error("reset-unavailable");
  }

  return payload;
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!hasValidShape(email, password)) {
      setStatus("error", readTemplate("invalid-credentials"));
      return;
    }

    setSubmitting(true);

    try {
      await signInWithPassword(email, password);
      setStatus("success", readTemplate("sign-in-success"));
    } catch (error) {
      const templateName =
        error instanceof Error && error.message === "email-not-confirmed"
          ? "email-not-confirmed"
          : "invalid-credentials";
      setStatus("error", readTemplate(templateName));
    } finally {
      setSubmitting(false);
    }
  });
}

if (passwordResetForm) {
  passwordResetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearResetStatus();

    const formData = new FormData(passwordResetForm);
    const email = String(formData.get("email") || "").trim();

    if (!hasValidEmailShape(email)) {
      setResetStatus("error", readTemplate("reset-request-invalid-email"));
      return;
    }

    setResetSubmitting(true);

    try {
      await requestPasswordReset(email);
      setResetStatus("success", readTemplate("reset-request-success"));
    } catch {
      setResetStatus("error", readTemplate("reset-request-unavailable"));
    } finally {
      setResetSubmitting(false);
    }
  });
}
