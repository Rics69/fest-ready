/** Публичный адрес сайта: для metadataBase, ссылок в письмах и redirect-URL оплаты. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "FestReady";

/**
 * Почта поддержки: reply-to писем, возвраты, «Сообщить об ошибке».
 * Заполнитель на зарезервированном домене .example — заменить, когда появится домен.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@festready.example";
