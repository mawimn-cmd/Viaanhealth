const form = document.querySelector("[data-sign-in-form]");
const statusMessage = document.querySelector("[data-status-message]");
const submitButton = document.querySelector("[data-submit-button]");

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

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
  submitButton.textContent = isSubmitting ? "Signing in..." : "Sign in";
}

function hasValidShape(email, password) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length > 0;
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
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      setStatus("error", readTemplate("auth-not-enabled"));
    } finally {
      setSubmitting(false);
    }
  });
}
