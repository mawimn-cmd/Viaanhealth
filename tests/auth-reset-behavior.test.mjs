import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const script = await readFile(new URL("../auth-reset.js", import.meta.url), "utf8");
const hashValue = "a".repeat(56);
const reply = (status = 200, payload = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page({ hash = `#token_hash=${hashValue}`, search = "", fetcher } = {}) {
  const calls = [];
  const nodes = new Map();
  const names = ["reset-title", "reset-copy", "reset-form", "status-message", "page-status", "submit-button", "verify-button"];
  for (const name of names) nodes.set(`[data-${name}]`, {
    hidden: false, disabled: false, innerHTML: "", textContent: "", attrs: {}, handlers: {},
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.handlers[k] = fn; }, reset() { this.resetCalled = true; },
  });
  const location = { pathname: "/auth/reset", hash, search };
  let values = { password: "test-owner-password", confirmPassword: "test-owner-password" };
  const context = vm.createContext({
    window: { location, viaanSupabaseConfig: { authUrl: "https://auth.invalid/auth/v1", publishableKey: "test-public-key" }, history: { replaceState() { location.hash = ""; location.search = ""; } } },
    document: { querySelector(selector) { if (selector.startsWith("[data-template=")) return { innerHTML: selector }; return nodes.get(selector) ?? null; } },
    URLSearchParams, AbortController, setTimeout, clearTimeout,
    FormData: class { get(key) { return values[key]; } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fetcher) return await fetcher(url, options, calls);
      if (url.endsWith("/verify")) return reply(200, { access_token: "test-recovery-access" });
      return reply(url.includes("/logout") ? 204 : 200);
    },
  });
  vm.runInContext(script, context);
  await tick();
  const node = name => nodes.get(`[data-${name}]`);
  return { calls, location, node,
    state: () => vm.runInContext("({ phase, hasSession: Boolean(recoveryAccessToken), hasHash: Boolean(pendingTokenHash) })", context),
    setValues(next) { values = { ...values, ...next }; },
    verify: () => node("verify-button").handlers.click(),
    submit: () => node("reset-form").handlers.submit({ preventDefault() {} }),
  };
}

test("new link prefetch removes fragment and makes no provider request", async () => {
  const p = await page();
  assert.equal(p.calls.length, 0);
  assert.equal(p.location.hash, "");
  assert.equal(p.state().phase, "awaiting_confirmation");
  assert.equal(p.node("reset-form").hidden, true);
});

test("explicit verification uses only the configured destination and fixed recovery type", async () => {
  const p = await page();
  await p.verify();
  assert.equal(p.calls.length, 2);
  assert.ok(p.calls[0].url.endsWith("/auth/v1/verify"));
  assert.ok(JSON.parse(p.calls[0].options.body).type === "recovery");
  assert.ok(JSON.parse(p.calls[0].options.body).token_hash === hashValue);
  assert.equal(p.calls[0].options.credentials, "omit");
  assert.equal(p.state().phase, "ready");
  assert.equal(p.state().hasSession, true);
});

test("duplicate verification clicks are single-flight", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const p = await page({ fetcher: async url => url.endsWith("/verify") ? await wait : reply() });
  const first = p.verify();
  await p.verify();
  assert.equal(p.calls.length, 1);
  release(reply(200, { access_token: "test-access" }));
  await first;
  assert.equal(p.state().phase, "ready");
});

for (const hash of ["#token_hash=invalid", `#token_hash=${hashValue}&token_hash=${hashValue}`, `#token_hash=${hashValue}&access_token=test-access&type=recovery`, `#token_hash=${hashValue}&confirmation_url=https://other.invalid`, "#error_description=untrusted-copy"]) {
  test("malformed or ambiguous entry fails closed without provider request", async () => {
    const p = await page({ hash });
    assert.equal(p.calls.length, 0);
    assert.equal(p.state().phase, "invalid");
    assert.ok(!p.node("page-status").innerHTML.includes("untrusted-copy"));
  });
}

test("query credentials are rejected and removed", async () => {
  const p = await page({ hash: "", search: `?token_hash=${hashValue}` });
  assert.equal(p.calls.length, 0);
  assert.equal(p.location.search, "");
  assert.equal(p.state().phase, "invalid");
});

test("old recovery access-token entry validates session without redeeming a link", async () => {
  const p = await page({ hash: "#access_token=test-access&type=recovery&refresh_token=test-refresh&expires_in=3600" });
  assert.equal(p.calls.length, 1);
  assert.ok(p.calls[0].url.endsWith("/user"));
  assert.equal(p.state().phase, "ready");
});

for (const code of ["weak_password", "same_password"]) for (const wire of ["code", "error_code"]) {
  test(`password-rule retry uses ${wire}/${code} and never reverifies the link`, async () => {
    let puts = 0;
    const p = await page({ fetcher: async (url, options) => {
      if (url.endsWith("/verify")) return reply(200, { access_token: "test-access" });
      if (options.method === "PUT" && ++puts === 1) return reply(422, { ...(wire === "code" ? { code } : { code: 422, error_code: code }), message: "untrusted-provider-copy" });
      return reply(url.includes("/logout") ? 204 : 200);
    } });
    await p.verify();
    await p.submit();
    assert.equal(p.state().phase, "ready");
    assert.equal(p.state().hasSession, true);
    assert.ok(!p.node("status-message").innerHTML.includes("untrusted-provider-copy"));
    assert.ok(p.node("status-message").innerHTML.includes(code === "same_password" ? "reset-password-same" : "reset-password-weak"));
    await p.submit();
    assert.equal(p.state().phase, "complete");
    assert.equal(p.calls.filter(c => c.url.endsWith("/verify")).length, 1);
    assert.equal(puts, 2);
    assert.ok(p.calls.at(-1).url.endsWith("/logout?scope=local"));
  });
}

test("expired verification cannot be retried after consuming or uncertain result", async () => {
  const p = await page({ fetcher: async () => reply(403, { code: "otp_expired", message: "untrusted-copy" }) });
  await p.verify();
  await p.verify();
  assert.equal(p.calls.length, 1);
  assert.equal(p.state().phase, "invalid");
});

test("short and mismatched passwords produce no PUT", async () => {
  const p = await page();
  await p.verify();
  p.setValues({ password: "short", confirmPassword: "short" });
  await p.submit();
  p.setValues({ password: "test-owner-password", confirmPassword: "different" });
  await p.submit();
  assert.equal(p.calls.filter(c => c.options.method === "PUT").length, 0);
});

test("uncertain save preserves session without claiming success", async () => {
  const p = await page({ fetcher: async (url, options) => {
    if (url.endsWith("/verify")) return reply(200, { access_token: "test-access" });
    if (options.method === "PUT") throw new Error("test-network-failure");
    return reply();
  } });
  await p.verify(); await p.submit();
  assert.equal(p.state().phase, "ready");
  assert.equal(p.state().hasSession, true);
  assert.ok(p.node("status-message").innerHTML.includes("reset-unconfirmed"));
});

test("cleanup failure cannot change successful password outcome", async () => {
  const p = await page({ fetcher: async url => {
    if (url.endsWith("/verify")) return reply(200, { access_token: "test-access" });
    if (url.includes("/logout")) throw new Error("test-cleanup-failure");
    return reply();
  } });
  await p.verify(); await p.submit();
  assert.equal(p.state().phase, "complete");
  assert.equal(p.state().hasSession, false);
  assert.ok(p.node("page-status").innerHTML.includes("cleanup-unconfirmed"));
  assert.equal(p.calls.some(c => c.url.includes("scope=global")), false);
});

test("duplicate password submission is single-flight", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const p = await page({ fetcher: async (url, options) => {
    if (url.endsWith("/verify")) return reply(200, { access_token: "test-access" });
    if (options.method === "PUT") return await wait;
    return reply();
  } });
  await p.verify();
  const first = p.submit(); await p.submit();
  assert.equal(p.calls.filter(c => c.options.method === "PUT").length, 1);
  release(reply()); await first;
  assert.equal(p.state().phase, "complete");
});
