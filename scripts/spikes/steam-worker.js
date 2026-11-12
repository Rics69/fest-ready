/**
 * Спайк C с IP Cloudflare: те же запросы к Steam, но из воркера на сети Cloudflare.
 * Запуск (нужен `npx wrangler login`): npm run spike:steam:cf, затем открыть http://localhost:8787
 * `wrangler dev --remote` выполняет код на Cloudflare, ничего не публикуя.
 */
const GAMES = [1145360, 367520, 413150, 504230, 105600, 1794680, 2379780, 646570, 1313140, 1562430];

export default {
  async fetch() {
    const results = [];
    for (const lang of ["english", "russian"]) {
      for (const appId of GAMES) {
        const started = Date.now();
        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=${lang}`);
        await res.arrayBuffer();
        results.push({ appId, lang, status: res.status, ms: Date.now() - started });
      }
    }
    const input = {
      ids: GAMES.map((appid) => ({ appid })),
      context: { language: "english", country_code: "US" },
      data_request: { include_assets: true, include_tag_count: 20 },
    };
    const started = Date.now();
    const items = await fetch(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
    );
    const body = await items.json();
    const statuses = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
    return Response.json({
      appdetails: { statuses, avgMs: Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length) },
      getItems: { status: items.status, ms: Date.now() - started, returned: body?.response?.store_items?.length ?? 0 },
      results,
    });
  },
};
