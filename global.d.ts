import type { routing } from "@/i18n/routing";
import type messages from "./messages/en.json";

// Типизация next-intl: ключи переводов и языки проверяются компилятором.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
