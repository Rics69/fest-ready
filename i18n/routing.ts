import { defineRouting } from "next-intl/routing";

/**
 * Два трека — две версии контента: /ru — СНГ (рубли, СБП), /en — остальной мир (евро).
 * Адрес без префикса подбирает язык по браузеру (Accept-Language), выбор запоминается в cookie.
 */
export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
