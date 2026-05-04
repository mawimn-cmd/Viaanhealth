const confirmTitle = document.querySelector("[data-confirm-title]");
const confirmCopy = document.querySelector("[data-confirm-copy]");
const statusMessage = document.querySelector("[data-status-message]");
const supabaseConfig = window.viaanSupabaseConfig;

function readTemplate(name) {
  const template = document.querySelector(`[data-template="${name}"]`);
  return template ? template.innerHTML : "";
}

function setStatus(type, html) {
  statusMessage.className = `status-message show ${type}`;
  statusMessage.innerHTML = html;
}

function setContent(title, templateName) {
  confirmTitle.textContent = title;
  confirmCopy.innerHTML = readTemplate(templateName);
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

async function getCurrentUser(accessToken) {
  const response = await fetch(`${supabaseConfig.authUrl}/user`, {
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("invalid-session");
  }

  return response.json();
}

async function confirmEmail() {
  if (!statusMessage || !confirmTitle || !confirmCopy || !supabaseConfig) {
    return;
  }

  const hashParams = readHashParams();
  const searchParams = new URLSearchParams(window.location.search);

  if (hasSupabaseError(hashParams, searchParams)) {
    cleanUrl();
    setContent("Email verification failed", "confirm-error-copy");
    setStatus("error", readTemplate("confirm-error"));
    return;
  }

  const accessToken = hashParams.get("access_token");

  if (!accessToken) {
    if (searchParams.has("code")) {
      cleanUrl();
      setContent("Email verification incomplete", "confirm-incomplete-copy");
      setStatus("error", readTemplate("confirm-incomplete"));
      return;
    }

    setContent("Email verification link required", "confirm-missing-copy");
    setStatus("error", readTemplate("confirm-missing"));
    return;
  }

  try {
    await getCurrentUser(accessToken);
    cleanUrl();
    setContent("Email verified", "confirm-success-copy");
    setStatus("success", readTemplate("confirm-success"));
  } catch {
    cleanUrl();
    setContent("Email verification failed", "confirm-error-copy");
    setStatus("error", readTemplate("confirm-error"));
  }
}

confirmEmail();
