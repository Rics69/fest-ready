import { EVENT_NAMES, type EventName } from "./analytics";

/** Событие после проверки — то, что пишем в D1. */
export type StoredEvent = {
  name: EventName;
  locale: "ru" | "en";
  ref: string | null;
  props: string | null;
};

const MAX_PROPS = 10;
const MAX_VALUE = 64;

/**
 * Разбор тела /api/events. null — мусор, такое не пишем.
 * Ограничения держат таблицу маленькой: известные имена, до 10 свойств, строки до 64 символов.
 */
export function parseEvent(raw: unknown): StoredEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;

  if (typeof body.name !== "string" || !(EVENT_NAMES as readonly string[]).includes(body.name)) return null;
  const locale = body.locale === "ru" ? "ru" : "en";
  const ref = typeof body.ref === "string" && /^[a-z0-9_-]{1,32}$/.test(body.ref) ? body.ref : null;

  let props: string | null = null;
  if (body.props && typeof body.props === "object" && !Array.isArray(body.props)) {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(body.props as Record<string, unknown>).slice(0, MAX_PROPS)) {
      if (!/^[a-zA-Z_]{1,32}$/.test(key)) continue;
      if (typeof value === "string") clean[key] = value.slice(0, MAX_VALUE);
      else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
      else if (typeof value === "boolean") clean[key] = value;
    }
    if (Object.keys(clean).length) props = JSON.stringify(clean);
  }

  return { name: body.name as EventName, locale, ref, props };
}
