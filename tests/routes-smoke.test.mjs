import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

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
  "waitlist-signup.js",
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

test("root waitlist form has bilingual consent disclosure with /privacy link and template structure", async () => {
  const html = await read(routes["/"]);

  assert.match(html, /<form\s+class="form-stack"\s+data-waitlist-form/);
  assert.match(html, /id="waitlist-email"[^>]*type="email"/);
  assert.match(html, /data-waitlist-submit/);
  assert.match(html, /data-waitlist-status/);

  assert.match(
    html,
    /We&rsquo;ll only use this email to notify you when Viaan opens to new members\./,
  );
  assert.match(
    html,
    /Wir verwenden diese E-Mail-Adresse ausschlie&szlig;lich, um dich zu informieren/,
  );
  assert.match(html, /<a href="\/privacy">privacy policy<\/a>/);
  assert.match(html, /<a href="\/privacy">Datenschutzerkl&auml;rung<\/a>/);

  assert.match(html, /data-template="waitlist-invalid-email"/);
  assert.match(html, /data-template="waitlist-failure"/);
  assert.match(html, /data-template="waitlist-success"/);

  assert.match(
    html,
    /You&rsquo;re on the list! We&rsquo;ll let you know when you have access\./,
  );
  assert.match(
    html,
    /Du stehst auf der Liste! Wir informieren dich, sobald der Zugang verf&uuml;gbar ist\./,
  );
  assert.match(
    html,
    /Couldn&rsquo;t add you to the list right now\. Please try again in a moment\./,
  );
  assert.match(
    html,
    /Wir konnten dich gerade nicht zur Liste hinzuf&uuml;gen\./,
  );
  assert.match(html, /Please enter a valid email address\./);
  assert.match(html, /Bitte gib eine g&uuml;ltige E-Mail-Adresse ein\./);

  assert.match(html, /<script src="\/waitlist-signup\.js" defer><\/script>/);
  assert.match(html, /<script src="\/auth-config\.js" defer><\/script>/);
  assert.match(html, /href="\/sign-in"/);
});

test("waitlist-signup.js wires up fetch contract per F131 spec", async () => {
  const script = await read("waitlist-signup.js");

  assert.match(script, /\/functions\/v1\/waitlist-signup/);
  assert.match(script, /SOURCE_SLUG\s*=\s*"web_root_cta"/);
  assert.match(script, /credentials:\s*"omit"/);
  assert.match(script, /apikey:\s*supabaseConfig\.publishableKey/);
  assert.match(script, /Authorization:\s*`Bearer \$\{supabaseConfig\.publishableKey\}`/);
  assert.match(script, /"Content-Type":\s*"application\/json"/);
  assert.match(script, /method:\s*"POST"/);

  assert.match(script, /response\.status\s*!==\s*200/);
  assert.match(script, /payload\.ok\s*!==\s*true/);

  assert.match(script, /submitButton\.disabled\s*=\s*isSubmitting/);
  assert.match(script, /\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//);

  assert.doesNotMatch(script, /localStorage\.setItem/);
  assert.doesNotMatch(script, /sessionStorage\.setItem/);
  assert.doesNotMatch(script, /document\.cookie\s*=/);
  assert.doesNotMatch(script, /console\.(log|info|warn|error|debug)/);
});

test("privacy page documents interim waitlist email processing in DE and EN", async () => {
  const html = await read(routes["/privacy"]);

  assert.match(html, /Warteliste &mdash; E-Mail-Verarbeitung \(vorl&auml;ufig\)/);
  assert.match(html, /Waitlist &mdash; email processing \(interim\)/);

  assert.match(html, /Art\. 6 Abs\. 1 lit\. a DSGVO/);
  assert.match(html, /GDPR Art\. 6\(1\)\(a\)/);

  assert.match(html, /href="mailto:hello@viaanhealth\.com"/);

  assert.match(html, /vorl&auml;ufig und wird vor dem &ouml;ffentlichen Produktivbetrieb durch eine anwaltlich gepr&uuml;fte Fassung gem&auml;&szlig; F120 ersetzt/);
  assert.match(html, /This text is interim and will be replaced by the F120 lawyer-approved version/);
});

test("vercel.json CSP allows the canonical Supabase project as the only external connect target", async () => {
  const json = JSON.parse(await read("vercel.json"));
  const cspHeader = json.headers
    ?.flatMap((entry) => entry.headers || [])
    .find((h) => h.key === "Content-Security-Policy");
  assert.ok(cspHeader, "vercel.json must define a Content-Security-Policy header");
  assert.match(cspHeader.value, /connect-src\s+'self'\s+https:\/\/psqvyxgkbupdbxvdpbll\.supabase\.co/);
  assert.doesNotMatch(cspHeader.value, /\bgoogle\b|\bgtm\b|\bsegment\b|\bmixpanel\b|\bamplitude\b/i);
});

async function runWaitlistInVm({ formData, supabaseConfig, fetch, locale } = {}) {
  const submitHandlers = [];
  const submitButton = {
    disabled: false,
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return this.attrs[name];
    },
  };
  const statusMessage = {
    className: "status-message",
    innerHTML: "",
    textContent: "",
  };
  const insertedRegions = [];
  const form = {
    hidden: false,
    removed: false,
    remove() {
      this.removed = true;
    },
    addEventListener(event, handler) {
      if (event === "submit") submitHandlers.push(handler);
    },
    parentNode: {
      insertBefore(newNode) {
        insertedRegions.push(newNode);
      },
    },
  };
  const templates = {
    "waitlist-invalid-email": "<INVALID_EMAIL/>",
    "waitlist-failure": "<FAILURE/>",
    "waitlist-success": "<SUCCESS/>",
  };
  const consoleCalls = [];
  const documentStub = {
    querySelector(selector) {
      if (selector === "[data-waitlist-form]") return form;
      if (selector === "[data-waitlist-status]") return statusMessage;
      if (selector === "[data-waitlist-submit]") return submitButton;
      const tplMatch = selector.match(/^\[data-template="([^"]+)"\]$/);
      if (tplMatch) {
        const name = tplMatch[1];
        return templates[name] !== undefined ? { innerHTML: templates[name] } : null;
      }
      return null;
    },
    createElement(tag) {
      return {
        tag,
        className: "",
        attrs: {},
        innerHTML: "",
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        },
      };
    },
  };
  const windowStub = {
    viaanSupabaseConfig: supabaseConfig,
    VIAAN_WAITLIST_LOCALE: locale,
  };
  const FormDataStub = function () {
    return {
      get(key) {
        return formData ? formData[key] : undefined;
      },
    };
  };
  const consoleStub = {
    log: (...args) => consoleCalls.push(["log", ...args]),
    info: (...args) => consoleCalls.push(["info", ...args]),
    warn: (...args) => consoleCalls.push(["warn", ...args]),
    error: (...args) => consoleCalls.push(["error", ...args]),
    debug: (...args) => consoleCalls.push(["debug", ...args]),
  };
  const sandbox = {
    document: documentStub,
    window: windowStub,
    fetch,
    FormData: FormDataStub,
    console: consoleStub,
  };
  const code = await read("waitlist-signup.js");
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    form,
    submitButton,
    statusMessage,
    insertedRegions,
    consoleCalls,
    async dispatchSubmit() {
      const handler = submitHandlers[0];
      if (!handler) throw new Error("waitlist-signup.js did not register a submit handler");
      await handler({ preventDefault() {} });
    },
  };
}

const SUPABASE = Object.freeze({
  url: "https://psqvyxgkbupdbxvdpbll.supabase.co",
  publishableKey: "sb_publishable_test",
});

test("waitlist submit: valid email triggers POST with normalized payload and shows success", async () => {
  const fetchCalls = [];
  const fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      status: 200,
      async json() {
        return { ok: true };
      },
    };
  };

  const dom = await runWaitlistInVm({
    formData: { email: "  Pilot@Example.test  " },
    supabaseConfig: SUPABASE,
    fetch,
  });

  await dom.dispatchSubmit();

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, `${SUPABASE.url}/functions/v1/waitlist-signup`);
  assert.equal(fetchCalls[0].options.method, "POST");
  assert.equal(fetchCalls[0].options.credentials, "omit");
  assert.equal(fetchCalls[0].options.headers["Content-Type"], "application/json");
  assert.equal(fetchCalls[0].options.headers.apikey, SUPABASE.publishableKey);
  assert.equal(fetchCalls[0].options.headers.Authorization, `Bearer ${SUPABASE.publishableKey}`);

  const body = JSON.parse(fetchCalls[0].options.body);
  assert.equal(body.email, "Pilot@Example.test");
  assert.equal(body.source, "web_root_cta");
  assert.equal(body.locale, undefined);

  assert.equal(dom.form.removed, true);
  assert.equal(dom.insertedRegions.length, 1);
  assert.match(dom.insertedRegions[0].innerHTML, /SUCCESS/);
  assert.equal(dom.submitButton.disabled, false);
  assert.equal(dom.consoleCalls.length, 0);
});

test("waitlist submit: locale source 'de-AT' normalizes to 'de' in body", async () => {
  const fetchCalls = [];
  const fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return { status: 200, async json() { return { ok: true }; } };
  };

  const dom = await runWaitlistInVm({
    formData: { email: "user@example.test" },
    supabaseConfig: SUPABASE,
    fetch,
    locale: "de-AT",
  });
  await dom.dispatchSubmit();

  const body = JSON.parse(fetchCalls[0].options.body);
  assert.equal(body.locale, "de");
});

test("waitlist submit: invalid email shows inline error and does NOT call fetch", async () => {
  let fetchCalled = false;
  const fetch = async () => {
    fetchCalled = true;
    return { status: 200, async json() { return { ok: true }; } };
  };

  const dom = await runWaitlistInVm({
    formData: { email: "not-an-email" },
    supabaseConfig: SUPABASE,
    fetch,
  });
  await dom.dispatchSubmit();

  assert.equal(fetchCalled, false);
  assert.equal(dom.form.removed, false);
  assert.match(dom.statusMessage.innerHTML, /INVALID_EMAIL/);
  assert.match(dom.statusMessage.className, /error/);
});

test("waitlist submit: 200 with wrong body shape falls through to failure copy", async () => {
  const fetch = async () => ({ status: 200, async json() { return { ok: false, code: "x" }; } });

  const dom = await runWaitlistInVm({
    formData: { email: "user@example.test" },
    supabaseConfig: SUPABASE,
    fetch,
  });
  await dom.dispatchSubmit();

  assert.equal(dom.form.removed, false);
  assert.match(dom.statusMessage.innerHTML, /FAILURE/);
  assert.equal(dom.submitButton.disabled, false);
});

test("waitlist submit: 200 with non-JSON body falls through to failure copy", async () => {
  const fetch = async () => ({
    status: 200,
    async json() {
      throw new Error("not json");
    },
  });

  const dom = await runWaitlistInVm({
    formData: { email: "user@example.test" },
    supabaseConfig: SUPABASE,
    fetch,
  });
  await dom.dispatchSubmit();

  assert.match(dom.statusMessage.innerHTML, /FAILURE/);
});

test("waitlist submit: non-200 status maps to failure copy without echoing email", async () => {
  for (const status of [400, 429, 500, 503]) {
    const fetch = async () => ({ status, async json() { return { ok: false }; } });
    const dom = await runWaitlistInVm({
      formData: { email: "leak-probe@example.test" },
      supabaseConfig: SUPABASE,
      fetch,
    });
    await dom.dispatchSubmit();

    assert.match(dom.statusMessage.innerHTML, /FAILURE/, `status=${status}`);
    assert.doesNotMatch(dom.statusMessage.innerHTML, /leak-probe/, `status=${status} email leaked`);
    assert.equal(dom.consoleCalls.length, 0, `status=${status} console called`);
  }
});

test("waitlist submit: fetch network rejection maps to failure copy", async () => {
  const fetch = async () => {
    throw new Error("network down");
  };

  const dom = await runWaitlistInVm({
    formData: { email: "user@example.test" },
    supabaseConfig: SUPABASE,
    fetch,
  });
  await dom.dispatchSubmit();

  assert.match(dom.statusMessage.innerHTML, /FAILURE/);
  assert.equal(dom.submitButton.disabled, false);
});

test("waitlist submit: in-flight disable visible while fetch is pending, re-enabled after", async () => {
  let resolveFetch;
  const fetch = () =>
    new Promise((resolve) => {
      resolveFetch = () => resolve({ status: 200, async json() { return { ok: true }; } });
    });

  const dom = await runWaitlistInVm({
    formData: { email: "user@example.test" },
    supabaseConfig: SUPABASE,
    fetch,
  });

  const dispatched = dom.dispatchSubmit();
  // Fetch is pending; the handler should have set disabled=true by now.
  await new Promise((r) => setImmediate(r));
  assert.equal(dom.submitButton.disabled, true);
  assert.equal(dom.submitButton.getAttribute("aria-disabled"), "true");
  assert.equal(dom.submitButton.getAttribute("aria-busy"), "true");

  resolveFetch();
  await dispatched;

  assert.equal(dom.submitButton.disabled, false);
  assert.equal(dom.submitButton.getAttribute("aria-disabled"), "false");
});
