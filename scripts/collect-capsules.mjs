/**
 * Собирает капсулы чужих игр для разметки и калибровки: fixtures/unlabeled/<appId>.jpg + index.json.
 * Только локально — в git не попадает, наружу не публикуется.
 *
 * Откуда: поиск Steam (новинки, «Скоро выйдет», популярные будущие, ранний доступ, скидки),
 * точные адреса капсул — из IStoreBrowseService/GetItems (у файлов хеши в путях, docs/decisions.md).
 * Новые игры дают самодельные капсулы (нечитаемые, неконтрастные), ранний доступ и скидки — капсулы с текстом.
 *
 * Запуск: npm run capsules:collect [-- --limit 160]. Повторный запуск докачивает новое, размеченное не трогает.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "fixtures/unlabeled");
const MANUAL = join(ROOT, "fixtures/manual");
const INDEX = join(OUT, "index.json");
mkdirSync(OUT, { recursive: true });

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : 160;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const CDN = "https://shared.akamai.steamstatic.com/store_item_assets/";
/** Капсулы из спайков — уже в fixtures/capsules. */
const SKIP = new Set([1145360, 367520, 413150, 504230, 105600, 1794680, 2379780, 646570, 1313140, 1562430]);

const SOURCES = [
  { name: "new", query: "sort_by=Released_DESC&category1=998", start: 0, count: 60 },
  { name: "new-older", query: "sort_by=Released_DESC&category1=998", start: 300, count: 40 },
  { name: "coming-soon", query: "filter=comingsoon", start: 0, count: 50 },
  { name: "popular-upcoming", query: "filter=popularcomingsoon", start: 0, count: 30 },
  { name: "early-access", query: "tags=493&category1=998", start: 40, count: 40 },
  { name: "specials", query: "specials=1&category1=998", start: 0, count: 40 },
];

async function search({ query, start, count }) {
  const url = `https://store.steampowered.com/search/results/?query&start=${start}&count=${count}&infinite=1&cc=us&l=english&${query}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = await res.json();
  return [...json.results_html.matchAll(/data-ds-appid="(\d+)"/g)].map((m) => Number(m[1]));
}

async function getItems(ids) {
  const input = {
    ids: ids.map((appid) => ({ appid })),
    context: { language: "english", country_code: "US" },
    data_request: { include_assets: true, include_release: true },
  };
  const res = await fetch(
    `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
    { headers: { "User-Agent": UA } },
  );
  if (!res.ok) throw new Error(`GetItems ${res.status}`);
  return (await res.json())?.response?.store_items ?? [];
}

const hashed = (path) => /\/[0-9a-f]{40}\//.test(path);

/** Самая крупная малая капсула: 462×174 из API или устаревшая 467×181 рядом со старой 231×87. */
function capsuleUrl(item) {
  const a = item.assets;
  if (!a) return null;
  const url = (file) => CDN + a.asset_url_format.replace("${FILENAME}", file);
  if (a.small_capsule_2x)
    return { url: url(a.small_capsule_2x), legacy: false, override: a.small_capsule_2x.includes("alt_assets") };
  if (a.small_capsule && !hashed(url(a.small_capsule))) {
    return {
      url: url(a.small_capsule).replace(/capsule_231x87[^/?]*\.jpg/, "capsule_467x181.jpg"),
      legacy: true,
      override: false,
    };
  }
  return null;
}

const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : [];
const known = new Set([
  ...index.map((e) => e.appId),
  ...(existsSync(MANUAL) ? readdirSync(MANUAL).map((f) => Number(f.split(".")[0])) : []),
]);

// 1. Кандидаты из поиска без повторов — вперемешку из всех источников, чтобы лимит не съел первый источник.
const perSource = [];
for (const source of SOURCES) {
  try {
    perSource.push({ name: source.name, ids: await search(source) });
  } catch (error) {
    console.warn(`поиск «${source.name}» не ответил: ${error.message}`);
  }
}
const candidates = new Map();
for (let round = 0; perSource.some((s) => round < s.ids.length); round++) {
  for (const source of perSource) {
    const id = source.ids[round];
    if (id && !SKIP.has(id) && !known.has(id) && !candidates.has(id)) candidates.set(id, source.name);
  }
}
console.log(`кандидатов: ${candidates.size}, уже есть: ${known.size}`);

// 2. Точные адреса пачками по 40 и скачивание.
let added = 0;
const ids = [...candidates.keys()];
for (let i = 0; i < ids.length && index.length < LIMIT; i += 40) {
  const items = await getItems(ids.slice(i, i + 40));
  for (const item of items) {
    if (index.length >= LIMIT) break;
    if (!item.success && item.success !== undefined && item.success !== 1) continue;
    const capsule = capsuleUrl(item);
    if (!capsule) continue;
    const res = await fetch(capsule.url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    writeFileSync(join(OUT, `${item.appid}.jpg`), Buffer.from(await res.arrayBuffer()));
    index.push({
      appId: item.appid,
      name: item.name ?? String(item.appid),
      source: candidates.get(item.appid),
      released: item.release?.steam_release_date
        ? new Date(item.release.steam_release_date * 1000).toISOString().slice(0, 10)
        : null,
      legacy: capsule.legacy,
      override: capsule.override,
      url: capsule.url,
    });
    added++;
  }
  writeFileSync(INDEX, JSON.stringify(index, null, 2));
}

const bySource = index.reduce((acc, e) => ({ ...acc, [e.source]: (acc[e.source] ?? 0) + 1 }), {});
console.log(`скачано новых: ${added}, всего неразмеченных: ${index.length}`, bySource);
console.log(
  `устаревших 467×181: ${index.filter((e) => e.legacy).length}, временных обложек: ${index.filter((e) => e.override).length}`,
);
