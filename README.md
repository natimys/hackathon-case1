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

1. Скопируйте шаблон окружения и задайте уникальные `DB_PASSWORD` и `JWT_SECURITY_KEY` (не менее 32 символов для ключа):

   ```bash
   cp .env.example .env
   # заполнить необходимые переменные
   .\infra\dev-up.ps1
   ```

   Python и Node.js на хосте устанавливать не нужно. PostgreSQL доступен только внутри Compose; миграции выполняются backend entrypoint перед запуском API.
2. Создайте первого администратора внутри backend-контейнера: `docker compose exec backend python -m core.admin create --email admin@example.com --name Administrator`. Команда запросит пароль в скрытом вводе.
3. Откройте frontend на `http://localhost:3000`. Браузер ходит к `/api` на том же origin; Vite проксирует запросы в режиме разработки, а nginx в Compose перенаправляет их к backend.

Для безопасной демонстрационной базы примените миграции, затем запустите seed вручную только в отдельном development/test окружении. Команда создаёт только отсутствующие тестовые записи и не меняет существующие. В PowerShell из корня репозитория:

```powershell
$env:ENVIRONMENT = "development"
$env:DEMO_SEED_PASSWORD = Read-Host "Пароль для новых demo-аккаунтов"
docker compose exec -e ENVIRONMENT=development -e DEMO_SEED_PASSWORD=$env:DEMO_SEED_PASSWORD backend python -m core.demo_seed
```

Seed создаёт аккаунты `demo.platform@example.com`, `demo.uk@example.com`, `demo.resident@example.com` и `demo.technician@example.com`. Пароль задаётся оператором и не хранится в репозитории. Не запускайте seed для production-базы.

Для показа demo-платежа включите `BILLING_DEMO_PAYMENTS_ENABLED=true` только в отдельном development/test окружении. Backend независимо запрещает demo-платежи и импорт реестра в production.

Для HTTPS за reverse proxy задайте `JWT_COOKIE_SECURE=true`. CLI разработчика запускается на хосте через `uv run ft`; `ft module`, `ft db`, `ft doctor`, `ft test` и `ft dev` доступны из корня проекта.

### Видеокамеры (development)

Compose запускает MediaMTX с Control API и метриками на loopback хоста. HLS выдаётся через backend-прокси: каждый запрос playlist и сегмента проверяет media session, а порт MediaMTX HLS не публикуется на хост. Для показа на физическом устройстве задайте `BACKEND_BIND_HOST=0.0.0.0`, `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP-компьютера>:8000`, отдельный случайный `MEDIA_JWT_SECRET` в `.env`, примените миграции и выполните development seed. Для локальной генерации потока установите FFmpeg или используйте подготовленный FFmpeg container.

Из корня репозитория запустите `.\infra\camera-simulator.ps1 single` для одной трансляции или `.\infra\camera-simulator.ps1 quad` для четырёх. `load50` явно запускает 50 CPU-кодируемых тестовых источников и может перегрузить компьютер; `status` показывает только процессы симулятора, `stop` завершает только проверенные по PID и RTSP URL процессы. `.\infra\measure-camera-load.ps1 -DurationSeconds 30 -Mode compose` снимает фактические ready publishers, MediaMTX readers/HLS sessions, счётчики трафика и доступные CPU/RAM показатели; он не запускает клиентов. После старта проверьте фактический статус камеры в API/мобильном приложении. Для standalone MediaMTX используйте `.\infra\mediamtx.yml`; он слушает RTSP и Control API только на loopback. Не используйте эти demo-настройки как production ingress для RTSP.

Если FFmpeg не установлен на Windows, одну низкоресурсную тестовую камеру можно поднять отдельным контейнером (остановка — `Ctrl+C`):

```powershell
docker run --rm --name hackathon-case1-ffmpeg-single --network hackathon-case1_default jrottenberg/ffmpeg:7.1-ubuntu -hide_banner -loglevel warning -re -f lavfi -i "testsrc=size=320x180:rate=8" -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -threads 1 -g 8 -keyint_min 8 -sc_threshold 0 -f rtsp -rtsp_transport tcp rtsp://mediamtx:8554/demo/camera-001
```

Для ручной проверки с телефона откройте отдельный PowerShell в папке mobile, задайте LAN URL backend и запустите Expo; приложение должно войти, открыть camera-001, получить session и загрузить HLS через backend:

```powershell
Set-Location apps/mobile
$env:EXPO_PUBLIC_API_BASE_URL = "http://<LAN-IP-компьютера>:8000"
npx expo start --lan
```

## Production

Разворачивайте Compose за reverse proxy с HTTPS. В `.env` задайте `ENVIRONMENT=production`, уникальные случайные `DB_PASSWORD`, `JWT_SECURITY_KEY` и отдельный `MEDIA_JWT_SECRET` (например, `openssl rand -hex 32`), `DEBUG=false`, `JWT_COOKIE_SECURE=true` и точный публичный origin в `CORS_ORIGINS` (например, `https://example.com`). Backend выдаёт медиасессию только через HTTPS origin API; MediaMTX HLS остаётся во внутренней сети, а все HLS-запросы проверяются API. Порты frontend и backend привязаны к loopback по умолчанию; настройте reverse proxy на frontend. База данных не публикует порт.

## 👩‍💻 Добавление новых модулей
Через CLI добавьте новый модуль
