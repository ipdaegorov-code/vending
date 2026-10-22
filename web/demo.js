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
    if (path === "/me") return { login: "demo", role: "owner", demo: true, test: false, refunds: true };
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
    if (path === "/logout" || path === "/login") return { ok: true };
    throw new Error("Нет такого адреса: " + path);
  };
})();
