"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { daysUntil, nextOpenFest } from "@/lib/fest-calendar";

const MINUTE = 60_000;

// Часы браузера как внешний источник: значение меняется раз в минуту, так что таймер сам перейдёт через полночь.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
}
const currentMinute = () => Math.floor(Date.now() / MINUTE);
const noMinuteOnServer = () => null;

/**
 * Дни до закрытия регистрации на ближайший Next Fest — по часам и часовому поясу посетителя.
 * Страница статическая, поэтому число считается только в браузере: до этого держим место пустой плашкой.
 */
export function Countdown() {
  const t = useTranslations("countdown");
  const locale = useLocale();
  const minute = useSyncExternalStore(subscribe, currentMinute, noMinuteOnServer);
  const now = minute === null ? null : new Date(minute * MINUTE);

  const shell = "inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 text-sm";

  if (!now) return <span aria-hidden className={`${shell} w-72 max-w-full`} />;

  const fest = nextOpenFest(now);
  if (!fest?.registrationCloses) return <span className={`${shell} text-muted`}>{t("closed")}</span>;

  const days = daysUntil(fest.registrationCloses, now);
  const name = fest.name[locale === "ru" ? "ru" : "en"];

  return (
    <span className={shell}>
      <span aria-hidden className="mr-2.5 size-1.5 rounded-full bg-accent" />
      {days === 0 ? t("today", { fest: name }) : t("days", { count: days, fest: name })}
    </span>
  );
}
