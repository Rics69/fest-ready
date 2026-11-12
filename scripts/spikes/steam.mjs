/**
 * Спайк C: как Steam отвечает на наши запросы.
 *   1. 20 запросов подряд к appdetails — есть ли 429 и сколько времени занимает ответ
 *   2. IStoreBrowseService/GetItems — ассеты с точными адресами и теги пачкой, одним запросом
 *   3. Теги со страницы игры (HTML) — для сравнения с API
 *   4. Игра 18+ — что отдают страница и API без cookie возрастной проверки
 *   5. CDN капсул — отдаёт ли CORS-заголовки (можно ли читать пиксели в canvas)
 * Заодно скачивает малые капсулы 462×174 для спайка B в fixtures/capsules/ (в git не попадает).
 *
 * Запуск: npm run spike:steam. С этой машины — это IP провайдера, а не Cloudflare:
 * проверку с IP Workers делаем после деплоя (см. docs/decisions.md).
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SPIKE_GAMES } from "./capsules.mjs";

const OUT = join(process.cwd(), "scripts/spikes/out");
const FIXTURES = join(process.cwd(), "fixtures/capsules");
mkdirSync(OUT, { recursive: true });
mkdirSync(FIXTURES, { recursive: true });
for (const f of readdirSync(FIXTURES)) rmSync(join(FIXTURES, f));

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const CDN = "https://shared.akamai.steamstatic.com/store_item_assets/";
const MATURE = { appId: 1091500, name: "Cyberpunk 2077" };
const report = {
  at: new Date().toISOString(),
  appdetails: [],
  getItems: {},
  htmlTags: [],
  mature: {},
  cors: {},
  capsules: [],
};

async function timed(url, init = {}) {
  const started = performance.now();
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...init.headers } });
  return { res, ms: Math.round(performance.now() - started) };
}

// 1. appdetails: 10 игр × 2 языка = 20 запросов подряд, без пауз.
for (const lang of ["english", "russian"]) {
  for (const game of SPIKE_GAMES) {
    const { res, ms } = await timed(
      `https://store.steampowered.com/api/appdetails?appids=${game.appId}&cc=us&l=${lang}`,
    );
    const ok = res.ok && Boolean((await res.json())?.[game.appId]?.data);
    report.appdetails.push({ appId: game.appId, lang, status: res.status, ok, ms });
  }
}

// 2. GetItems: все игры одним запросом — ассеты (с хешами в путях) и id тегов по весу.
const tagNames = new Map(
  (await (await fetch("https://store.steampowered.com/tagdata/populartags/english")).json()).map((t) => [
    t.tagid,
    t.name,
  ]),
);
const input = {
  ids: [...SPIKE_GAMES, MATURE].map((g) => ({ appid: g.appId })),
  context: { language: "english", country_code: "US" },
  data_request: { include_assets: true, include_tag_count: 20, include_basic_info: true },
};
const { res: itemsRes, ms: itemsMs } = await timed(
  `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
);
const items = new Map(((await itemsRes.json())?.response?.store_items ?? []).map((it) => [it.appid, it]));
report.getItems = { status: itemsRes.status, ms: itemsMs, returned: items.size, requested: input.ids.length };

const assetUrl = (item, key) =>
  item?.assets?.[key] ? CDN + item.assets.asset_url_format.replace("${FILENAME}", item.assets[key]) : null;
const apiTags = (item) => (item?.tagids ?? []).map((id) => tagNames.get(id) ?? `#${id}`);

// 3. Теги со страницы игры — совпадают ли с API.
const tagRe = /class="app_tag"[^>]*>\s*([^<]+?)\s*</g;
for (const game of SPIKE_GAMES.slice(0, 3)) {
  const { res, ms } = await timed(`https://store.steampowered.com/app/${game.appId}/?l=english`);
  const html = await res.text();
  const tags = [...html.matchAll(tagRe)].map((m) => m[1].trim()).filter((t) => t !== "+");
  const fromApi = apiTags(items.get(game.appId));
  report.htmlTags.push({
    appId: game.appId,
    status: res.status,
    ms,
    count: tags.length,
    sameFirst5AsApi: tags.slice(0, 5).join() === fromApi.slice(0, 5).join(),
  });
}

// 4. Игра 18+: страница магазина без cookie и API.
{
  const { res } = await timed(`https://store.steampowered.com/app/${MATURE.appId}/?l=english`);
  const html = await res.text();
  report.mature = {
    pageStatus: res.status,
    pageTitle: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    pageTags: [...html.matchAll(tagRe)].length,
    apiTags: apiTags(items.get(MATURE.appId)).length,
    apiSmallCapsule2x: Boolean(assetUrl(items.get(MATURE.appId), "small_capsule_2x")),
  };
}

// 5. Самая крупная малая капсула по точному адресу из API + проверка CORS.
//    Новые ассеты: small_capsule_2x (462×174, путь с хешем). Старые игры его не отдают —
//    у них крупнейшая версия в устаревшем capsule_467x181.jpg рядом с small_capsule (без хеша).
for (const game of SPIKE_GAMES) {
  const item = items.get(game.appId);
  const url2x = assetUrl(item, "small_capsule_2x");
  const small = assetUrl(item, "small_capsule");
  const url =
    url2x ??
    (small && !/\/[0-9a-f]{40}\//.test(small)
      ? small.replace(/capsule_231x87[^/?]*\.jpg/, "capsule_467x181.jpg")
      : null);
  if (!url) {
    report.capsules.push({ appId: game.appId, status: "no large small capsule" });
    continue;
  }
  const res = await fetch(url, { headers: { "User-Agent": UA, Origin: "https://festready.example" } });
  if (!report.cors.url) report.cors = { url, allowOrigin: res.headers.get("access-control-allow-origin") };
  if (res.ok) writeFileSync(join(FIXTURES, `${game.appId}-small_2x.jpg`), Buffer.from(await res.arrayBuffer()));
  report.capsules.push({
    appId: game.appId,
    status: res.status,
    source: url2x ? "small_capsule_2x" : "legacy capsule_467x181",
    hashedPath: /\/[0-9a-f]{40}\//.test(url),
  });
}

writeFileSync(join(OUT, "steam.json"), JSON.stringify(report, null, 2));

const statuses = report.appdetails.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
const avg = Math.round(report.appdetails.reduce((s, r) => s + r.ms, 0) / report.appdetails.length);
console.log("1. appdetails, 20 подряд:", statuses, `в среднем ${avg} мс`);
console.log("2. GetItems одним запросом:", report.getItems);
console.log("3. теги со страницы:", report.htmlTags);
console.log("4. игра 18+:", report.mature);
console.log("5. CORS CDN:", report.cors);
const got = report.capsules.filter((c) => c.status === 200);
console.log(
  `   малые капсулы: ${got.length} из ${SPIKE_GAMES.length}; 462×174 из API: ${got.filter((c) => c.source === "small_capsule_2x").length}, устаревшие 467×181: ${got.filter((c) => c.source !== "small_capsule_2x").length}`,
);
