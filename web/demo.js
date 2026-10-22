// ДЕМО-ДАННЫЕ. Подменяют сервер: отдают то же самое, что /api/* на настоящем сервере
// (формат продаж, транзакций и автоматов как в API Вендисты). Цифры выдуманные.
// Используется только в прототипе; на сервере этот файл не подключается.
(() => {
  const MACHINES = [
    [1, "Депо maestro", "Concerto", "Депо ТЧ-21", "coffee", 30],
    [2, "TCN-CSC-10G", "CSC-10G", "Депо ТЧ-21", "tcn", 26],
    [3, "Поликлиника", "Opera", "Поликлиника", "coffee", 34],
    [4, "Поликлиника TOGO", "Opera", "Поликлиника", "coffee", 22],
    [5, "СНЕК Поликлиника", "CSC-10G", "Поликлиника", "tcn", 19],
    [6, "Kikko Max ToGo 250 мл.", "Kikko Max To Go", "Ленгипротранс", "coffee", 27],
    [7, "NECTA OPERA", "Opera", "Ленгипротранс", "coffee", 31],
    [8, "Fas1050", "Scudo 1050", "Ленгипротранс", "snack", 17],
    [9, "Maestro", "Opera", "Ленгипротранс", "coffee", 9],
    [10, "Kikko RY", "Kikko ES6", "Ленгипротранс", "coffee", 26],
    [11, "Депо ТЧ-21 КОФЕ 230 мл.", "Kikko Max", "ПТОЛ", "coffee", 24],
    [12, "ПТОЛ Лужская", "Kikko Max", "ПТОЛ", "coffee", 14],
    [13, "Kikko ES6 RZD MED", "Kikko ES6", "РЖД медицина", "coffee", 18],
    [14, "Concerto LB", "Concerto", "УЦПК", "coffee", 21],
  ].map(([id, name, model, division, kind, base]) => ({ id, name, model, division, kind, base, terminal_id: 7700 + id }));

  // кнопка, название, цена, вес (как часто берут)
  const COFFEE = [[1, "Эспрессо", 90, 6], [2, "Американо", 110, 18], [3, "Капучино", 140, 26], [4, "Латте", 150, 18],
    [5, "Раф ванильный", 170, 8], [6, "Горячий шоколад", 130, 9], [7, "Чай чёрный", 70, 7], [8, "Флэт уайт", 160, 5], [9, "Мокачино", 150, 6]];
  // как в планограмме TCN: номер ячейки = номер кнопки
  const TCN = [[1, "Сухарики Фишка", 50, 3], [3, "Сухарики Фишка", 50, 3], [5, "Круассан 7 Days", 80, 4], [7, "Вафли венские", 80, 3], [9, "Вафли венские", 80, 3],
    [11, "M&M's арахис", 110, 3], [12, "M&M's молочный", 110, 3], [13, "M&M's солёный арахис", 110, 2], [14, "Арахис Rioba", 70, 2], [15, "Арахис Rioba", 70, 2], [16, "Арахис Rioba", 70, 2],
    [17, "Choco Pie", 35, 3], [18, "Choco Pie", 35, 3], [19, "Choco Pie", 35, 3], [20, "Choco Pie", 35, 3],
    [21, "Snickers Супер", 115, 6], [22, "Snickers лесной орех", 115, 4], [23, "Mars Max", 115, 4], [24, "Bounty", 95, 3], [25, "Отломи", 45, 2], [26, "Крокант", 40, 1],
    [27, "Twix Экстра", 115, 4], [28, "Nuts Duo", 110, 3], [29, "Пряник тульский", 70, 2], [30, "Пряник тульский", 70, 2],
    [31, "Babyfox", 75, 2], [32, "Даёжъ", 45, 2], [33, "Даёжъ", 45, 2], [34, "Даёжъ", 45, 2], [35, "Чудо сливочное", 55, 2],
    [36, "Twix Экстра", 115, 3], [37, "Twix Экстра", 115, 3], [38, "Picnic", 100, 2], [39, "Пряник тульский", 70, 2], [40, "Пряник тульский", 70, 2],
    [41, "Рич чай персик 0,5", 115, 3], [42, "Рич чай персик 0,5", 115, 3], [43, "Рич чай персик 0,5", 115, 2], [44, "Рич манго 0,5", 115, 2], [45, "Рич манго 0,5", 115, 2], [46, "Рич манго 0,5", 115, 2],
    [47, "Вода газ 0,5", 55, 3], [48, "Вода газ 0,5", 55, 3], [49, "Вода 0,5", 55, 4], [50, "Вода 0,5", 55, 4],
    [51, "Добрый Кола 0,5", 110, 4], [52, "Добрый Кола 0,5", 110, 4], [53, "Добрый Кола 0,5", 110, 3], [54, "Добрый Кола 0,5", 110, 3],
    [55, "Кола без сахара 0,5", 110, 2], [56, "Кола без сахара 0,5", 110, 2], [57, "Кола без сахара 0,5", 110, 2], [58, "Кола без сахара 0,5", 110, 2], [59, "Вода 0,5", 55, 3], [60, "Вода 0,5", 55, 3]];
  const SNACK = [[11, "Snickers", 100, 8], [12, "Twix", 100, 6], [13, "Kinder Bueno", 120, 5], [21, "Lay's сметана", 120, 6], [22, "Pringles", 180, 3],
    [31, "Вода 0,5", 55, 9], [32, "Кола 0,5", 110, 8], [33, "Red Bull", 190, 4], [41, "Сок яблоко", 90, 4]];
  const MENU = { coffee: COFFEE, tcn: TCN, snack: SNACK };
  // вместимость ячеек TCN — как в реальной планограмме
  const TCN_CAP = { 1: 11, 3: 11, 5: 7, 7: 7, 9: 7, 11: 13, 12: 13, 13: 13, 14: 7, 15: 7, 16: 7, 17: 15, 18: 15, 19: 15, 20: 15, 21: 15, 22: 14, 23: 14, 24: 15, 25: 10, 26: 10, 27: 15, 28: 14, 29: 11, 30: 11,
    31: 10, 32: 15, 33: 15, 34: 15, 35: 12, 36: 16, 37: 16, 38: 13, 39: 13, 40: 13 };
  const COST = (name, price, kind) => Math.round(price * (kind === "coffee" ? .3 : .55));

  /* ----- демо-хранилище (на сервере будет база) ----- */
  const ST = { get(k, d) { try { const v = JSON.parse(localStorage.getItem("demo." + k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("demo." + k, JSON.stringify(v)); } catch (e) {} } };
  // ингредиенты кофейных: покупаем упаковкой, себестоимость считается за 1 г / мл / шт
  const INGR = [["Кофе зерно", "г", 1000, 1500], ["Молоко сухое", "г", 1000, 650], ["Шоколад", "г", 1000, 720], ["Сахар", "г", 1000, 95],
    ["Чай чёрный листовой", "г", 250, 320], ["Сироп ваниль", "мл", 1000, 640], ["Вода", "мл", 19000, 260],
    ["Стакан 250 мл", "шт", 1000, 2300], ["Крышка", "шт", 1000, 950], ["Размешиватель", "шт", 1000, 320]];
  const RECIPES = { "Эспрессо": [["Кофе зерно", 8], ["Вода", 40], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Американо": [["Кофе зерно", 9], ["Вода", 180], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Капучино": [["Кофе зерно", 9], ["Молоко сухое", 12], ["Вода", 170], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Латте": [["Кофе зерно", 9], ["Молоко сухое", 16], ["Вода", 180], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Раф ванильный": [["Кофе зерно", 9], ["Молоко сухое", 18], ["Сироп ваниль", 15], ["Вода", 170], ["Стакан 250 мл", 1], ["Крышка", 1], ["Размешиватель", 1]],
    "Горячий шоколад": [["Шоколад", 25], ["Молоко сухое", 6], ["Вода", 180], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Чай чёрный": [["Чай чёрный листовой", 2], ["Вода", 200], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Флэт уайт": [["Кофе зерно", 16], ["Молоко сухое", 10], ["Вода", 150], ["Стакан 250 мл", 1], ["Размешиватель", 1]],
    "Мокачино": [["Кофе зерно", 8], ["Шоколад", 12], ["Молоко сухое", 10], ["Вода", 180], ["Стакан 250 мл", 1], ["Размешиватель", 1]] };
  function defaultProducts() {
    const out = [], add = (o) => { o.id = out.length + 1; out.push(o); return o; };
    const ing = new Map(INGR.map(([name, unit, pack_size, pack_price]) => [name, add({ name, kind: "ingredient", unit, pack_size, pack_price })]));
    const seen = new Set();
    [["tcn", TCN], ["snack", SNACK]].forEach(([kind, list]) => list.forEach(([, name, price]) => {
      if (!seen.has(name)) { seen.add(name); const marked = /вода|кола|рич|сок|red bull|бонаква/i.test(name);
        add({ name, kind: "item", cost: COST(name, price, kind), ...(marked ? { subject: "commodity_marked", gtin: "0460" + String(1000000000 + out.length * 7919).slice(0, 10) } : {}) }); } }));
    COFFEE.forEach(([, name]) => add({ name, kind: "recipe", components: (RECIPES[name] || []).map(([n, qty]) => ({ iid: ing.get(n).id, qty })) }));
    return out;
  }
  function products() { return ST.get("products3", null) || defaultProducts(); }
  function defaultPlanogram(m) {
    const byName = new Map(products().map((p) => [p.name, p.id])), cells = {};
    MENU[m.kind].forEach(([btn, name]) => { cells[btn] = { pid: byName.get(name), cap: m.kind === "coffee" ? null : (m.kind === "tcn" ? (TCN_CAP[btn] || 6) : 9) }; });
    if (m.kind !== "coffee") return { kind: "snack", cells };
    return { kind: "coffee", cells, hoppers: defaultHoppers(cells) };
  }
  // вместимость бункеров/запаса кофейного автомата по ингредиентам
  const HOP = { "Кофе зерно": 2000, "Молоко сухое": 1500, "Шоколад": 1500, "Сахар": 1500, "Чай чёрный листовой": 300, "Сироп ваниль": 1000,
    /* вода из водопровода — запас не считаем */ "Стакан 250 мл": 400, "Крышка": 200, "Размешиватель": 500 };
  function defaultHoppers(cells) {
    const ps = products(), byId = new Map(ps.map((p) => [p.id, p])), out = {};
    Object.values(cells).forEach((c) => ((byId.get(c.pid) || {}).components || []).forEach((x) => { const i = byId.get(x.iid); if (i && HOP[i.name]) out[i.id] = HOP[i.name]; }));
    return out;
  }
  function planograms() { const saved = ST.get("planograms", {}); const out = {};
    MACHINES.forEach((m) => { const p = saved[m.id] || defaultPlanogram(m); if (p.kind === "coffee" && !p.hoppers) p.hoppers = defaultHoppers(p.cells); out[m.id] = p; });
    return out; }
  function loadings() {
    const saved = ST.get("loadings2", null); if (saved) return saved;
    const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(7, 30, 0, 0);
    const pl = planograms(), out = [];
    MACHINES.filter((m) => m.kind === "coffee").forEach((m) => { const t = new Date(d.getTime() - (m.id % 3) * 864e5), cells = {};
      Object.entries(pl[m.id].hoppers || {}).forEach(([iid, cap]) => cells["i" + iid] = cap);
      out.push({ id: "LC" + m.id, machine_id: m.id, time: t.toISOString(), cells, note: "Полная загрузка", user: "demo" }); });
    MACHINES.filter((m) => m.kind !== "coffee").forEach((m) => { const cells = {}; Object.entries(pl[m.id].cells).forEach(([b, c]) => cells[b] = c.cap); out.push({ id: "L" + m.id, machine_id: m.id, time: d.toISOString(), cells, note: "Полная загрузка", user: "demo" }); });
    return out;
  }

  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const HOURW = [0, 0, 0, 0, 0, .2, 1, 3, 5, 4, 3, 3, 5, 5, 3, 3, 4, 4, 3, 2, 1.5, 1, .4, .1];
  const pick = (r, arr) => { const tot = arr.reduce((a, x) => a + x[3], 0); let x = r() * tot; for (const it of arr) { x -= it[3]; if (x <= 0) return it; } return arr[arr.length - 1]; };
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const OFFLINE = 11; // у этого автомата «пропала связь» 3 часа назад

  const dayCache = new Map();
  function daySales(m, d) { // продажи одного автомата за один день
    const key = m.id + "|" + d.toDateString();
    if (dayCache.has(key)) return dayCache.get(key);
    const r = rng(hash(key)), wd = d.getDay(), f = wd === 0 || wd === 6 ? .55 : 1;
    const n = Math.round(m.base * f * (.75 + r() * .5)), out = [];
    for (let i = 0; i < n; i++) {
      let h = 0, x = r() * HOURW.reduce((a, b) => a + b, 0); for (; h < 23; h++) { x -= HOURW[h]; if (x <= 0) break; }
      const t = new Date(d.getTime() + h * 36e5 + Math.floor(r() * 36e5));
      const p = pick(r, MENU[m.kind]);
      const cash = r() < .07;
      out.push({ id: hash(key + i), machine_id: m.id, terminal_id: m.terminal_id, time: t.toISOString(), button: String(p[0]), name: p[1], price: p[2], qty: 1, sell_type: cash ? 1 : 2, card: cash ? null : "2200****" + String(1000 + Math.floor(r() * 9000)) });
    }
    dayCache.set(key, out);
    return out;
  }
  function salesBetween(from, to) {
    const now = new Date(), cut = (m) => (m.id === OFFLINE ? new Date(now.getTime() - 3 * 36e5) : now);
    const out = [];
    for (let d = day0(from); d <= to; d = new Date(d.getTime() + 864e5)) {
      MACHINES.forEach((m) => daySales(m, day0(d)).forEach((s) => { const t = new Date(s.time); if (t >= from && t <= to && t <= cut(m)) out.push(s); }));
    }
    return out;
  }
  let refunded = new Set();
  try { refunded = new Set(JSON.parse(localStorage.getItem("demo.refunded") || "[]")); } catch (e) {}

  window.DEMO_API = async (path, params, opt = {}) => {
    await new Promise((r) => setTimeout(r, 150)); // как будто сеть
    const now = new Date();
    if (path === "/me") { const a = ST.get("account", { name: "Мой вендинг" });
      return { login: "demo", name: "Демо", role: "owner", role_title: "Владелец", perms: ["*"], account: { id: "1", name: a.name }, demo: true, test: false, refunds: true }; }
    if (path === "/account") {
      const a = ST.get("account", { name: "Мой вендинг", vendista: { login: "", password_set: false, token_set: false } });
      if (opt.method === "PUT") { const b = opt.body, v = a.vendista || {};
        if (b.name) a.name = b.name;
        if (b.fiscal) a.fiscal = { ...(a.fiscal || {}), ...b.fiscal };
        if (b.vendista) { v.login = b.vendista.login ?? v.login; if (b.vendista.password) v.password_set = true; if (b.vendista.token !== undefined) v.token_set = !!b.vendista.token; v.updated = new Date().toISOString(); v.checked = null; }
        a.vendista = v; ST.set("account", a); }
      const v = a.vendista || {};
      return { id: "1", name: a.name, fiscal: { vat: "none", subject: "commodity", tax_system: "usn_income_outcome", ...(a.fiscal || {}) }, vendista: { ...v, configured: !!(v.token_set || (v.login && v.password_set)) } };
    }
    if (path === "/account/vendista/check") return { ok: false, error: "Демо-режим: настоящая Вендиста не подключается. На сервере здесь будет реальная проверка." };
    if (path === "/users") return { users: [{ login: "demo", name: "Демо", role: "owner", role_title: "Владелец", active: true }],
      roles: [{ id: "owner", title: "Владелец", perms: ["*"] }], perms: {} };
    if (path === "/machines") return MACHINES.map((m) => {
      const s = salesBetween(day0(now), now), mine = s.filter((x) => x.machine_id === m.id), last = mine[mine.length - 1];
      return { id: m.id, name: m.name, model: m.model, address: "", division: m.division, number: "", terminal_id: m.terminal_id,
        last_sale: last ? last.time : null, last_online: (m.id === OFFLINE ? new Date(now - 3 * 36e5) : new Date(now - 60e3)).toISOString(),
        state: m.id === 9 ? "warning" : "ok", daily_sum: mine.reduce((a, x) => a + x.price, 0), daily_count: mine.length };
    });
    const from = new Date(params?.from || now - 864e5), to = new Date(params?.to || now);
    if (path === "/sales") return salesBetween(from, to).map(({ card, ...s }) => s);
    if (path === "/transactions") return salesBetween(from, to).filter((s) => s.sell_type === 2).map((s) => ({
      id: s.id, terminal_id: s.terminal_id, time: s.time, sum: s.price, left: refunded.has(s.id) ? 0 : s.price,
      status: refunded.has(s.id) ? 2 : 1, result: 1, card: s.card, reverse_id: refunded.has(s.id) ? 1 : 0,
      items: [{ button: +s.button, qty: 1, name: s.name }] }));
    if (path === "/refund") {
      refunded.add(opt.body.id);
      try { localStorage.setItem("demo.refunded", JSON.stringify([...refunded])); } catch (e) {}
      return { ok: true };
    }
    if (path === "/products") { if (opt.method === "PUT") { ST.set("products3", opt.body); return { ok: true }; } return products(); }
    if (path === "/planograms") return planograms();
    if (path.startsWith("/planograms/") && opt.method === "PUT") { const all = ST.get("planograms", {}); all[path.split("/")[2]] = opt.body; ST.set("planograms", all); return { ok: true }; }
    if (path === "/loadings") {
      if (opt.method === "POST") { const l = loadings(); l.push({ id: "L" + Date.now(), user: "demo", time: new Date().toISOString(), ...opt.body }); ST.set("loadings2", l); return { ok: true }; }
      return loadings();
    }
    if (path === "/encashments") {
      const out = []; MACHINES.forEach((m, i) => { for (let k = (i % 6) + 1; k < 30; k += 7) { const t = new Date(day0(now).getTime() - k * 864e5 + (10 + i % 5) * 36e5);
        if (t < from || t > to) continue; const cash = salesBetween(new Date(t.getTime() - 7 * 864e5), t).filter((s) => s.machine_id === m.id && s.sell_type === 1).reduce((a, s) => a + s.price, 0);
        out.push({ id: m.id * 1000 + k, machine_id: m.id, time: t.toISOString(), sum: cash, user: "demo" }); } });
      return out.sort((a, b) => new Date(b.time) - new Date(a.time));
    }
    if (path === "/events") {
      const ev = [{ machine_id: OFFLINE, time: new Date(now - 3 * 36e5).toISOString(), level: "bad", text: "Терминал не на связи" },
        { machine_id: 9, time: new Date(now - 5 * 36e5).toISOString(), level: "warn", text: "Ошибка купюроприёмника" },
        { machine_id: 9, time: new Date(now - 26 * 36e5).toISOString(), level: "ok", text: "Перезагрузка терминала" },
        { machine_id: 2, time: new Date(now - 50 * 36e5).toISOString(), level: "ok", text: "Открыта дверь (обслуживание)" }];
      return ev.filter((e) => new Date(e.time) >= from && new Date(e.time) <= to);
    }
    if (path === "/logout" || path === "/login") return { ok: true };
    throw new Error("Нет такого адреса: " + path);
  };
})();
