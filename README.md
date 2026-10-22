# Вендинг

Мобильное приложение для вендингового бизнеса: продажи, автоматы, группы, транзакции с возвратом.
Данные берутся из API Вендисты через собственный сервер.

- `web/` — само приложение (одна страница, ставится на телефон как приложение)
- `server/` — сервер: вход, запросы к Вендисте, журнал действий (`data/audit.log`)
- `deploy/` — установка (`install.sh`), автообновление (`update.sh`), HTTPS (Caddy)

Установка на сервер с Ubuntu и Docker:

```
curl -fsSL https://raw.githubusercontent.com/ipdaegorov-code/vending/main/deploy/install.sh -o install.sh && bash install.sh
```

Логины и пароли хранятся только на сервере в `/opt/vending/.env`, в репозитории их нет.
