// Сервер приложения «Вендинг».
// Несколько аккаунтов: у каждого свои автоматы, товары, планограммы, загрузки и свой доступ к Вендисте.
// Доступ к Вендисте хранится в настройках аккаунта (в базе, в зашифрованном виде), а не в коде.
// У каждого пользователя есть роль; права проверяются на сервере для каждого запроса.
// Без внешних зависимостей: нужен только Node.js 20+.
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const env = process.env;
const PORT = +env.PORT || 3000;
const VENDISTA = (env.VENDISTA_URL || "https://api.vendista.ru:99").replace(/\/$/, "");
const DATA_DIR = env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
// ТЕСТОВЫЙ РЕЖИМ по умолчанию: в Вендисте сервер только ЧИТАЕТ.
// Изменения в Вендисте (возвраты) возможны только при WRITE_MODE=on в .env — включается вручную.
// Данные самого приложения (планограммы, товары, загрузки) хранятся у нас и меняются в любом режиме.
const WRITE_MODE = env.WRITE_MODE === "on";
const ALLOW_REFUNDS = WRITE_MODE && env.ALLOW_REFUNDS === "1";

// секрет для подписи входа и шифрования ключей Вендисты: из .env или создаётся один раз в data/
const SECRET = env.SESSION_SECRET || (() => {
  const f = path.join(DATA_DIR, "secret.key");
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  return fs.readFileSync(f, "utf8").trim();
})();
const ENC_KEY = crypto.scryptSync(SECRET, "vending-secrets", 32);

/* ================= РОЛИ И ПРАВА ================= */
// Пока одна роль — владелец, видит и может всё. Роли операторов добавим позже, перечислив их права здесь.
const PERMS = {
  "sales.view": "Продажи и обзор", "machines.view": "Автоматы и остатки", "reports.view": "Отчёты и прибыль",
  "loadings.create": "Отмечать загрузку", "planograms.edit": "Менять планограммы", "catalog.edit": "Менять товары, ингредиенты, рецепты и себестоимость",
  "refunds.create": "Делать возвраты", "account.manage": "Настройки аккаунта и доступ к Вендисте", "users.manage": "Пользователи и роли",
};
const ROLES = {
  owner: { title: "Владелец", perms: ["*"] },
};
const can = (u, p) => { const r = ROLES[u.role]; return !!r && (r.perms.includes("*") || r.perms.includes(p)); };
const permsOf = (u) => { const r = ROLES[u.role]; return !r ? [] : r.perms.includes("*") ? Object.keys(PERMS) : r.perms.slice(); };

/* ================= БАЗА (JSON-файл, запись атомарная) ================= */
const DB_FILE = path.join(DATA_DIR, "db.json");
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : { accounts: {}, users: {}, seq: 1 };
// запись сразу при каждом изменении: данных немного, а при перезапуске ничего не теряется
function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
const nextId = () => db.seq++;
function account(id) { const a = db.accounts[id]; if (!a) throw Object.assign(new Error("Аккаунт не найден"), { code: 404 }); return a; }
function newAccount(name) {
  const id = String(nextId());
  db.accounts[id] = { id, name, created: new Date().toISOString(), vendista: {}, products: [], planograms: {}, loadings: [] };
  return db.accounts[id];
}
function hashPassword(pass) { const salt = crypto.randomBytes(16).toString("hex"); return { salt, hash: crypto.scryptSync(String(pass), salt, 32).toString("hex") }; }
function addUser(login, pass, accountId, role = "owner", name = "") {
  login = String(login).toLowerCase();
  if (!/^[a-z0-9._@-]+$/.test(login)) throw new Error("Логин: только латиница, цифры и . _ @ -");
  db.users[login] = { login, name, account: accountId, role, active: true, ...(pass.hash ? pass : hashPassword(pass)) };
  return db.users[login];
}

// секреты (пароль/ключ Вендисты) — AES-256-GCM
function enc(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const data = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
function dec(blob) {
  if (!blob) return "";
  const [iv, tag, data] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

// Первый запуск: создаём аккаунт и владельца из data/bootstrap.json (его пишет установщик) или из старых настроек .env.
(function bootstrap() {
  const bf = path.join(DATA_DIR, "bootstrap.json");
  let b = null;
  if (fs.existsSync(bf)) b = JSON.parse(fs.readFileSync(bf, "utf8"));
  else if (!Object.keys(db.accounts).length && (env.APP_USERS || env.VENDISTA_LOGIN)) {
    const [login, salt, hash] = (env.APP_USERS || "").split(",")[0].split(":");
    b = { account: "Основной", owner: login ? { login, salt, hash } : null, vendista: { login: env.VENDISTA_LOGIN, password: env.VENDISTA_PASSWORD } };
  }
  if (!b) return;
  const a = Object.values(db.accounts).find((x) => x.name === b.account) || newAccount(b.account || "Основной");
  if (b.owner && b.owner.login) addUser(b.owner.login, b.owner.hash ? { salt: b.owner.salt, hash: b.owner.hash } : b.owner.password, a.id, "owner", b.owner.name || "");
  if (b.vendista && (b.vendista.login || b.vendista.token))
    a.vendista = { login: b.vendista.login || "", password: enc(b.vendista.password), token: enc(b.vendista.token), updated: new Date().toISOString() };
  save();
  if (fs.existsSync(bf)) fs.unlinkSync(bf); // пароли больше не лежат открытым текстом
  console.log(`Создан аккаунт «${a.name}» (id ${a.id})`);
})();

/* ================= журнал ================= */
function audit(me, action, details = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), account: me && me.account, user: me && me.login, action, ...details }) + "\n";
  fs.appendFile(path.join(DATA_DIR, "audit.log"), line, () => {});
}

/* ================= вход ================= */
function checkPassword(login, pass) {
  const u = db.users[String(login || "").toLowerCase()];
  if (!u || !u.active) return null;
  const h = crypto.scryptSync(String(pass), u.salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash)) ? u : null;
}
function sign(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return body + "." + crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}
function unsign(tok) {
  if (!tok || !tok.includes(".")) return null;
  const [body, mac] = tok.split(".");
  const ok = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (mac.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(ok))) return null;
  const obj = JSON.parse(Buffer.from(body, "base64url").toString());
  return obj.exp < Date.now() ? null : obj;
}
// пользователь берётся из базы при каждом запросе: смена роли или отключение действуют сразу
function session(req) {
  const m = /(?:^|;\s*)vs=([^;]+)/.exec(req.headers.cookie || "");
  const s = m && unsign(decodeURIComponent(m[1]));
  const u = s && db.users[s.login];
  if (!u || !u.active || u.account !== s.account || !db.accounts[u.account]) return null;
  return u;
}
const fails = new Map();
const tooMany = (ip) => { const f = fails.get(ip); return f && f.n >= 8 && Date.now() - f.t < 15 * 60e3; };
function failed(ip) { const f = fails.get(ip) || { n: 0, t: 0 }; if (Date.now() - f.t > 15 * 60e3) f.n = 0; f.n++; f.t = Date.now(); fails.set(ip, f); }

/* ================= Вендиста: свой доступ у каждого аккаунта ================= */
const vTokens = new Map(); // accountId -> {token, at}
async function vendistaToken(acc, force) {
  const v = acc.vendista || {};
  if (v.token) return dec(v.token); // ключ API задан напрямую
  if (!v.login || !v.password) throw Object.assign(new Error("Вендиста не подключена: укажите доступ в Настройки → Аккаунт"), { code: 409 });
  const c = vTokens.get(acc.id);
  if (c && !force && Date.now() - c.at < 6 * 3600e3) return c.token;
  const r = await fetch(`${VENDISTA}/token?` + new URLSearchParams({ Login: v.login, Password: dec(v.password) }));
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw Object.assign(new Error("Вендиста не пустила: проверьте логин и пароль в Настройки → Аккаунт" + (j.error ? ` (${j.error})` : "")), { code: 502 });
  vTokens.set(acc.id, { token: j.token, at: Date.now() });
  return j.token;
}
async function vget(acc, p, params = {}, method = "GET") {
  if (method !== "GET" && !WRITE_MODE) throw new Error("Тестовый режим: изменения в Вендисте запрещены");
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await vendistaToken(acc, attempt > 0);
    const r = await fetch(`${VENDISTA}${p}?` + new URLSearchParams({ ...params, token }), { method, headers: { Accept: "application/json" } });
    if (r.status === 401 && attempt === 0 && !acc.vendista.token) continue;
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(`Вендиста: ${j.error || r.status}`);
    return j;
  }
}
async function vlist(acc, p, params) {
  const items = [];
  for (let page = 1; page < 200; page++) {
    const j = await vget(acc, p, { ...params, PageNumber: page, ItemsOnPage: 1000 });
    const arr = j.items || [];
    items.push(...arr);
    if (arr.length < 1000 || items.length >= (j.items_count || 0)) break;
  }
  return items;
}
const pad = (n) => String(n).padStart(2, "0");
function msk(d) { // Вендиста ждёт московское время без смещения
  const t = new Date(d.getTime() + 3 * 3600e3);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}
const toIso = (s) => (s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(" ", "T") + "+03:00" : s);

/* ================= кеш (отдельный для каждого аккаунта) ================= */
const cache = new Map();
async function cached(acc, key, ttl, fn) {
  const k = acc.id + "|" + key, c = cache.get(k);
  if (c && Date.now() - c.at < ttl) return c.val;
  const val = await fn();
  cache.set(k, { at: Date.now(), val });
  return val;
}
const dropCache = (acc) => { for (const k of cache.keys()) if (k.startsWith(acc.id + "|")) cache.delete(k); };

/* ================= данные Вендисты ================= */
async function machines(acc) {
  return cached(acc, "machines", 60e3, async () => {
    const [all, failedM, warnM, terms] = await Promise.all([
      vlist(acc, "/machines", {}),
      vlist(acc, "/machines", { ShowFailed: true, ShowWorking: false, ShowWarning: false }).catch(() => []),
      vlist(acc, "/machines", { ShowWarning: true, ShowWorking: false, ShowFailed: false }).catch(() => []),
      vlist(acc, "/terminals", {}).catch(() => []),
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
async function sales(acc, from, to) {
  const ttl = Date.now() - new Date(to) < 3600e3 ? 30e3 : 3600e3;
  return cached(acc, `sales|${from}|${to}`, ttl, async () =>
    (await vlist(acc, "/sales/list", { DateFrom: msk(new Date(from)), DateTo: msk(new Date(to)) })).map((s) => ({
      id: s.id, machine_id: s.machine_id, time: toIso(s.time), button: s.item_id, name: s.item_name || "",
      price: (s.item_price || 0) / 100, qty: s.quantity || 1, sell_type: s.sell_type, terminal_id: s.terminal_id,
    })));
}
async function transactions(acc, from, to) {
  const rows = await cached(acc, `tx|${from}|${to}`, 20e3, () => vlist(acc, "/transactions", { DateFrom: msk(new Date(from)), DateTo: msk(new Date(to)) }));
  return rows.map((t) => ({
    id: t.id, terminal_id: t.term_id, time: toIso(t.time), sum: (t.sum || 0) / 100, left: (t.left_sum || 0) / 100,
    status: t.status, result: t.result, card: t.card_number || "", reverse_id: t.reverse_id || 0,
    items: (t.machine_item || []).map((i) => ({ button: i.machine_item_id, qty: i.quantity, name: i.item_info || "" })),
  }));
}
// Формат ответов /encashment и /events в документации Вендисты не описан подробно — разбираем осторожно.
async function encashments(acc, from, to) {
  const rows = await cached(acc, `enc|${from}|${to}`, 300e3, () => vlist(acc, "/encashment", { DateFrom: msk(new Date(from)), DateTo: msk(new Date(to)) }));
  return rows.map((e) => ({ id: e.id, machine_id: e.machine_id, terminal_id: e.terminal_id || e.term_id, time: toIso(e.time || e.date),
    sum: (e.sum ?? e.cash_sum ?? e.total ?? 0) / 100 }));
}
async function events(acc, from, to) {
  const rows = await cached(acc, `ev|${from}|${to}`, 120e3, () => vlist(acc, "/events", { DateFrom: msk(new Date(from)), DateTo: msk(new Date(to)) }));
  return rows.map((e) => ({ id: e.id, machine_id: e.machine_id, terminal_id: e.terminal_id || e.term_id, time: toIso(e.time || e.date),
    level: e.level || "warn", text: e.event_type_name || e.description || e.text || e.name || "Событие" }));
}

/* ================= HTTP ================= */
function send(res, code, obj, headers = {}) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit = 2e6) {
  return new Promise((ok, bad) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > limit) { bad(Object.assign(new Error("Слишком большой запрос"), { code: 413 })); req.destroy(); } });
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
const bad = (msg, code = 400) => Object.assign(new Error(msg), { code });
// чековые настройки по умолчанию для всех товаров аккаунта
const FISCAL_DEFAULT = { vat: "none", subject: "commodity", tax_system: "usn_income_outcome" };
const VATS = ["none", "0", "5", "7", "10", "22"];
const SUBJECTS = ["commodity", "commodity_marked", "excise", "service"];
const TAX_SYSTEMS = ["osn", "usn_income", "usn_income_outcome", "esn", "patent"];
const accountView = (a) => ({
  id: a.id, name: a.name, fiscal: { ...FISCAL_DEFAULT, ...(a.fiscal || {}) },
  vendista: { login: a.vendista.login || "", password_set: !!a.vendista.password, token_set: !!a.vendista.token,
    configured: !!(a.vendista.token || (a.vendista.login && a.vendista.password)), updated: a.vendista.updated || null, checked: a.vendista.checked || null },
});
const meView = (u) => ({ login: u.login, name: u.name || "", role: u.role, role_title: (ROLES[u.role] || {}).title || u.role, perms: permsOf(u),
  account: { id: u.account, name: db.accounts[u.account].name }, test: !WRITE_MODE, refunds: ALLOW_REFUNDS && can(u, "refunds.create") });

// [метод, путь (RegExp), право или null, обработчик(req,res,me,acc,q,params)]
const R = [];
const route = (method, pattern, perm, fn) => R.push({ method, re: new RegExp("^" + pattern + "$"), perm, fn });
const OPEN = new Set(["POST /api/login", "POST /api/logout", "GET /api/health"]);

route("POST", "/api/login", null, async (req, res) => {
  const ip = ipOf(req);
  if (tooMany(ip)) return send(res, 429, { error: "Слишком много попыток. Подождите 15 минут." });
  const b = await readBody(req);
  const u = checkPassword(b.login, b.password);
  if (!u) { failed(ip); audit(null, "login_failed", { login: String(b.login || ""), ip }); return send(res, 401, { error: "Неверный логин или пароль" }); }
  const tok = sign({ login: u.login, account: u.account, exp: Date.now() + 90 * 864e5 });
  audit(u, "login", { ip });
  send(res, 200, { ok: true }, { "Set-Cookie": `vs=${encodeURIComponent(tok)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${90 * 86400}` });
});
route("POST", "/api/logout", null, async (req, res) => send(res, 200, { ok: true }, { "Set-Cookie": "vs=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" }));
route("GET", "/api/health", null, async (req, res) => send(res, 200, { ok: true }));
route("GET", "/api/me", null, async (req, res, me) => send(res, 200, meView(me)));

// аккаунт и доступ к Вендисте
route("GET", "/api/account", "account.manage", async (req, res, me, acc) => send(res, 200, accountView(acc)));
route("PUT", "/api/account", "account.manage", async (req, res, me, acc) => {
  const b = await readBody(req);
  if (b.name != null) { const n = String(b.name).trim(); if (!n) throw bad("Укажите название аккаунта"); acc.name = n.slice(0, 80); }
  if (b.fiscal) {
    const f = { ...FISCAL_DEFAULT, ...(acc.fiscal || {}) };
    if (b.fiscal.vat != null) { if (!VATS.includes(b.fiscal.vat)) throw bad("Неизвестная ставка НДС"); f.vat = b.fiscal.vat; }
    if (b.fiscal.subject != null) { if (!SUBJECTS.includes(b.fiscal.subject)) throw bad("Неизвестный предмет расчёта"); f.subject = b.fiscal.subject; }
    if (b.fiscal.tax_system != null) { if (!TAX_SYSTEMS.includes(b.fiscal.tax_system)) throw bad("Неизвестная система налогообложения"); f.tax_system = b.fiscal.tax_system; }
    acc.fiscal = f; audit(me, "fiscal_settings_changed", f);
  }
  if (b.vendista) { // секреты только записываются: пустое поле — оставить как было
    const v = b.vendista, cur = acc.vendista || {};
    const next = { ...cur, login: v.login != null ? String(v.login).trim() : cur.login };
    if (v.password) next.password = enc(v.password);
    if (v.token !== undefined) next.token = v.token ? enc(String(v.token).trim()) : null;
    if (v.clear_password) next.password = null;
    next.updated = new Date().toISOString(); next.checked = null;
    acc.vendista = next; vTokens.delete(acc.id); dropCache(acc);
    audit(me, "vendista_settings_changed", { login: next.login, token: !!next.token });
  }
  save(); send(res, 200, accountView(acc));
});
route("POST", "/api/account/vendista/check", "account.manage", async (req, res, me, acc) => {
  try { vTokens.delete(acc.id); await vlist(acc, "/terminals", {}); acc.vendista.checked = { ok: true, at: new Date().toISOString() }; save(); send(res, 200, { ok: true }); }
  catch (e) { acc.vendista.checked = { ok: false, at: new Date().toISOString(), error: e.message }; save(); send(res, 200, { ok: false, error: e.message }); }
});
route("GET", "/api/users", "users.manage", async (req, res, me, acc) =>
  send(res, 200, { users: Object.values(db.users).filter((u) => u.account === acc.id).map((u) => ({ login: u.login, name: u.name || "", role: u.role, role_title: (ROLES[u.role] || {}).title || u.role, active: u.active })),
    roles: Object.entries(ROLES).map(([id, r]) => ({ id, title: r.title, perms: r.perms.includes("*") ? Object.keys(PERMS) : r.perms })), perms: PERMS }));

// данные из Вендисты (только чтение)
route("GET", "/api/machines", "sales.view", async (req, res, me, acc) => send(res, 200, await machines(acc)));
route("GET", "/api/sales", "sales.view", async (req, res, me, acc, q) => { const [f, t] = range(q); send(res, 200, await sales(acc, f, t)); });
route("GET", "/api/transactions", "sales.view", async (req, res, me, acc, q) => { const [f, t] = range(q); send(res, 200, await transactions(acc, f, t)); });
route("GET", "/api/encashments", "reports.view", async (req, res, me, acc, q) => { const [f, t] = range(q); send(res, 200, await encashments(acc, f, t).catch(() => [])); });
route("GET", "/api/events", "machines.view", async (req, res, me, acc, q) => { const [f, t] = range(q); send(res, 200, await events(acc, f, t).catch(() => [])); });
route("POST", "/api/refund", "refunds.create", async (req, res, me, acc) => {
  if (!ALLOW_REFUNDS) return send(res, 403, { error: "Возвраты отключены: тестовый режим" });
  const b = await readBody(req);
  if (!b.id || b.confirm !== true) throw bad("Нет подтверждения возврата");
  audit(me, "refund_request", { id: b.id, sum: b.sum });
  try { const r = await vget(acc, `/transactions/${encodeURIComponent(b.id)}/cancel`, {}, "POST"); audit(me, "refund_ok", { id: b.id }); dropCache(acc); send(res, 200, { ok: true, result: r }); }
  catch (e) { audit(me, "refund_error", { id: b.id, error: e.message }); send(res, 502, { error: e.message }); }
});

// данные приложения, привязанные к аккаунту
const validProducts = (arr) => Array.isArray(arr) && arr.every((p) => p && Number.isInteger(p.id) && typeof p.name === "string" && ["item", "ingredient", "recipe"].includes(p.kind || "item")
  && (p.vat == null || VATS.includes(p.vat)) && (p.subject == null || SUBJECTS.includes(p.subject))
  && (p.gtin == null || p.gtin === "" || /^\d{8,14}$/.test(p.gtin)) && (p.barcode == null || p.barcode === "" || /^\d{6,14}$/.test(p.barcode)));
route("GET", "/api/products", "sales.view", async (req, res, me, acc) => send(res, 200, acc.products || []));
route("PUT", "/api/products", "catalog.edit", async (req, res, me, acc) => {
  const b = await readBody(req);
  if (!validProducts(b)) throw bad("Неверный список товаров");
  acc.products = b; save(); audit(me, "catalog_saved", { count: b.length }); send(res, 200, { ok: true });
});
route("GET", "/api/planograms", "machines.view", async (req, res, me, acc) => send(res, 200, acc.planograms || {}));
route("PUT", "/api/planograms/(\\d+)", "planograms.edit", async (req, res, me, acc, q, [mid]) => {
  const ms = await machines(acc).catch(() => null);
  if (ms && !ms.some((m) => String(m.id) === mid)) throw bad("Такого автомата нет в вашем аккаунте", 404);
  const b = await readBody(req);
  if (!b || typeof b.cells !== "object" || !["snack", "coffee"].includes(b.kind)) throw bad("Неверная планограмма");
  acc.planograms[mid] = { kind: b.kind, cells: b.cells, hoppers: b.hoppers || undefined, updated: new Date().toISOString(), by: me.login };
  save(); audit(me, "planogram_saved", { machine: mid }); send(res, 200, { ok: true });
});
route("GET", "/api/loadings", "machines.view", async (req, res, me, acc) => send(res, 200, acc.loadings || []));
route("POST", "/api/loadings", "loadings.create", async (req, res, me, acc) => {
  const b = await readBody(req);
  if (!b.machine_id || typeof b.cells !== "object") throw bad("Неверная загрузка");
  const l = { id: "L" + nextId(), machine_id: b.machine_id, cells: b.cells, note: String(b.note || "").slice(0, 200), time: new Date().toISOString(), user: me.login };
  acc.loadings.push(l); if (acc.loadings.length > 20000) acc.loadings.splice(0, acc.loadings.length - 20000);
  save(); audit(me, "loading", { machine: b.machine_id }); send(res, 200, { ok: true, id: l.id });
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let hit = null, params = [];
  for (const r of R) { if (r.method !== req.method) continue; const m = r.re.exec(url.pathname); if (m) { hit = r; params = m.slice(1); break; } }
  if (!hit) return send(res, 404, { error: "Нет такого адреса" });
  const open = OPEN.has(`${req.method} ${url.pathname}`);
  const me = open ? null : session(req);
  if (!open && !me) return send(res, 401, { error: "Нужно войти" });
  if (req.method !== "GET" && req.headers.origin && env.DOMAIN && req.headers.origin !== `https://${env.DOMAIN}`)
    return send(res, 403, { error: "Запрос с чужого сайта" });
  if (hit.perm && !can(me, hit.perm)) return send(res, 403, { error: "Нет прав: " + (PERMS[hit.perm] || hit.perm) });
  try { await hit.fn(req, res, me, me ? account(me.account) : null, url.searchParams, params); }
  catch (e) { console.error(req.method, url.pathname, e.message); send(res, e.code || 502, { error: e.message }); }
}).listen(PORT, () => console.log("Вендинг: сервер на порту " + PORT + (WRITE_MODE ? " (изменения в Вендисте РАЗРЕШЕНЫ)" : " (тестовый режим: Вендиста только чтение)")));

