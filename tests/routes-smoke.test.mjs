import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const routes = {
  "/": "index.html",
  "/sign-in": "sign-in/index.html",
  "/auth/confirm": "auth/confirm/index.html",
  "/auth/reset": "auth/reset/index.html",
  "/imprint": "imprint/index.html",
  "/privacy": "privacy/index.html",
  "/terms": "terms/index.html",
};

const productionFiles = [
  ...Object.values(routes),
  "styles.css",
  "site.js",
  "auth-config.js",
  "sign-in.js",
  "auth-confirm.js",
  "auth-reset.js",
  "favicon.svg",
  "vercel.json",
];

const forbiddenCopy = [
  /AI-powered/i,
  /AI food scoring/i,
  /Food Score/i,
  /HbA1c/i,
  /hs-?CRP/i,
  /Cholesterol/i,
  /Vitamin D/i,
  /biological-age calculator/i,
  /gtag\(/i,
  /googletagmanager/i,
  /clarity/i,
  /hotjar/i,
  /session replay/i,
  /gdnkbogudoooayjxedyt/i,
  /service[_-]?role/i,
  /sb_secret_/i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
];

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("F131 routes exist and declare their route ownership", async () => {
  for (const [route, file] of Object.entries(routes)) {
    const html = await read(file);
    assert.match(html, /Viaan Health|Impressum|Datenschutz|Nutzungsbedingungen/);
    assert.match(html, new RegExp(`data-route="${route.replace("/", "\\/")}"`));
  }
});

test("sign-in shell includes required states and bilingual email-not-confirmed copy", async () => {
  const html = await read(routes["/sign-in"]);
  const script = await read("sign-in.js");
  const authConfig = await read("auth-config.js");

  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /Your email is not verified yet\. Check your inbox or contact support\./);
  assert.match(html, /Deine E-Mail ist noch nicht best&auml;tigt\. Pr&uuml;fe dein Postfach oder kontaktiere den Support\./);
  assert.match(html, /Sign-in succeeded\. You can return to the Viaan app\./);
  assert.match(script, /Signing in\.\.\./);
  assert.match(script, /invalid-credentials/);
  assert.match(script, /email-not-confirmed/);
  assert.match(script, /fetch\(/);
  assert.match(script, /grant_type=password/);
  assert.match(script, /member-password-reset/);
  assert.match(authConfig, /https:\/\/psqvyxgkbupdbxvdpbll\.supabase\.co/);
  assert.match(authConfig, /sb_publishable_T6C-MkpZc1m8Ymp6gNXcyA_fc56iJ3m/);
  assert.match(html, /Forgot password\?/);
  assert.match(html, /If an account exists for that email, we sent password reset instructions\./);
  assert.match(html, /Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir Anweisungen zum Zur&uuml;cksetzen des Passworts gesendet\./);
  assert.doesNotMatch(html, /resend/i);
});

test("auth callback shells process Supabase confirmation and recovery hashes", async () => {
  const confirm = await read(routes["/auth/confirm"]);
  const confirmScript = await read("auth-confirm.js");
  const reset = await read(routes["/auth/reset"]);
  const resetScript = await read("auth-reset.js");

  assert.match(confirm, /Confirming your email\.\.\./);
  assert.match(confirm, /Deine E-Mail wird best&auml;tigt\.\.\./);
  assert.match(confirm, /removes confirmation tokens from the address bar/);
  assert.match(confirmScript, /access_token/);
  assert.match(confirmScript, /history\.replaceState/);
  assert.match(confirmScript, /Email verified/);
  assert.match(confirmScript, /Email verification failed/);
  assert.match(confirmScript, /\/user/);
  assert.doesNotMatch(confirm, /does not process verification links yet/);

  assert.match(reset, /New password/);
  assert.match(reset, /Neues Passwort/);
  assert.match(reset, /viaan:\/\/sign-in/);
  assert.match(reset, /removes password reset tokens from the address bar/);
  assert.match(resetScript, /access_token/);
  assert.match(resetScript, /recoveryType !== "recovery"/);
  assert.match(resetScript, /history\.replaceState/);
  assert.match(resetScript, /\/user/);
  assert.match(resetScript, /password/);
  assert.match(resetScript, /logout\?scope=global/);
  assert.match(resetScript, /Password updated/);
});

test("legal pages visibly gate production cutover on F120/F121", async () => {
  for (const route of ["/imprint", "/privacy", "/terms"]) {
    const html = await read(routes[route]);
    assert.match(html, /Production legal text pending F120\/F121\./);
    assert.match(html, /Production launch \/ real-user traffic is gated on real Impressum and Datenschutzerkl&auml;rung text landing via F120\/F121\./);
  }
});

test("root-domain auth URL decision is documented", async () => {
  const site = await read("site.js");
  assert.match(site, /https:\/\/viaanhealth\.com\/auth\/confirm/);
  assert.match(site, /https:\/\/viaanhealth\.com\/auth\/reset/);
  assert.match(site, /https:\/\/viaanhealth\.com\/sign-in/);
  assert.match(site, /app\.viaanhealth\.com/);
});

test("production route files avoid analytics, PHI examples, and prohibited scoring copy", async () => {
  for (const file of productionFiles) {
    const content = await read(file);
    for (const pattern of forbiddenCopy) {
      assert.doesNotMatch(content, pattern, `${file} contains forbidden pattern ${pattern}`);
    }
  }
});
