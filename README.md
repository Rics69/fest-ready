# FestReady

Капсула Steam, которая читается в поиске, и прогноз вишлистов — до дедлайна Next Fest.

План по фазам — [docs/ROADMAP.md](docs/ROADMAP.md), решения и итоги спайков — [docs/decisions.md](docs/decisions.md).

## Стек

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · next-intl (`/ru`, `/en`) · Cloudflare Workers через OpenNext · D1 · Vitest.

## Быстрый старт

```bash
npm install
cp .env.example .env.development.local   # переменные и флаги только для разработки (не .env.local — его читает и прод-сборка)
cp .dev.vars.example .dev.vars    # секреты воркера (пока пусто)
npm run db:migrate:local          # локальная база D1 в .wrangler/
npm run dev                       # http://localhost:3000
```

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Дев-сервер Next.js с биндингами Cloudflare (D1) |
| `npm run check` | Линт + типы + тесты — перед каждым коммитом |
| `npm run preview` | Сборка под Cloudflare и запуск в локальном workerd — ближе всего к продакшну |
| `npm run cf:size` | Сборка и размер воркера (лимит бесплатного тарифа — 3 МБ в gzip) |
| `npm run deploy` | Сборка и деплой вручную (обычно деплоит Workers Builds) |
| `npm run cf:build` | Сборка OpenNext + статические `/`, `/ru`, `/en` мимо воркера (`scripts/static-pages.mjs`) |
| `npm run cf-typegen` | Пересоздать `cloudflare-env.d.ts` после правки `wrangler.jsonc` |
| `npm run db:migrate:local` / `db:migrate:remote` | Миграции D1 локально / на проде |
| `npm run spike:steam` | Спайк C: запросы к Steam, качает капсулы в `fixtures/capsules/` |
| `npm run spike:ocr` | Спайк B: распознавание названия на капсулах в разных размерах |
| `npm run spike:steam:cf` | Спайк C с IP Cloudflare (`wrangler dev --remote`, нужен вход) |

## Флаги

Задаются переменными сборки в `.env.local` и в настройках сборки Cloudflare (`lib/flags.ts`). Не заданы — в разработке включены, в продакшне выключены.

| Переменная | Значения |
| --- | --- |
| `NEXT_PUBLIC_PAYMENTS_MODE` | `mock` — тестовая касса, `rollypay` — настоящая, `off` — лист ожидания |
| `NEXT_PUBLIC_FORECAST` | `on` / `off` — платный прогноз |
| `NEXT_PUBLIC_KIT_EXPORT` | `on` / `off` — экспорт набора в полном разрешении |

## Деплой

Деплоит Cloudflare Workers Builds из GitHub: прод — из `main`, превью — из остальных веток. GitHub Actions только проверяет код (`.github/workflows/ci.yml`).

Первая настройка:

1. ~~`npx wrangler login`~~, ~~база D1 `fest-ready`~~ (WEUR, миграция применена), ~~первый деплой~~ — сделано 12.11.2026, сайт: https://fest-ready.fest-ready.workers.dev
2. Ручной деплой с этой машины: `NEXT_PUBLIC_SITE_URL=https://fest-ready.fest-ready.workers.dev npm run deploy` (флаги в продакшн-сборке по умолчанию выключены)
3. Дашборд Cloudflare → Workers & Pages → Create → Import a repository → `Rics69/fest-ready`. Имя воркера — `fest-ready`, как в `wrangler.jsonc`.
   - Build command: `npm run cf:build` (сборка OpenNext + `scripts/static-pages.mjs`, который отдаёт лендинг статикой мимо воркера)
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Non-production branch deploy command: `npx opennextjs-cloudflare upload`
   - Build variables: `NEXT_PUBLIC_SITE_URL=https://fest-ready.fest-ready.workers.dev`, `NEXT_PUBLIC_PAYMENTS_MODE=off`, `NEXT_PUBLIC_FORECAST=off`, `NEXT_PUBLIC_KIT_EXPORT=off`
4. Секреты (с фазы 5): `npx wrangler secret put ИМЯ`

## Структура

```text
app/[locale]/        страницы на двух языках
components/          шапка, подвал, блоки лендинга
i18n/                маршрутизация и загрузка переводов next-intl
messages/{ru,en}.json  все тексты интерфейса
data/                конфиг ассетов Steam, календарь Next Fest
lib/                 флаги, база, календарь; позже — capsule-engine и forecast-engine
db/migrations/       SQL-миграции D1
scripts/spikes/      спайки фазы 0
tests/               тесты, не привязанные к одному модулю
docs/                роадмап, решения, промпты демо-арта, исходные документы
```
