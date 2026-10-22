// Сервер приложения «Вендинг».
// Хранит логины от Вендисты у себя (в .env), отдаёт приложению только нужные данные.
// Без внешних зависимостей: нужен только Node.js 20+.
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const env = process.env;
const PORT = +env.PORT || 3000;
const VENDISTA = (env.VENDISTA_URL || "https://api.vendista.ru:99").replace(/\/$/, "");
const SECRET = env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
// ТЕСТОВЫЙ РЕЖИМ по умолчанию: сервер только ЧИТАЕТ из Вендисты.
// Любые изменения (возвраты и т.п.) возможны только при WRITE_MODE=on в .env — включается вручную.
const WRITE_MODE = env.WRITE_MODE === "on";
const ALLOW_REFUNDS = WRITE_MODE && env.ALLOW_REFUNDS === "1";
const DATA_DIR = env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- журнал важных действий ---------- */
function audit(user, action, details) {
  const line = JSON.stringify({ time: new Date().toISOString(), user, action, ...details }) + "\n";
  fs.appendFile(path.join(DATA_DIR, "audit.log"), line, () => {});
}

/* ---------- вход в приложение ---------- */
// APP_USERS="логин:соль:хеш,логин2:соль:хеш" (scrypt). Создаётся скриптом установки.
function users() {
  const out = {};
  (env.APP_USERS || "").split(",").filter(Boolean).forEach((u) => {
    const [login, salt, hash, role] = u.split(":");
    out[login.toLowerCase()] = { salt, hash, role: role || "owner" };
  });
  return out;
}
function checkPassword(login, pass) {
  const u = users()[String(login || "").toLowerCase()];
  if (!u) return null;
  const h = crypto.scryptSync(String(pass), u.salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash)) ? { login: login.toLowerCase(), role: u.role } : null;
}
function sign(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return body + "." + mac;
}
function unsign(tok) {
  if (!tok || !tok.includes(".")) return null;
  const [body, mac] = tok.split(".");
  const ok = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (mac.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(ok))) return null;
  const obj = JSON.parse(Buffer.from(body, "base64url").toString());
  if (obj.exp < Date.now()) return null;
  return obj;
}
function session(req) {
  const m = /(?:^|;\s*)vs=([^;]+)/.exec(req.headers.cookie || "");
  return m ? unsign(decodeURIComponent(m[1])) : null;
}
// простая защита от перебора паролей
const fails = new Map();
function tooMany(ip) {
  const f = fails.get(ip);
  return f && f.n >= 8 && Date.now() - f.t < 15 * 60e3;
}
function failed(ip) {
  const f = fails.get(ip) || { n: 0, t: 0 };
  if (Date.now() - f.t > 15 * 60e3) f.n = 0;
  f.n++; f.t = Date.now(); fails.set(ip, f);
}

/* ---------- Вендиста ---------- */
let vToken = null, vTokenAt = 0;
async function vendistaToken(force) {
  if (vToken && !force && Date.now() - vTokenAt < 6 * 3600e3) return vToken;
  const u = `${VENDISTA}/token?` + new URLSearchParams({ Login: env.VENDISTA_LOGIN || "", Password: env.VENDISTA_PASSWORD || "" });
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error("Вендиста не пустила: проверьте логин и пароль в настройках сервера" + (j.error ? ` (${j.error})` : ""));
  vToken = j.token; vTokenAt = Date.now();
  return vToken;
}
async function vget(p, params = {}, method = "GET") {
  if (method !== "GET" && !WRITE_MODE) throw new Error("Тестовый режим: изменения в Вендисте запрещены");
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await vendistaToken(attempt > 0);
    const u = `${VENDISTA}${p}?` + new URLSearchParams({ ...params, token });
    const r = await fetch(u, { method, headers: { Accept: "application/json" } });
    if (r.status === 401 && attempt === 0) continue;
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(`Вендиста: ${j.error || r.status}`);
    return j;
  }
}
async function vlist(p, params) { // все страницы
  const items = [];
  for (let page = 1; page < 200; page++) {
    const j = await vget(p, { ...params, PageNumber: page, ItemsOnPage: 1000 });
    const arr = j.items || [];
    items.push(...arr);
    if (arr.length < 1000 || items.length >= (j.items_count || 0)) break;
  }
  return items;
}
// даты для Вендисты: местное время Москвы без смещения
const pad = (n) => String(n).padStart(2, "0");
function msk(d) {
  const t = new Date(d.getTime() + 3 * 3600e3);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}
const toIso = (s) => (s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(" ", "T") + "+03:00" : s);

/* ---------- кеш ---------- */
const cache = new Map();
async function cached(key, ttl, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ttl) return c.val;
  const val = await fn();
  cache.set(key, { at: Date.now(), val });
  return val;
}

/* ---------- данные для приложения ---------- */
async function machines() {
  return cached("machines", 60e3, async () => {
    const [all, failedM, warnM, terms] = await Promise.all([
      vlist("/machines", {}),
      vlist("/machines", { ShowFailed: true, ShowWorking: false, ShowWarning: false }).catch(() => []),
      vlist("/machines", { ShowWarning: true, ShowWorking: false, ShowFailed: false }).catch(() => []),
      vlist("/terminals", {}).catch(() => []),
    ]);
    const fail = new Set(failedM.map((m) => m.id)), warn = new Set(warnM.map((m) => m.id));
    const termById = new Map(terms.map((t) => [t.id, t]));
    return all.map((m) => {
      const t = termById.get(m.terminal_id) || {};
      return {
        id: m.id, name: m.name || m.number || "Автомат " + m.id, model: m.model || "", address: m.address || "",
        division: m.division_name || "", number: m.number || "", terminal_id: m.terminal_id,
        last_sale: toIso(m.last_sale), last_online: toIso(t.last_online_time),
        state: fail.has(m.id) ? "failed" : warn.has(m.id) ? "warning" : "ok",
        daily_sum: (m.daily_sales_sum || 0) / 100, daily_count: m.daily_sales_count || 0,
      };
    });
  });
}
async function sales(from, to) {
  const key = `sales|${from}|${to}`;
  const ttl = Date.now() - new Date(to) < 3600e3 ? 30e3 : 3600e3;
  return cached(key, ttl, async () => {
    const rows = await vlist("/sales/list", { DateFrom: msk(new Date(from)), DateTo: msk(new Date(to)) });
    return rows.map((s) => ({
      id: s.id, machine_id: s.machine_id, time: toIso(s.time), button: s.item_id, name: s.item_name || "",
      price: (s.item_price || 0) / 100, qty: s.quantity || 1, sell_type: s.sell_type, terminal_id: s.terminal_id,
    }));
  });
}
async function transactions(from, to) {
  const rows = await cached(`tx|${from}|${to}`, 20e3, () =>
    vlist("/transactions", { DateFrom: msk(new Date(from)), DateTo: msk(new Date(to)) }));
  return rows.map((t) => ({
    id: t.id, terminal_id: t.term_id, time: toIso(t.time), sum: (t.sum || 0) / 100, left: (t.left_sum || 0) / 100,
    status: t.status, result: t.result, card: t.card_number || "", reverse_id: t.reverse_id || 0,
    items: (t.machine_item || []).map((i) => ({ button: i.machine_item_id, qty: i.quantity, name: i.item_info || "" })),
  }));
}

/* ---------- HTTP ---------- */
function send(res, code, obj, headers = {}) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((ok) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } });
  });
}
const ipOf = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
function range(q) {
  const to = q.get("to") ? new Date(q.get("to")) : new Date();
  const from = q.get("from") ? new Date(q.get("from")) : new Date(to.getTime() - 864e5);
  if (isNaN(from) || isNaN(to) || to - from > 62 * 864e5) throw Object.assign(new Error("Неверный период"), { code: 400 });
  return [from.toISOString(), to.toISOString()];
}

const routes = {
  "POST /api/login": async (req, res) => {
    const ip = ipOf(req);
    if (tooMany(ip)) return send(res, 429, { error: "Слишком много попыток. Подождите 15 минут." });
    const b = await body(req);
    const u = checkPassword(b.login, b.password);
    if (!u) { failed(ip); audit(String(b.login || ""), "login_failed", { ip }); return send(res, 401, { error: "Неверный логин или пароль" }); }
    const tok = sign({ ...u, exp: Date.now() + 90 * 864e5 });
    audit(u.login, "login", { ip });
    send(res, 200, { ok: true }, { "Set-Cookie": `vs=${encodeURIComponent(tok)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${90 * 86400}` });
  },
  "POST /api/logout": async (req, res) =>
    send(res, 200, { ok: true }, { "Set-Cookie": "vs=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" }),
  "GET /api/me": async (req, res, me) => send(res, 200, { login: me.login, role: me.role, test: !WRITE_MODE, refunds: ALLOW_REFUNDS && me.role === "owner" }),
  "GET /api/machines": async (req, res) => send(res, 200, await machines()),
  "GET /api/sales": async (req, res, me, q) => { const [f, t] = range(q); send(res, 200, await sales(f, t)); },
  "GET /api/transactions": async (req, res, me, q) => { const [f, t] = range(q); send(res, 200, await transactions(f, t)); },
  "POST /api/refund": async (req, res, me) => {
    if (!ALLOW_REFUNDS || me.role !== "owner") return send(res, 403, { error: "Возвраты отключены в настройках сервера" });
    const b = await body(req);
    if (!b.id || b.confirm !== true) return send(res, 400, { error: "Нет подтверждения возврата" });
    audit(me.login, "refund_request", { id: b.id, sum: b.sum });
    try {
      const r = await vget(`/transactions/${encodeURIComponent(b.id)}/cancel`, {}, "POST");
      audit(me.login, "refund_ok", { id: b.id });
      cache.clear();
      send(res, 200, { ok: true, result: r });
    } catch (e) {
      audit(me.login, "refund_error", { id: b.id, error: e.message });
      send(res, 502, { error: e.message });
    }
  },
  "GET /api/health": async (req, res) => send(res, 200, { ok: true }),
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const key = `${req.method} ${url.pathname}`;
  const h = routes[key];
  if (!h) return send(res, 404, { error: "Нет такого адреса" });
  const open = key === "POST /api/login" || key === "POST /api/logout" || key === "GET /api/health";
  const me = session(req);
  if (!open && !me) return send(res, 401, { error: "Нужно войти" });
  // защита от запросов с чужих сайтов
  if (req.method !== "GET" && req.headers.origin && env.DOMAIN && req.headers.origin !== `https://${env.DOMAIN}`)
    return send(res, 403, { error: "Запрос с чужого сайта" });
  try { await h(req, res, me, url.searchParams); }
  catch (e) { console.error(key, e.message); send(res, e.code || 502, { error: e.message }); }
}).listen(PORT, () => console.log("Вендинг: сервер на порту " + PORT + (WRITE_MODE ? " (изменения РАЗРЕШЕНЫ)" : " (тестовый режим: только чтение)")));
