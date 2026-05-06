const form = document.querySelector("[data-waitlist-form]");
const statusMessage = document.querySelector("[data-waitlist-status]");
const submitButton = document.querySelector("[data-waitlist-submit]");
const supabaseConfig = window.viaanSupabaseConfig;

const SOURCE_SLUG = "web_root_cta";

function readTemplate(name) {
  const template = document.querySelector(`[data-template="${name}"]`);
  return template ? template.innerHTML : "";
}

function setStatus(type, html) {
  if (!statusMessage) return;
  statusMessage.className = `status-message show ${type}`;
  statusMessage.innerHTML = html;
}

function clearStatus() {
  if (!statusMessage) return;
  statusMessage.className = "status-message";
  statusMessage.textContent = "";
}

function setSubmitting(isSubmitting) {
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-disabled", String(isSubmitting));
  submitButton.setAttribute("aria-busy", String(isSubmitting));
}

function hasValidEmailShape(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function inferLocale() {
  const candidate = (typeof window !== "undefined" && window.VIAAN_WAITLIST_LOCALE) || "";
  const normalized = String(candidate).toLowerCase().split("-")[0];
  if (normalized === "de" || normalized === "en") {
    return normalized;
  }
  return undefined;
}

async function submitWaitlist(email, locale) {
  if (!supabaseConfig) {
    throw new Error("waitlist-unavailable");
  }

  const body = { email, source: SOURCE_SLUG };
  if (locale) {
    body.locale = locale;
  }

  const response = await fetch(`${supabaseConfig.url}/functions/v1/waitlist-signup`, {
    body: JSON.stringify(body),
    credentials: "omit",
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${supabaseConfig.publishableKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status !== 200) {
    throw new Error("waitlist-unavailable");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("waitlist-unavailable");
  }

  if (!payload || payload.ok !== true) {
    throw new Error("waitlist-unavailable");
  }
}

function replaceFormWithSuccess() {
  if (!form || !form.parentNode) return;
  const successRegion = document.createElement("div");
  successRegion.className = "status-message show success";
  successRegion.setAttribute("role", "status");
  successRegion.setAttribute("aria-live", "polite");
  successRegion.innerHTML = readTemplate("waitlist-success");
  form.parentNode.insertBefore(successRegion, form);
  form.remove();
}

let isSubmitting = false;

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearStatus();

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();

    if (!hasValidEmailShape(email)) {
      setStatus("error", readTemplate("waitlist-invalid-email"));
      return;
    }

    isSubmitting = true;
    setSubmitting(true);

    try {
      await submitWaitlist(email, inferLocale());
      replaceFormWithSuccess();
    } catch {
      setStatus("error", readTemplate("waitlist-failure"));
    } finally {
      setSubmitting(false);
      isSubmitting = false;
    }
  });
}
