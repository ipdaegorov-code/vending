#!/usr/bin/env bash
# Установка приложения «Вендинг» на сервер (Ubuntu + Docker).
# Запуск:  bash install.sh
# Повторный запуск безопасен: можно поменять пароли и логины.
set -euo pipefail

REPO="https://github.com/ipdaegorov-code/vending.git"
DIR="/opt/vending"

say()  { printf '\n\033[1;34m%s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✘ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || fail "Запустите от root"
command -v docker >/dev/null || fail "Нет Docker"
docker compose version >/dev/null 2>&1 || { say "Ставлю docker compose…"; apt-get update -qq && apt-get install -y -qq docker-compose-v2 >/dev/null || apt-get install -y -qq docker-compose-plugin >/dev/null; }
command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git >/dev/null; }

say "1. Загружаю приложение"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q; else git clone -q "$REPO" "$DIR"; fi
ok "Код в $DIR"
cd "$DIR"
mkdir -p data

IP=$(curl -s -4 -m 10 https://ifconfig.me || hostname -I | awk '{print $1}')
DOMAIN="${IP//./-}.sslip.io"

ask() { local p="$1" v; read -r -p "$p: " v </dev/tty; printf '%s' "$v"; }
asks() { local p="$1" v; read -r -s -p "$p (символы не видны): " v </dev/tty; echo >&2; printf '%s' "$v"; }

say "2. Вход в приложение (придумайте логин и пароль для себя)"
while :; do APP_LOGIN=$(ask "Логин (латиницей, без пробелов)"); [[ "$APP_LOGIN" =~ ^[A-Za-z0-9._@-]+$ ]] && break; echo "Только латинские буквы, цифры и . _ @ -"; done
while :; do
  P1=$(asks "Пароль"); P2=$(asks "Пароль ещё раз")
  [ "$P1" = "$P2" ] && [ ${#P1} -ge 6 ] && break
  echo "Пароли не совпали или короче 6 символов, ещё раз."
done
SALT=$(openssl rand -hex 16)
HASH=$(docker run --rm -e P="$P1" -e S="$SALT" node:22-alpine node -e 'process.stdout.write(require("crypto").scryptSync(process.env.P,process.env.S,32).toString("hex"))')
unset P1 P2

say "3. Доступ к Вендисте (логин и пароль от портала Вендисты)"
while :; do
  VL=$(ask "Логин Вендисты"); VP=$(asks "Пароль Вендисты")
  case "$VL$VP" in *"'"*) echo "Логин или пароль с апострофом ' пока не поддерживается, напишите Claude."; continue ;; esac
  CODE=$(curl -s -m 20 -o /tmp/vt.json -w '%{http_code}' -G "https://api.vendista.ru:99/token" --data-urlencode "Login=$VL" --data-urlencode "Password=$VP" || true)
  if grep -q '"token"' /tmp/vt.json 2>/dev/null && ! grep -q '"token":null' /tmp/vt.json; then rm -f /tmp/vt.json; ok "Вендиста приняла логин"; break; fi
  rm -f /tmp/vt.json; echo "Вендиста не пустила (код $CODE). Проверьте логин и пароль."
done

say "4. Режим работы"
echo "Сервер ставится в ТЕСТОВОМ режиме: только чтение данных из Вендисты."
echo "Возвраты и любые изменения в Вендисте заблокированы, пока вы сами их не включите."
umask 077
cat > .env <<EOF
DOMAIN=$DOMAIN
APP_USERS='$APP_LOGIN:$SALT:$HASH:owner'
SESSION_SECRET=$(openssl rand -hex 32)
VENDISTA_LOGIN='$VL'
VENDISTA_PASSWORD='$VP'
WRITE_MODE=off
ALLOW_REFUNDS=0
EOF
chmod 600 .env
unset VP
ok "Настройки сохранены в $DIR/.env (доступны только root)"

say "5. Запускаю"
docker compose up -d --build
ok "Запущено"

say "6. Автообновление"
cat > /etc/systemd/system/vending-update.service <<EOF
[Unit]
Description=Vending app auto-update
[Service]
Type=oneshot
ExecStart=/bin/bash $DIR/deploy/update.sh
EOF
cat > /etc/systemd/system/vending-update.timer <<EOF
[Unit]
Description=Vending app auto-update every 2 minutes
[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now vending-update.timer >/dev/null
ok "Обновления подтягиваются сами каждые 2 минуты"

say "Готово! Откройте на телефоне:  https://$DOMAIN"
echo "Первый запуск HTTPS-сертификата может занять до минуты."
