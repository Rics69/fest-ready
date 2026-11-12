"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const LABELS: Record<Locale, { short: string; name: string }> = {
  ru: { short: "RU", name: "Русский" },
  en: { short: "EN", name: "English" },
};

export function LocaleSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  const t = useTranslations("header");

  return (
    <nav aria-label={t("language")} className="flex rounded-lg border border-border bg-surface p-0.5">
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            lang={locale}
            title={LABELS[locale].name}
            aria-current={active ? "true" : undefined}
            className={
              "press flex h-10 min-w-11 items-center justify-center rounded-md px-2 font-mono text-xs font-medium " +
              (active ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground")
            }
          >
            {LABELS[locale].short}
          </Link>
        );
      })}
    </nav>
  );
}
