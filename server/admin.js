// Администрирование: добавить новый аккаунт с владельцем.
// Запуск на сервере:  cd /opt/vending && docker compose exec app node admin.js add-account
// После этого:        docker compose restart app   (сервер подхватит новый аккаунт при запуске)
"use strict";
const fs = require("fs"), path = require("path"), readline = require("readline");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((ok) => rl.question(q, (a) => ok(a.trim())));
(async () => {
  const cmd = process.argv[2];
  if (cmd === "list") {
    const db = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "db.json"), "utf8"));
    Object.values(db.accounts).forEach((a) => console.log(`${a.id}  ${a.name}  — пользователи: ${Object.values(db.users).filter((u) => u.account === a.id).map((u) => u.login + " (" + u.role + ")").join(", ")}`));
  } else if (cmd === "add-account") {
    const account = await ask("Название аккаунта: ");
    const login = await ask("Логин владельца (латиницей): ");
    const password = await ask("Пароль владельца: ");
    const vl = await ask("Логин Вендисты (можно пусто, указать потом в приложении): ");
    const vp = vl ? await ask("Пароль Вендисты: ") : "";
    fs.writeFileSync(path.join(DATA_DIR, "bootstrap.json"), JSON.stringify({ account, owner: { login, password }, vendista: { login: vl, password: vp } }), { mode: 0o600 });
    console.log("Готово. Перезапустите сервер: docker compose restart app");
  } else console.log("Команды: list | add-account");
  rl.close();
})();
