import calendar from "@/data/fest-calendar.json";

export type Fest = (typeof calendar.fests)[number];

/** Ближайший фестиваль, регистрация на который ещё открыта. */
export function nextOpenFest(now: Date = new Date()): Fest | null {
  return calendar.fests.find((fest) => fest.registrationCloses && endOfDay(fest.registrationCloses) > now) ?? null;
}

/**
 * Сколько полных и неполных дней осталось до конца дня дедлайна (по местному времени браузера).
 * 0 — дедлайн сегодня, отрицательное — прошёл.
 */
export function daysUntil(date: string, now: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endOfDay(date).getTime() - now.getTime()) / msPerDay) - 1;
}

/** Конец дня YYYY-MM-DD в часовом поясе среды выполнения. */
function endOfDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
