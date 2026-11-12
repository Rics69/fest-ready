import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// ISR и ревалидация не нужны: лендинг статический, оплаченные поездки читаются из D1 на каждый запрос.
// Поэтому предрендеренные страницы отдаём из статических ассетов Workers, без R2.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
