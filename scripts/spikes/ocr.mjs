/**
 * Спайк B: читается ли название игры распознаванием текста после уменьшения капсулы.
 * Для каждой капсулы из fixtures/capsules/ (сначала `npm run spike:steam`):
 *   исходник 462×174 → уменьшаем до 231×87, 184×69, 120×45 → увеличиваем обратно → tesseract.js.
 * Сравниваем распознанное с названием игры (порог плана — 70%).
 *
 * В продукте то же самое будет в Web Worker через OffscreenCanvas; здесь Node + sharp,
 * чтобы понять, есть ли смысл в проверке вообще, сколько весят модели и сколько идёт прогон.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { SPIKE_GAMES } from "./capsules.mjs";

const FIXTURES = join(process.cwd(), "fixtures/capsules");
const OUT = join(process.cwd(), "scripts/spikes/out");
const CACHE = join(OUT, "tessdata");
mkdirSync(CACHE, { recursive: true });

const SOURCE = [462, 174];
const SIZES = [
  [462, 174],
  [231, 87],
  [184, 69],
  [120, 45],
];
// Увеличиваем всё до одной ширины: tesseract лучше читает буквы высотой 20–40 px.
const OCR_WIDTH = 924;

const letters = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Лучшее совпадение названия с любым окном распознанного текста той же длины (±2), 0…1. */
function similarity(name, text) {
  const n = letters(name);
  const t = letters(text);
  if (!t) return 0;
  let best = levenshtein(n, t);
  for (let len = Math.max(1, n.length - 2); len <= n.length + 2; len++) {
    for (let i = 0; i + len <= t.length; i++) best = Math.min(best, levenshtein(n, t.slice(i, i + len)));
  }
  return Math.max(0, 1 - best / n.length);
}

const files = readdirSync(FIXTURES).filter((f) => f.endsWith("-small_2x.jpg"));
if (files.length === 0) {
  console.error("Нет капсул в fixtures/capsules — сначала npm run spike:steam");
  process.exit(1);
}

const t0 = performance.now();
const worker = await createWorker("eng", 1, { cachePath: CACHE });
const initMs = Math.round(performance.now() - t0);

// Заход 1 — один проход как есть. Заход 2 — лучший из 6: 3 предобработки × 2 режима разметки страницы.
const PREPS = {
  plain: (img) => img,
  gray: (img) => img.grayscale().normalize(),
  negate: (img) => img.grayscale().normalize().negate(),
};
const PSM_MODES = { auto: "3", sparse: "11" };

const rows = [];
const best = [];
const recognizeMs = [];
for (const file of files) {
  const appId = Number(file.split("-")[0]);
  const game = SPIKE_GAMES.find((g) => g.appId === appId);
  const source = await sharp(join(FIXTURES, file)).resize(SOURCE[0], SOURCE[1], { fit: "cover" }).toBuffer();
  const row = { game: game?.name ?? String(appId) };
  const bestRow = { game: row.game };
  for (const [w, h] of SIZES) {
    const small = await sharp(source).resize(w, h, { kernel: "lanczos3" }).toBuffer();
    let top = 0;
    for (const [psmName, psm] of Object.entries(PSM_MODES)) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      for (const [prepName, prep] of Object.entries(PREPS)) {
        const back = await prep(sharp(small).resize(OCR_WIDTH, Math.round((OCR_WIDTH * h) / w), { kernel: "cubic" }))
          .png()
          .toBuffer();
        const started = performance.now();
        const { data } = await worker.recognize(back);
        recognizeMs.push(performance.now() - started);
        const score = Math.round(similarity(row.game, data.text) * 100);
        top = Math.max(top, score);
        if (psmName === "auto" && prepName === "plain") {
          row[`${w}×${h}`] = score;
          row[`text ${w}`] = data.text.replace(/\s+/g, " ").trim().slice(0, 40);
        }
      }
    }
    bestRow[`${w}×${h}`] = top;
  }
  rows.push(row);
  best.push(bestRow);
}
await worker.terminate();

const modelFiles = readdirSync(CACHE).map((f) => ({ file: f, kb: Math.round(statSync(join(CACHE, f)).size / 1024) }));
// Сжатые модели, которые скачает браузер (CDN tesseract.js по умолчанию; в продукте раздадим со своего домена).
const gz = {};
for (const lang of ["eng", "rus"]) {
  const url = `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`;
  const res = await fetch(url, { method: "HEAD" });
  gz[lang] = { status: res.status, kb: Math.round(Number(res.headers.get("content-length") ?? 0) / 1024) };
}

const avgRecognize = Math.round(recognizeMs.reduce((a, b) => a + b, 0) / recognizeMs.length);
const passCounts = (table) =>
  SIZES.map(([w, h]) => `${w} — ${table.filter((r) => r[`${w}×${h}`] >= 70).length}`).join(", ");
const scoresOnly = (table) =>
  table.map(({ game, ...rest }) => ({
    game,
    ...Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith("text"))),
  }));

console.log("Заход 1: один проход как есть, сходство с названием, %");
console.table(scoresOnly(rows));
console.log("Распознанный текст при 120×45:");
for (const r of rows) console.log(`  ${r.game}: «${r["text 120"]}»`);
console.log("Заход 2: лучший из 6 (3 предобработки × 2 режима), %");
console.table(best);
console.log(`Прошли порог 70% из ${rows.length}. Заход 1: ${passCounts(rows)}. Заход 2: ${passCounts(best)}`);
console.log(
  `Инициализация воркера с загрузкой модели: ${initMs} мс; распознавание: в среднем ${avgRecognize} мс на картинку`,
);
console.log("Модели в кэше:", modelFiles, "сжатые для браузера:", gz);

writeFileSync(
  join(OUT, "ocr.json"),
  JSON.stringify({ at: new Date().toISOString(), initMs, avgRecognize, single: rows, best, modelFiles, gz }, null, 2),
);
