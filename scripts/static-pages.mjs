/**
 * Шаг после `opennextjs-cloudflare build`: кладёт предрендеренные страницы (ru.html, en.html, ru/next-fest.html…)
 * в статические файлы воркера. Cloudflare отдаёт такие файлы сам, не запуская воркер: запрос бесплатный
 * и не тратит CPU. Через Next.js те же страницы стоили 18–28 мс CPU при лимите бесплатного тарифа 10 мс
 * (замер 12.11.2026, docs/decisions.md).
 *
 * Что при этом не работает и почему это нормально:
 *   - middleware не видит /, /ru и /en — выбор языка на «/» делает статическая страница (ниже);
 *   - клиентская навигация Next.js получает HTML вместо RSC и делает обычный переход — это полная загрузка страницы.
 * Динамические страницы (без .html в сборке) остаются в воркере.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { routing } from "../i18n/routing.ts";

const APP = join(process.cwd(), ".next/server/app");
const ASSETS = join(process.cwd(), ".open-next/assets");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const copied = [];
for (const locale of routing.locales) {
  const candidates = [join(APP, `${locale}.html`)];
  const nested = join(APP, locale);
  try {
    if (statSync(nested).isDirectory()) candidates.push(...[...walk(nested)].filter((f) => f.endsWith(".html")));
  } catch {
    // вложенных страниц у языка пока нет
  }
  for (const file of candidates) {
    try {
      statSync(file);
    } catch {
      continue;
    }
    const target = join(ASSETS, relative(APP, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
    copied.push(relative(APP, file));
  }
}

if (copied.length === 0) {
  console.error("static-pages: не нашёл ни одной предрендеренной страницы — проверьте, что сборка прошла");
  process.exit(1);
}

/*
 * «/» — тоже статикой: выбор языка в браузере вместо middleware. Логика та же, что у next-intl:
 * сначала cookie NEXT_LOCALE, потом первый поддерживаемый язык из настроек браузера, иначе язык по умолчанию.
 * Метки ?ref= сохраняются. Без JS — переход на язык по умолчанию.
 */
const locales = JSON.stringify(routing.locales);
const fallback = routing.defaultLocale;
writeFileSync(
  join(ASSETS, "index.html"),
  `<!doctype html>
<html><head><meta charset="utf-8"><title>FestReady</title>
<meta name="robots" content="noindex">
${routing.locales.map((l) => `<link rel="alternate" hreflang="${l}" href="/${l}">`).join("")}<link rel="alternate" hreflang="x-default" href="/${fallback}">
<script>(function(){var s=${locales},m=document.cookie.match(/(?:^|; )NEXT_LOCALE=([a-z]+)/),l=m&&s.indexOf(m[1])>=0?m[1]:null;if(!l){var p=navigator.languages||[navigator.language||""];for(var i=0;i<p.length&&!l;i++){var b=String(p[i]).slice(0,2).toLowerCase();if(s.indexOf(b)>=0)l=b}}location.replace("/"+(l||"${fallback}")+location.search+location.hash)})();</script>
<noscript><meta http-equiv="refresh" content="0; url=/${fallback}"></noscript>
</head><body></body></html>
`,
);
copied.push("index.html (выбор языка)");

console.log(`static-pages: отдаются мимо воркера — ${copied.join(", ")}`);
