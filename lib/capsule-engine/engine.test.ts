import { describe, expect, it } from "vitest";
import { analyzeBase, analyzeText, sortChecks, topProblem } from "./analyze";
import { checkDimensions, checkFormat, checkReadability, checkWeight } from "./checks";
import { contrastRatio, createImage, grayStretch, luminanceMap, medianStrokeWidth, twoTone } from "./image";
import { resize, resizeCover } from "./resize";
import { findMarketingText, pickTitleRegion } from "./text";
import type { OcrLine, Rect, RgbaImage } from "./types";

type Rgb = [number, number, number];

function solid(w: number, h: number, [r, g, b]: Rgb): RgbaImage {
  const img = createImage(w, h);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([r, g, b, 255], i);
  return img;
}

function fill(img: RgbaImage, { x, y, w, h }: Rect, [r, g, b]: Rgb): RgbaImage {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) img.data.set([r, g, b, 255], (yy * img.width + xx) * 4);
  return img;
}

/** «Логотип» из вертикальных штрихов заданной толщины — как буквы с вертикальными основами. */
function stripes(img: RgbaImage, rect: Rect, stroke: number, gap: number, color: Rgb): RgbaImage {
  for (let x = rect.x; x + stroke <= rect.x + rect.w; x += stroke + gap)
    fill(img, { x, y: rect.y, w: stroke, h: rect.h }, color);
  return img;
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const file = { head: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), size: 120_000 };

/** Строка OCR; уверенность — одна на все слова или своя для каждого. */
function line(text: string, bbox: Rect, confidence: number | number[] = 90): OcrLine {
  const words = text.split(" ");
  const step = bbox.w / words.length;
  const conf = (i: number) => (Array.isArray(confidence) ? confidence[i] : confidence);
  return {
    text,
    confidence: conf(0),
    bbox,
    words: words.map((t, i) => ({
      text: t,
      confidence: conf(i),
      bbox: { x: bbox.x + i * step, y: bbox.y, w: step, h: bbox.h },
    })),
  };
}

const MARKETING = {
  minConfidence: 75,
  longWordConfidence: 55,
  longWordMinLength: 6,
  otherConfidence: 0,
  fuzzyMinLength: 8,
};
const TITLE = { minLineHeight: 0.12, minWordConfidence: 80, minWordLength: 4, partConfidence: 30 };

describe("масштабирование", () => {
  it("уменьшение усредняет по площади", () => {
    const img = createImage(2, 2);
    img.data.set([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
    const out = resize(img, 1, 1);
    expect([...out.data]).toEqual([128, 128, 128, 255]);
  });

  it("сохраняет среднюю яркость при 462×174 → 120×45", () => {
    const img = stripes(solid(462, 174, BLACK), { x: 0, y: 0, w: 462, h: 174 }, 1, 1, WHITE);
    const out = resize(img, 120, 45);
    const mean = out.data.reduce((s, v, i) => (i % 4 === 0 ? s + v : s), 0) / (120 * 45);
    expect(mean).toBeGreaterThan(120);
    expect(mean).toBeLessThan(135);
  });

  it("cover обрезает по центру до нужных пропорций", () => {
    const img = fill(solid(920, 430, BLACK), { x: 0, y: 0, w: 100, h: 430 }, WHITE);
    const out = resizeCover(img, 462, 174);
    expect([out.width, out.height]).toEqual([462, 174]);
    // 920×430 «выше», чем 462:174, — обрезается высота, белая полоса у левого края остаётся.
    expect(out.data[0]).toBeGreaterThan(200);
  });
});

describe("яркость и контраст", () => {
  it("белое на чёрном — 21:1", () => {
    expect(contrastRatio(1, 0)).toBe(21);
  });

  it("делит область на буквы и фон: фон — то, что на краях", () => {
    const img = fill(solid(40, 20, BLACK), { x: 10, y: 5, w: 20, h: 10 }, WHITE);
    const tone = twoTone(luminanceMap(img), 40, { x: 0, y: 0, w: 40, h: 20 });
    expect(tone.ratio).toBeCloseTo(21, 0);
    expect(tone.inkShare).toBeCloseTo(0.25, 2);
  });

  it("тёмные буквы на светлом фоне — тоже буквы", () => {
    const img = fill(solid(40, 20, WHITE), { x: 10, y: 5, w: 20, h: 10 }, BLACK);
    const tone = twoTone(luminanceMap(img), 40, { x: 0, y: 0, w: 40, h: 20 });
    expect(tone.inkShare).toBeCloseTo(0.25, 2);
  });

  it("вход для OCR — серый с растянутым контрастом", () => {
    const img = fill(solid(10, 10, [100, 100, 100]), { x: 0, y: 0, w: 5, h: 10 }, [140, 140, 140]);
    const out = grayStretch(img);
    expect([out.data[0], out.data[(9 * 10 + 9) * 4]]).toEqual([255, 0]);
  });

  it("толщина штриха — медиана по пикселям букв", () => {
    const img = stripes(solid(30, 20, BLACK), { x: 2, y: 2, w: 26, h: 16 }, 3, 3, WHITE);
    const tone = twoTone(luminanceMap(img), 30, { x: 0, y: 0, w: 30, h: 20 });
    expect(medianStrokeWidth(tone.ink, 30, 20)).toBe(3);
  });
});

describe("проверки файла", () => {
  it.each([
    [462, 174, "ok", "exact"],
    [467, 181, "error", "legacy"],
    [920, 430, "warning", "otherAsset"],
    [924, 348, "error", "wrongSize"],
    [800, 800, "error", "wrongRatio"],
  ])("%i×%i → %s (%s)", (w, h, level, code) => {
    const result = checkDimensions(w, h);
    expect([result.level, result.code]).toEqual([level, code]);
  });

  it("формат — по первым байтам, а не по расширению", () => {
    expect(checkFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47])).level).toBe("ok");
    expect(checkFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])).params?.format).toBe("JPG");
    expect(checkFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38])).level).toBe("error");
  });

  it("тяжелее 2 МБ — предупреждение, а не ошибка", () => {
    expect(checkWeight(3 * 1024 * 1024).level).toBe("warning");
    expect(checkWeight(500 * 1024).level).toBe("ok");
  });
});

describe("запрещённый текст", () => {
  it.each([
    ["WISHLIST NOW", "wishlist"],
    ["Available Now on Steam", "available now"],
    ["-50%", "50%"],
    ["9/10", "9/10"],
    ["GAME OF THE YEAR", "game of the year"],
    ["Добавь в желаемое", "добавь в"],
    ["Уже доступно", "уже доступно"],
  ])("«%s» — ошибка", (text, match) => {
    const hits = findMarketingText([line(text, { x: 300, y: 130, w: 150, h: 30 })], MARKETING);
    expect(hits.map((h) => h.match)).toEqual([match]);
  });

  it("одна ошибка распознавания в длинном слове: «ISHLIST NO» у края капсулы", () => {
    const hits = findMarketingText([line("ISHLIST NO", { x: 290, y: 144, w: 140, h: 16 }, [91, 96])], MARKETING);
    expect(hits.map((h) => h.match)).toEqual(["wishlist"]);
  });

  it("фраза засчитывается по одному уверенному слову: «EARLY(96) ACCESS’(4)»", () => {
    const hits = findMarketingText([line("EARLY ACCESS’", { x: 187, y: 108, w: 133, h: 28 }, [96, 4])], MARKETING);
    expect(hits.map((h) => h.match)).toEqual(["early access"]);
  });

  it("«Born to Play» — не «free to play»: пропуск слова только во фразах от четырёх слов", () => {
    expect(findMarketingText([line("Born to Play", { x: 40, y: 40, w: 380, h: 70 })], MARKETING)).toEqual([]);
  });

  it("фраза от четырёх слов — даже без одного потерянного слова: «GAME THE YEAR»", () => {
    const hits = findMarketingText([line("GAME THE YEAR", { x: 133, y: 7, w: 197, h: 22 }, [96, 96, 95])], MARKETING);
    expect(hits.map((h) => h.match)).toEqual(["game of the year"]);
  });

  it("короткие слова — только точное совпадение: «Winter», «Aware» — не ошибка", () => {
    const lines = [line("Winter Aware Salem", { x: 20, y: 40, w: 400, h: 60 })];
    expect(findMarketingText(lines, MARKETING)).toEqual([]);
  });

  it("«Update», «Out now», «Demo» — только во временной обложке", () => {
    for (const text of ["UPDATE 1.0 OUT NOW", "DEMO OUT NOW", "PLAYABLE ALPHA", "1.0 RELEASE"]) {
      const hits = findMarketingText([line(text, { x: 40, y: 140, w: 380, h: 24 })], MARKETING);
      expect(
        hits.map((h) => h.kind),
        text,
      ).toEqual(["overrideOnly"]);
    }
  });

  it("длинному слову хватает уверенности 55%: «UPDATE»(58)", () => {
    const hits = findMarketingText([line("1982 UPDATE", { x: 300, y: 140, w: 160, h: 16 }, [84, 58])], MARKETING);
    expect(hits.map((h) => h.match)).toEqual(["update"]);
  });

  it("одиночный «1%» — мусор распознавания, а не скидка", () => {
    expect(findMarketingText([line("1%", { x: 300, y: 140, w: 20, h: 16 }, 83)], MARKETING)).toEqual([]);
  });

  it("название игры и мусор с низкой уверенностью — не ошибка", () => {
    const lines = [
      line("Hollow Knight", { x: 20, y: 40, w: 400, h: 80 }),
      line("wishlist sale", { x: 0, y: 0, w: 100, h: 20 }, 30),
    ];
    expect(findMarketingText(lines, MARKETING)).toEqual([]);
  });
});

describe("где название", () => {
  it("берёт самую крупную строку", () => {
    const title = line("SALTMOTH", { x: 40, y: 50, w: 380, h: 70 });
    const small = line("Build 0.4", { x: 300, y: 140, w: 140, h: 22 });
    expect(pickTitleRegion([small, title], 462, 174, TITLE)?.rect).toEqual(title.bbox);
  });

  it("склеивает название в две строки", () => {
    const top = line("SALT", { x: 120, y: 20, w: 220, h: 60 });
    const bottom = line("MOTH", { x: 115, y: 90, w: 230, h: 60 });
    expect(pickTitleRegion([top, bottom], 462, 174, TITLE)?.rect).toEqual({ x: 115, y: 20, w: 230, h: 130 });
  });

  it("строку с запрещённым текстом названием не считает", () => {
    const promo = line("WISHLIST NOW", { x: 20, y: 20, w: 420, h: 80 });
    const title = line("Dredge", { x: 100, y: 110, w: 200, h: 50 });
    expect(pickTitleRegion([promo, title], 462, 174, TITLE, [promo.bbox])?.rect).toEqual(title.bbox);
  });

  it("мелкий текст — не название", () => {
    expect(pickTitleRegion([line("tiny", { x: 0, y: 0, w: 60, h: 10 })], 462, 174, TITLE)).toBeNull();
  });

  it("подклеивает куски той же строки, распознанные мусором: HOLLO(92) + IGHT(46)", () => {
    const left = line("HOLLO", { x: 40, y: 54, w: 145, h: 48 }, 92);
    const right = line("IGHT", { x: 304, y: 54, w: 148, h: 56 }, 46);
    expect(pickTitleRegion([left, right], 462, 174, TITLE)?.rect).toEqual({ x: 40, y: 54, w: 412, h: 56 });
  });

  it("логотип в две строки разного размера: Slay + the + pire", () => {
    const slay = line("Slay", { x: 139, y: 8, w: 115, h: 84 }, 92);
    const the = line("the", { x: 269, y: 58, w: 53, h: 33 }, 96);
    const pire = line("pire", { x: 208, y: 111, w: 111, h: 59 }, 46);
    // «the» в 2,5 раза ниже «Slay» и выступает за рамку на 3 px — не подклеивается, рамка от этого почти не меняется.
    expect(pickTitleRegion([slay, the, pire], 462, 174, TITLE)?.rect).toEqual({ x: 139, y: 8, w: 180, h: 162 });
  });

  it("высота букв названия в две строки — по словам, а не по всей рамке", () => {
    const top = line("SALT", { x: 120, y: 20, w: 220, h: 60 });
    const bottom = line("MOTH", { x: 115, y: 90, w: 230, h: 60 });
    expect(pickTitleRegion([top, bottom], 462, 174, TITLE)?.letterHeight).toBe(60);
  });

  it("рамка строки с артом не раздувает рамку названия — берём слова", () => {
    const title: OcrLine = {
      text: "ASHIGARU ~",
      confidence: 60,
      bbox: { x: 10, y: 0, w: 450, h: 174 }, // строка tesseract захватила весь арт
      words: [
        { text: "ASHIGARU", confidence: 93, bbox: { x: 262, y: 10, w: 190, h: 34 } },
        { text: "~", confidence: 10, bbox: { x: 10, y: 0, w: 200, h: 174 } },
      ],
    };
    expect(pickTitleRegion([title], 462, 174, TITLE)?.rect).toEqual({ x: 262, y: 10, w: 190, h: 34 });
  });

  it("стилизованный логотип, распознанный мусором, — не уверены, просим обвести", () => {
    expect(pickTitleRegion([line("BAL", { x: 11, y: 37, w: 123, h: 109 }, 56)], 462, 174, TITLE)).toBeNull();
  });
});

describe("анализ капсулы", () => {
  const logo: Rect = { x: 60, y: 50, w: 340, h: 74 };
  const capsule = () => stripes(solid(462, 174, [20, 24, 40]), logo, 8, 6, WHITE);

  it("мгновенные проверки и три размера показа", () => {
    const base = analyzeBase(capsule(), file);
    expect(base.previews.map((p) => `${p.width}×${p.height}`)).toEqual(["231×87", "184×69", "120×45"]);
    expect(base.ocrInputs.map((i) => `${i.image.width}×${i.image.height}@${i.offset.y}/psm${i.psm}`)).toEqual([
      "924×348@0/psm11",
      "924×348@0/psm11",
      "924×174@0/psm11",
      "924×174@87/psm11",
      "1386×132@0/psm6",
      "1386×132@130/psm6",
    ]);
    expect(base.checks.find((c) => c.id === "dimensions")?.level).toBe("ok");
  });

  it("крупное контрастное название проходит", () => {
    const base = analyzeBase(capsule(), file);
    const text = analyzeText(base, [line("SALTMOTH", logo)]);
    const levels = Object.fromEntries(text.checks.map((c) => [c.id, c.level]));
    expect(levels).toEqual({ extraText: "ok", logoWidth: "ok", contrast: "ok", readability: "ok" });
  });

  it("узкое и тонкое название: совет по ширине, предупреждение по контрасту, совет по читаемости", () => {
    const narrow: Rect = { x: 150, y: 70, w: 160, h: 30 };
    const img = stripes(solid(462, 174, [20, 24, 40]), narrow, 1, 3, [90, 96, 120]);
    const base = analyzeBase(img, file);
    const text = analyzeText(base, [], narrow);
    const levels = Object.fromEntries(text.checks.map((c) => [c.id, c.level]));
    expect(levels.logoWidth).toBe("advice");
    expect(levels.contrast).toBe("warning");
    expect(levels.readability).toBe("advice");
  });

  it("название не нашлось — совет обвести его вручную", () => {
    const base = analyzeBase(capsule(), file);
    const text = analyzeText(base, []);
    expect(text.region).toBeNull();
    expect(text.checks.map((c) => `${c.id}:${c.code}`)).toEqual(["extraText:ok", "readability:notFound"]);
  });

  it("читаемость в 120×45 — совет, если штрихи тоньше пикселя", () => {
    const img = stripes(solid(462, 174, BLACK), logo, 1, 4, WHITE);
    const base = analyzeBase(img, file);
    expect(checkReadability(base.previews[2], logo, 462).level).toBe("advice");
  });

  it("самая серьёзная проблема — ошибка формата раньше совета", () => {
    const checks = [
      { id: "details", level: "advice", code: "busy" },
      { id: "format", level: "error", code: "unsupported" },
      { id: "dimensions", level: "error", code: "wrongSize" },
    ] as const;
    expect(topProblem([...checks])?.id).toBe("format");
    expect(sortChecks([...checks]).map((c) => c.id)).toEqual(["format", "dimensions", "details"]);
  });
});
