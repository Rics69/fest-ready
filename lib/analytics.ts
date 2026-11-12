/**
 * События воронки → /api/events → таблица events в D1. Только в браузере.
 * Без cookie и без идентификаторов человека: имя события, язык, источник перехода (?ref=) и пара свойств.
 * order_paid сюда не входит — его пишет сервер по колбэку кассы.
 */

export const EVENT_NAMES = [
  "capsule_test",
  "shelf_view",
  "kit_open",
  "kit_ready",
  "forecast_start",
  "page_check",
  "buy_click",
  "studio_waitlist",
  "reminder_optin",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export type EventProps = Record<string, string | number | boolean>;

const REF_KEY = "fr_ref";
const REF_RE = /^[a-z0-9_-]{1,32}$/;
/** Источник первого визита живёт 30 дней: оплата может случиться через неделю после поста. */
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Запоминаем ?ref=reddit при первом визите (первый источник не перезаписываем, пока не истёк). */
export function rememberRef(search: string = location.search): void {
  const ref = new URLSearchParams(search).get("ref")?.toLowerCase();
  if (!ref || !REF_RE.test(ref)) return;
  try {
    if (currentRef()) return;
    localStorage.setItem(REF_KEY, JSON.stringify({ ref, at: Date.now() }));
  } catch {
    // Приватный режим или запрет хранилища — просто без источника.
  }
}

export function currentRef(): string | null {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const { ref, at } = JSON.parse(raw) as { ref?: string; at?: number };
    if (!ref || !REF_RE.test(ref) || typeof at !== "number" || Date.now() - at > REF_TTL_MS) return null;
    return ref;
  } catch {
    return null;
  }
}

export function track(name: EventName, props?: EventProps): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ name, locale: document.documentElement.lang, ref: currentRef(), props });
  try {
    const sent = navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }));
    if (sent) return;
  } catch {
    // sendBeacon недоступен — пробуем fetch.
  }
  void fetch("/api/events", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}
