/**
 * Точка входа воркера Cloudflare. Сейчас только отдаёт запросы Next.js (сборка OpenNext).
 * В фазе 5 здесь появится scheduled() — ежедневный cron для отложенных писем.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — файл появляется после `npm run cf:build`
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
} satisfies ExportedHandler<CloudflareEnv>;
