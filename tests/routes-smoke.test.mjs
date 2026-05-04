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
  "sign-in.js",
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
  /https:\/\/[a-z0-9]{20}\.supabase\.co/i,
  /gdnkbogudoooayjxedyt/i,
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

  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /Your email is not verified yet\. Check your inbox or contact support\./);
  assert.match(html, /Deine E-Mail ist noch nicht best&auml;tigt\. Pr&uuml;fe dein Postfach oder kontaktiere den Support\./);
  assert.match(html, /Sign-in is not enabled in this preview/);
  assert.match(script, /Signing in\.\.\./);
  assert.match(script, /invalid-credentials/);
  assert.match(script, /auth-not-enabled/);
  assert.doesNotMatch(script, /fetch\(/);
  assert.doesNotMatch(script, /supabase/i);
  assert.doesNotMatch(html, /resend/i);
});

test("auth callback shells do not masquerade as functional production handlers", async () => {
  const confirm = await read(routes["/auth/confirm"]);
  const reset = await read(routes["/auth/reset"]);

  assert.match(confirm, /Email verification pending/);
  assert.match(confirm, /does not process verification links yet/);
  assert.match(confirm, /F131 remains incomplete for production cutover/);
  assert.doesNotMatch(confirm, /Confirming your email\.\.\./);

  assert.match(reset, /Password reset/);
  assert.match(reset, /Passwort zur&uuml;cksetzen/);
  assert.match(reset, /F003 owns recovery token handling/);
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
