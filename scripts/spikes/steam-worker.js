/**
 * Спайк C с IP Cloudflare: те же запросы к Steam, но из воркера на сети Cloudflare.
 * Запуск (нужен `npx wrangler login`): npm run spike:steam:cf, затем открыть http://localhost:8787
 * `wrangler dev --remote` выполняет код на Cloudflare, ничего не публикуя.
 *
 * Первый прогон 12.11.2026: appdetails с IP Cloudflare — 403 на все запросы, GetItems — 200.
 * Здесь проверяем, зависит ли 403 от заголовков, и отвечает ли страница магазина.
 */
const GAMES = [1145360, 367520, 413150, 504230, 105600, 1794680, 2379780, 646570, 1313140, 1562430];
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const VARIANTS = {
  noHeaders: {},
  browserUA: { "User-Agent": BROWSER_UA },
  browserUAandLang: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", Accept: "application/json" },
};

async function probe(url, headers) {
  const started = Date.now();
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { status: res.status, ms: Date.now() - started, bytes: text.length, server: res.headers.get("server") };
}

const worker = {
  async fetch() {
    const appdetails = {};
    for (const [name, headers] of Object.entries(VARIANTS)) {
      const results = [];
      for (const appId of GAMES.slice(0, 5)) {
        results.push(
          await probe(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`, headers),
        );
      }
      appdetails[name] = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
    }
    const storePage = await probe("https://store.steampowered.com/app/1145360/?l=english", VARIANTS.browserUA);

    const input = {
      ids: GAMES.map((appid) => ({ appid })),
      context: { language: "english", country_code: "US" },
      data_request: { include_assets: true, include_tag_count: 20 },
    };
    const getItems = await probe(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
      {},
    );
    return Response.json({ appdetails, storePage, getItems });
  },
};

export default worker;
