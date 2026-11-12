import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * База D1 из биндинга `DB` (wrangler.jsonc).
 * Работает в Route Handlers и серверных компонентах — и на Workers, и в `next dev`
 * (там биндинги подключает initOpenNextCloudflareForDev из next.config.ts).
 */
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

/** Текущее время в формате, в котором храним даты в D1. */
export function nowIso(): string {
  return new Date().toISOString();
}
