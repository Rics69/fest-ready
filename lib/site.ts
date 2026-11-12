/** Публичный адрес сайта: для metadataBase, ссылок в письмах и redirect-URL оплаты. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "FestReady";

/**
 * Почта поддержки: reply-to писем, возвраты, «Сообщить об ошибке».
 * Заполнитель на зарезервированном домене .example — заменить, когда появится домен.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@festready.example";

/**
 * Cloudflare Web Analytics (сайт fest-ready.fest-ready.workers.dev). Токен не секретный — он и так в коде каждой страницы.
 * Счётчик грузится только на адресе из SITE_URL, чтобы локальные запуски не попадали в статистику.
 * Появится свой домен — заведите для него сайт в Web Analytics и поменяйте токен (или задайте NEXT_PUBLIC_CF_BEACON_TOKEN).
 */
export const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN || "99852204e8d440b98fcd38b7bf2f4e76";
