# 🏛️ Fullstack Template
Template для Fullstack приложений на базе FastAPI + React.js

## 💫 Стек технологий
Backend:
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- asyncpg

Frontend:
- React
- Vite
- React Router

## Локальный запуск

1. На Linux-сервере установите Docker Engine с Compose plugin, скопируйте шаблон окружения и задайте уникальные `DB_PASSWORD` и `JWT_SECURITY_KEY` (не менее 32 символов для ключа):

   ```bash
   cp .env.example .env
   chmod 600 .env
   # заполнить секреты; ENVIRONMENT=development — только для тестового сервера
   bash infra/dev-up.sh
   ```

   Python и Node.js на хосте устанавливать не нужно. PostgreSQL доступен только внутри Compose; миграции выполняются backend entrypoint перед запуском API.
2. Создайте первого администратора внутри backend-контейнера: `docker compose exec backend python -m core.admin create --email admin@example.com --name Administrator`. Команда запросит пароль в скрытом вводе.
3. Откройте frontend на `http://localhost:3000`. Браузер ходит к `/api` на том же origin; Vite проксирует запросы в режиме разработки, а nginx в Compose перенаправляет их к backend.

Для изолированной демонстрационной базы примените миграции, затем запустите seed вручную только в отдельном development/test окружении. Seed создаёт только отсутствующие тестовые записи и не меняет существующие. Введите пароль в скрытом приглашении команды:

```bash
docker compose exec backend python -m core.demo_seed
```

Seed создаёт аккаунты `demo.platform@example.com`, `demo.uk@example.com`, `demo.resident@example.com` и `demo.technician@example.com`. Пароль задаётся оператором и не хранится в репозитории. Не запускайте seed для production-базы.

Для показа demo-платежа включите `BILLING_DEMO_PAYMENTS_ENABLED=true` только в отдельном development/test окружении. Backend независимо запрещает demo-платежи и импорт реестра в production.

Для HTTPS за reverse proxy задайте `JWT_COOKIE_SECURE=true`. CLI разработчика запускается на хосте через `uv run ft`; `ft module`, `ft db`, `ft doctor`, `ft test` и `ft dev` доступны из корня проекта.

### Видеокамеры (development)

Compose запускает MediaMTX с Control API и метриками на loopback хоста. HLS выдаётся через backend-прокси: каждый запрос playlist и сегмента проверяет media session, а порт MediaMTX HLS не публикуется на хост. Для четырёх тестовых камер на Linux-сервере нужны `docker`, `docker compose`, `curl`, `python3`, `flock` и FFmpeg (`ffmpeg`).

Из корня репозитория запустите команды на отдельном development/test сервере:

```bash
# Seed добавит 4 камеры и другие demo-данные только в development/test окружении.
# Команда запросит пароль скрыто.
docker compose exec backend python -m core.demo_seed

# Публикует demo/camera-001 ... demo/camera-004 в MediaMTX.
bash infra/camera-simulator.sh quad
bash infra/camera-simulator.sh status

# Проверить, что MediaMTX принял все 4 источника.
curl -fsS http://127.0.0.1:9997/v3/paths/list | python3 -c 'import json,sys; paths=json.load(sys.stdin)["items"]; ready=[p["name"] for p in paths if p.get("ready") and p["name"].startswith("demo/camera-")]; print("Ready cameras:", len(ready), *ready, sep="\n"); sys.exit(0 if len(ready) >= 4 else 1)'

# Метрики за 30 секунд; команда не запускает клиентов.
bash infra/measure-camera-load.sh --duration 30

# Остановить только процессы, запущенные симулятором.
bash infra/camera-simulator.sh stop
```

`core.demo_seed` создаёт четыре включённые камеры в базе с потоками `demo/camera-001`…`demo/camera-004`, а RTSP-симулятор публикует видео по тем же адресам. Seed создаёт также demo-аккаунты и другие тестовые данные, поэтому не запускайте его на production. Войдите в мобильное приложение demo-жителем, чтобы открыть камеры. Для клиента задайте публичный HTTPS URL API; HLS загружается через API-прокси. Для теста в локальной сети задайте `BACKEND_BIND_HOST=0.0.0.0` и `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP-сервера>:8000`.

Профиль `load50` запускает 50 CPU-кодируемых потоков и может перегрузить тестовый сервер. Симулятор хранит PID/URL процессов и останавливает только проверенные процессы; логи находятся в `/tmp/yakutsk-home-camera-simulator-<uid>`. `infra/measure-camera-load.sh` показывает ready publishers, MediaMTX readers/HLS sessions, трафик, CPU и память контейнера. Для standalone MediaMTX используйте `infra/mediamtx.yml`, настроенный на loopback. Не используйте demo-конфигурацию как production RTSP ingress.

PowerShell-версии `infra/dev-up.ps1`, `infra/camera-simulator.ps1`, `infra/measure-camera-load.ps1` и `reset-demo-resident-password.ps1` оставлены для Windows. На Linux используйте `.sh`-версии; `bash reset-demo-resident-password.sh` меняет пароль только существующего demo-жителя в development и проверяет вход.

На Windows, если FFmpeg не установлен, одну низкоресурсную тестовую камеру можно поднять отдельным контейнером (остановка — `Ctrl+C`):

```powershell
docker run --rm --name hackathon-case1-ffmpeg-single --network hackathon-case1_default jrottenberg/ffmpeg:7.1-ubuntu -hide_banner -loglevel warning -re -f lavfi -i "testsrc=size=320x180:rate=8" -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -threads 1 -g 8 -keyint_min 8 -sc_threshold 0 -f rtsp -rtsp_transport tcp rtsp://mediamtx:8554/demo/camera-001
```

Для ручной проверки с телефона на Linux откройте терминал в папке mobile, задайте LAN URL backend и запустите Expo; приложение должно войти, открыть camera-001, получить session и загрузить HLS через backend:

```bash
cd apps/mobile
export EXPO_PUBLIC_API_BASE_URL="http://<LAN-IP-сервера>:8000"
npx expo start --lan
```

## Production

Разворачивайте Compose за reverse proxy с HTTPS. В `.env` задайте `ENVIRONMENT=production`, уникальные случайные `DB_PASSWORD`, `JWT_SECURITY_KEY` и отдельный `MEDIA_JWT_SECRET` (например, `openssl rand -hex 32`), `DEBUG=false`, `JWT_COOKIE_SECURE=true` и точный публичный origin в `CORS_ORIGINS` (например, `https://example.com`). Backend выдаёт медиасессию только через HTTPS origin API; MediaMTX HLS остаётся во внутренней сети, а все HLS-запросы проверяются API. Порты frontend и backend привязаны к loopback по умолчанию; настройте reverse proxy на frontend. База данных не публикует порт.

## 👩‍💻 Добавление новых модулей
Через CLI добавьте новый модуль
