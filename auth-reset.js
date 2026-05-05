const resetTitle = document.querySelector("[data-reset-title]");
const resetCopy = document.querySelector("[data-reset-copy]");
const resetForm = document.querySelector("[data-reset-form]");
const statusMessage = document.querySelector("[data-status-message]");
const pageStatus = document.querySelector("[data-page-status]");
const submitButton = document.querySelector("[data-submit-button]");
const supabaseConfig = window.viaanSupabaseConfig;

let recoveryAccessToken = null;

function readTemplate(name) {
  const template = document.querySelector(`[data-template="${name}"]`);
  return template ? template.innerHTML : "";
}

function setInlineStatus(type, html) {
  statusMessage.className = `status-message show ${type}`;
  statusMessage.innerHTML = html;
}

function clearInlineStatus() {
  statusMessage.className = "status-message";
  statusMessage.textContent = "";
}

function setPageStatus(type, html) {
  pageStatus.className = `status-message show ${type}`;
  pageStatus.innerHTML = html;
}

function clearPageStatus() {
  pageStatus.className = "status-message";
  pageStatus.textContent = "";
}

function setContent(title, templateName) {
  resetTitle.textContent = title;
  resetCopy.innerHTML = readTemplate(templateName);
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
  submitButton.textContent = isSubmitting ? "Updating..." : "Update password";
}

function cleanUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}

function readHashParams() {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(rawHash);
}

function hasSupabaseError(hashParams, searchParams) {
  return (
    hashParams.has("error") ||
    hashParams.has("error_code") ||
    hashParams.has("error_description") ||
    searchParams.has("error") ||
    searchParams.has("error_code") ||
    searchParams.has("error_description")
  );
}

function showInvalidLink() {
  resetForm.hidden = true;
  clearInlineStatus();
  setContent("Password reset link invalid", "reset-invalid-copy");
  setPageStatus("error", readTemplate("reset-invalid"));
}

function showReadyState() {
  resetForm.hidden = false;
  clearPageStatus();
  setContent("Password reset", "reset-ready-copy");
}

function showSuccessState() {
  resetForm.hidden = true;
  clearInlineStatus();
  setContent("Password updated", "reset-success-copy");
  setPageStatus("success", readTemplate("reset-success"));
}

function validatePassword(password, confirmPassword) {
  if (password.length < 8) {
    return "reset-password-too-short";
  }

  if (password !== confirmPassword) {
    return "reset-password-mismatch";
  }

  return null;
}

async function updatePassword(accessToken, password) {
  const response = await fetch(`${supabaseConfig.authUrl}/user`, {
    body: JSON.stringify({
      password,
    }),
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error("update-failed");
  }
}

async function signOutRecoverySession(accessToken) {
  await fetch(`${supabaseConfig.authUrl}/logout?scope=global`, {
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
  });
}

function initializeResetPage() {
  if (!resetTitle || !resetCopy || !resetForm || !statusMessage || !pageStatus || !supabaseConfig) {
    return;
  }

  const hashParams = readHashParams();
  const searchParams = new URLSearchParams(window.location.search);

  if (hasSupabaseError(hashParams, searchParams)) {
    cleanUrl();
    showInvalidLink();
    return;
  }

  const accessToken = hashParams.get("access_token");
  const recoveryType = hashParams.get("type");

  if (!accessToken || recoveryType !== "recovery") {
    if (window.location.hash || window.location.search) {
      cleanUrl();
    }
    showInvalidLink();
    return;
  }

  recoveryAccessToken = accessToken;
  cleanUrl();
  showReadyState();
}

if (resetForm) {
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearInlineStatus();

    if (!recoveryAccessToken) {
      showInvalidLink();
      return;
    }

    const formData = new FormData(resetForm);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const validationError = validatePassword(password, confirmPassword);

    if (validationError) {
      setInlineStatus("error", readTemplate(validationError));
      return;
    }

    setSubmitting(true);

    try {
      await updatePassword(recoveryAccessToken, password);

      try {
        await signOutRecoverySession(recoveryAccessToken);
      } catch {
        // Password update succeeded; session cleanup failure must not block the success state.
      }

      resetForm.reset();
      recoveryAccessToken = null;
      showSuccessState();
    } catch {
      setInlineStatus("error", readTemplate("reset-unavailable"));
    } finally {
      setSubmitting(false);
    }
  });
}

initializeResetPage();
