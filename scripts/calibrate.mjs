/**
 * Калибровка проверок капсулы: прогоняет весь конвейер движка (как в браузере, но через sharp и tesseract.js в Node)
 * на капсулах из fixtures/ и печатает таблицу «ожидали / получили».
 *
 *   fixtures/capsules/   — настоящие капсулы (npm run spike:steam): ожидаем, что ошибок нет
 *   fixtures/synthetic/  — испорченные версии, собираются здесь же: запрещённый текст, мелкое название, низкий контраст
 *   fixtures/manual/     — набор основателя (необязательно): <имя>.<ok|text|unreadable|contrast>.png|jpg
 *
 * Картинки с найденной рамкой названия — в scripts/spikes/out/calibration/ (смотреть глазами).
 * Запуск: npm run calibrate
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { analyzeBase, analyzeText, OCR_SCALE } from "../lib/capsule-engine/analyze.ts";
import { linesFromTesseract } from "../lib/capsule-engine/text.ts";
import { CHECK_RULES } from "../data/check-rules.ts";

const ROOT = process.cwd();
const REAL = join(ROOT, "fixtures/capsules");
const SYNTH = join(ROOT, "fixtures/synthetic");
const MANUAL = join(ROOT, "fixtures/manual");
const OUT = join(ROOT, "scripts/spikes/out/calibration");
mkdirSync(SYNTH, { recursive: true });
mkdirSync(OUT, { recursive: true });

const realFiles = existsSync(REAL) ? readdirSync(REAL).filter((f) => f.endsWith("-small_2x.jpg")) : [];
if (realFiles.length === 0) {
  console.error("Нет капсул в fixtures/capsules — сначала npm run spike:steam");
  process.exit(1);
}

/** Капсула 462×174 из файла: старые 467×181 приводим к новому размеру, как сделал бы разработчик. */
async function load462(path) {
  return sharp(path).resize(462, 174, { fit: "cover" }).flatten({ background: "#16181d" }).png().toBuffer();
}

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="462" height="174">${body}</svg>`);
const OVERLAYS = {
  wishlist: svg(
    `<text x="452" y="160" text-anchor="end" font-family="Arial Black" font-size="22" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">WISHLIST NOW</text>`,
  ),
  discount: svg(
    `<rect x="372" y="10" width="80" height="40" rx="6" fill="#d81e3a"/><text x="412" y="40" text-anchor="middle" font-family="Arial Black" font-size="26" fill="#fff">-50%</text>`,
  ),
  goty: svg(
    `<rect x="0" y="0" width="462" height="30" fill="rgba(0,0,0,0.65)"/><text x="231" y="22" text-anchor="middle" font-family="Georgia" font-weight="bold" font-size="18" fill="#f5d27a">GAME OF THE YEAR</text>`,
  ),
  ru: svg(
    `<text x="452" y="162" text-anchor="end" font-family="Arial" font-weight="bold" font-size="20" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">Добавь в желаемое</text>`,
  ),
};

/**
 * Синтетика: [имя, ожидание, функция сборки, рамка названия]. Ожидание — id проверки, которая должна сработать.
 * Рамка — как если бы человек обвёл название сам (для мелкого текста, которого OCR не видит).
 */
async function buildSynthetic() {
  const base = (appId) => load462(join(REAL, `${appId}-small_2x.jpg`));
  const list = [
    ["dredge+wishlist", "extraText", async () => sharp(await base(1562430)).composite([{ input: OVERLAYS.wishlist }])],
    ["hades+discount", "extraText", async () => sharp(await base(1145360)).composite([{ input: OVERLAYS.discount }])],
    ["celeste+goty", "extraText", async () => sharp(await base(504230)).composite([{ input: OVERLAYS.goty }])],
    ["balatro+ru", "extraText", async () => sharp(await base(2379780)).composite([{ input: OVERLAYS.ru }])],
    [
      "tiny-thin-title",
      "readability",
      async () =>
        sharp(
          await sharp(await base(413150))
            .blur(6)
            .toBuffer(),
        ).composite([
          {
            input: svg(
              `<text x="231" y="96" text-anchor="middle" font-family="Helvetica Neue" font-weight="200" font-size="20" fill="#e8e2d0">Mossy Hollow Tales</text>`,
            ),
          },
        ]),
      { x: 140, y: 78, w: 182, h: 24 },
    ],
    [
      "low-contrast-title",
      "contrast",
      async () =>
        sharp({ create: { width: 462, height: 174, channels: 3, background: "#5b4a40" } }).composite([
          {
            input: svg(
              `<text x="231" y="112" text-anchor="middle" font-family="Arial Black" font-size="64" fill="#6f5c50">EMBERFALL</text>`,
            ),
          },
        ]),
    ],
  ];
  const out = [];
  for (const [name, expect, make, region] of list) {
    const path = join(SYNTH, `${name}.png`);
    await (await make()).png().toFile(path);
    out.push({ name, expect, path, region });
  }
  return out;
}

const NAMES = {
  1145360: "Hades",
  367520: "Hollow Knight",
  413150: "Stardew Valley",
  504230: "Celeste",
  105600: "Terraria",
  1794680: "Vampire Survivors",
  2379780: "Balatro",
  646570: "Slay the Spire",
  1313140: "Cult of the Lamb",
  1562430: "Dredge",
};

const cases = [
  ...realFiles.map((f) => {
    const appId = f.split("-")[0];
    // На старой капсуле Hades написано «EARLY ACCESS» — по нынешним правилам Valve это лишний текст.
    return { name: NAMES[appId] ?? f, expect: appId === "1145360" ? "extraText" : "ok", path: join(REAL, f) };
  }),
  ...(await buildSynthetic()),
  ...(existsSync(MANUAL)
    ? readdirSync(MANUAL)
        .filter((f) => /\.(png|jpe?g)$/i.test(f))
        .map((f) => {
          const kind = f.split(".").at(-2);
          const expect = { ok: "ok", text: "extraText", unreadable: "readability", contrast: "contrast" }[kind] ?? "ok";
          return { name: `manual/${basename(f)}`, expect, path: join(MANUAL, f) };
        })
    : []),
];

const worker = await createWorker(["eng", "rus"], 1, { cachePath: join(ROOT, "scripts/spikes/out/tessdata") });
await worker.setParameters({ tessedit_pageseg_mode: "11", user_defined_dpi: String(CHECK_RULES.ocr.dpi) });

const rows = [];
for (const c of cases) {
  const png = await load462(c.path);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
  const base = analyzeBase(image, { head: new Uint8Array(png.subarray(0, 8)), size: png.length });

  const started = performance.now();
  const lines = [];
  for (const { image: input, offset } of base.ocrInputs) {
    const ocrPng = await sharp(Buffer.from(input.data), {
      raw: { width: input.width, height: input.height, channels: 4 },
    })
      .png()
      .toBuffer();
    const { data: page } = await worker.recognize(ocrPng, {}, { blocks: true });
    lines.push(...linesFromTesseract(page, 1 / OCR_SCALE, offset));
  }
  const ocrMs = Math.round(performance.now() - started);
  const text = analyzeText(base, lines, c.region);
  const all = [...base.checks, ...text.checks];
  const by = Object.fromEntries(all.map((r) => [r.id, r]));

  const problems = all.filter((r) => r.level !== "ok").map((r) => `${r.id}:${r.code}`);
  const fired = (id) => by[id] && by[id].level !== "ok";
  const pass =
    c.expect === "ok"
      ? !all.some((r) => r.level === "error" || r.level === "warning")
      : c.expect === "readability"
        ? fired("readability") || fired("logoWidth")
        : fired(c.expect);

  rows.push({
    case: c.name,
    expect: c.expect,
    pass: pass ? "✓" : "✗",
    problems: problems.join(", ") || "—",
    region: text.region ? `${Math.round(text.region.w)}×${Math.round(text.region.h)}` : "нет",
    contrast: by.contrast?.params?.ratio ?? "",
    stroke120: by.readability?.params?.stroke ?? "",
    edges: by.details?.params?.percent ?? "",
    ocrMs,
  });

  // Рамки: зелёная — название, красная — запрещённый текст.
  const rects = [];
  if (text.region) rects.push({ r: text.region, color: "#22c55e" });
  if (by.extraText?.region) rects.push({ r: by.extraText.region, color: "#ef4444" });
  const overlay = svg(
    rects
      .map(
        ({ r, color }) =>
          `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${color}" stroke-width="2"/>`,
      )
      .join(""),
  );
  await sharp(png)
    .composite([{ input: overlay }])
    .toFile(join(OUT, `${c.name.replace(/[^a-z0-9+_-]/gi, "_")}.png`));
}
await worker.terminate();

console.table(rows);
const failed = rows.filter((r) => r.pass !== "✓");
console.log(`Итого: ${rows.length - failed.length} из ${rows.length} как ожидали. Рамки — в ${OUT}`);
writeFileSync(join(OUT, "report.json"), JSON.stringify(rows, null, 2));
