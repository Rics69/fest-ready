-- FestReady: начальная схема D1 (SQLite).
-- Даты храним строками ISO 8601 в UTC: "2026-11-12T12:00:00.000Z".
-- Изображения пользователя сюда не попадают никогда — только выбор вариантов и числа анкеты.

-- Заказы. sku: kit | forecast | launch.
CREATE TABLE orders (
  id          TEXT PRIMARY KEY,
  sku         TEXT NOT NULL,
  payment_id  TEXT UNIQUE,
  status      TEXT NOT NULL,          -- created | paid | canceled | expired | refunded | chargeback
  email       TEXT NOT NULL,
  locale      TEXT NOT NULL,          -- ru | en
  amount      TEXT NOT NULL,          -- "2990.00" | "39.00"
  currency    TEXT NOT NULL,          -- RUB | EUR
  kit_choices TEXT,                   -- JSON: выбранные варианты компоновки, без изображений
  ref         TEXT,                   -- источник первого визита: reddit | x | dtf | tg | ...
  consent_at  TEXT,                   -- согласие с условиями и на немедленное исполнение (ЕС)
  created_at  TEXT NOT NULL,
  paid_at     TEXT
);
CREATE INDEX idx_orders_email ON orders (email);

-- Прогнозы. result — JSON с тремя сценариями и множителями; считает только сервер после оплаты.
CREATE TABLE forecasts (
  id                TEXT PRIMARY KEY,
  order_id          TEXT REFERENCES orders(id),
  app_id            TEXT NOT NULL,
  fest              TEXT NOT NULL,    -- 2027-02 | 2027-06
  inputs            TEXT NOT NULL,    -- JSON анкеты
  result            TEXT,
  recalcs_left      INTEGER NOT NULL DEFAULT 2,
  actual_wishlists  INTEGER,          -- ответ после фестиваля
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_forecasts_order ON forecasts (order_id);

-- Журнал колбэков RollyPay. Первичный ключ даёт идемпотентность:
-- повтор того же (payment_id, status) ничего не делает.
CREATE TABLE payment_events (
  payment_id  TEXT NOT NULL,
  status      TEXT NOT NULL,
  received_at TEXT NOT NULL,
  raw         TEXT NOT NULL,
  PRIMARY KEY (payment_id, status)
);

-- Кэш публичных данных Steam (appdetails + теги) на сутки.
CREATE TABLE steam_cache (
  app_id      TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  fetched_at  TEXT NOT NULL
);

-- Отложенные письма. Все отправляет ежедневный cron; отмена при возврате — обновление строки.
CREATE TABLE reminders (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  locale      TEXT NOT NULL,
  kind        TEXT NOT NULL,          -- registration_week | items_week | recalc_7d | fest_results
  order_id    TEXT REFERENCES orders(id),
  send_at     TEXT NOT NULL,
  resend_id   TEXT,
  status      TEXT NOT NULL           -- pending | sent | canceled
);
CREATE INDEX idx_reminders_due ON reminders (status, send_at);
CREATE INDEX idx_reminders_order ON reminders (order_id);

-- События воронки: capsule_test, shelf_view, kit_open, kit_ready, forecast_start, page_check,
-- buy_click, order_paid, studio_waitlist, reminder_optin.
CREATE TABLE events (
  name    TEXT NOT NULL,
  locale  TEXT NOT NULL,
  ref     TEXT,
  props   TEXT,                       -- JSON, без личных данных
  ts      TEXT NOT NULL
);
CREATE INDEX idx_events_name_ts ON events (name, ts);

-- «Сообщить о запуске»: Studio и платные продукты, пока касса выключена.
CREATE TABLE waitlist (
  email   TEXT NOT NULL,
  locale  TEXT NOT NULL,
  product TEXT NOT NULL,              -- studio | kit | forecast | launch
  ts      TEXT NOT NULL
);
