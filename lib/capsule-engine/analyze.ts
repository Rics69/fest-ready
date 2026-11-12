import { CHECK_RULES } from "../../data/check-rules.ts";
import { SMALL_CAPSULE_PREVIEWS, getAsset } from "../../data/steam-assets.ts";
import {
  checkContrast,
  checkDetails,
  checkDimensions,
  checkExtraText,
  checkFormat,
  checkLogoWidth,
  checkReadability,
  checkWeight,
} from "./checks.ts";
import { grayStretch } from "./image.ts";
import { crop, resize, resizeCover } from "./resize.ts";
import { findMarketingText, pickTitleRegion } from "./text.ts";
import type { CheckId, CheckResult, FileInfo, Level, OcrLine, Rect, RgbaImage } from "./types.ts";

const SMALL = getAsset("small");
/**
 * Распознаём текст на вдвое увеличенной капсуле (tesseract лучше читает буквы высотой 20–40 px)
 * в несколько проходов и объединяем найденное. tesseract на капсулах ведёт себя почти хаотично:
 * разница в пару уровней яркости — и надпись пропадает. Поэтому проходы разные:
 *   - цветом и в сером с растянутым контрастом: цветной не видит «-50%» на красной плашке,
 *     серый — «GAME OF THE YEAR» на тёмной полосе;
 *   - отдельно верхняя и нижняя половины: маркетинговые надписи почти всегда стоят полосой сверху или снизу,
 *     а на половине tesseract не путает их с артом (в браузере «WISHLIST NOW» терялся на целой капсуле);
 *   - тонкие полосы у краёв (по 25%), втрое крупнее и в режиме «блок текста»: так читается
 *     «EARLY ACCESS AVAILABLE NOW» на оранжевой плашке, которую не видят остальные проходы.
 * Калибровка — docs/decisions.md.
 */
export const OCR_SCALE = 2;

export type OcrInput = {
  image: RgbaImage;
  /** Где этот кусок лежит на капсуле 462×174 — чтобы перевести координаты слов обратно. */
  offset: { x: number; y: number };
  /** Во сколько раз кусок увеличен. */
  scale: number;
  /** Режим разметки страницы tesseract: 11 — разрозненный текст, 6 — один блок текста. */
  psm: "11" | "6";
};

export type BaseAnalysis = {
  /** Капсула, приведённая к 462×174: на ней считаются все проверки. */
  work: RgbaImage;
  /** 231×87, 184×69, 120×45 — как покажет Steam. */
  previews: RgbaImage[];
  /** Что отдать распознаванию текста: целиком цветом и в сером, верхняя и нижняя половины. */
  ocrInputs: OcrInput[];
  checks: CheckResult[];
};

/** Мгновенные проверки — до распознавания текста. */
export function analyzeBase(image: RgbaImage, file: FileInfo): BaseAnalysis {
  const exact = image.width === SMALL.w && image.height === SMALL.h;
  const work = exact ? image : resizeCover(image, SMALL.w, SMALL.h);
  const previews = SMALL_CAPSULE_PREVIEWS.map(([w, h]) => resize(work, w, h));
  const upscaled = resize(work, SMALL.w * OCR_SCALE, SMALL.h * OCR_SCALE);
  const half = Math.round(SMALL.h / 2);
  const band = (y: number, h: number, scale: number, psm: OcrInput["psm"]): OcrInput => ({
    image: grayStretch(resize(crop(work, 0, y, SMALL.w, h), SMALL.w * scale, h * scale)),
    offset: { x: 0, y },
    scale,
    psm,
  });
  const strip = Math.round(SMALL.h / 4);
  const ocrInputs: OcrInput[] = [
    { image: upscaled, offset: { x: 0, y: 0 }, scale: OCR_SCALE, psm: "11" },
    { image: grayStretch(upscaled), offset: { x: 0, y: 0 }, scale: OCR_SCALE, psm: "11" },
    band(0, half, OCR_SCALE, "11"),
    band(SMALL.h - half, half, OCR_SCALE, "11"),
    band(0, strip, 3, "6"),
    band(SMALL.h - strip, strip, 3, "6"),
  ];
  const preview120 = previews[previews.length - 1];
  return {
    work,
    previews,
    ocrInputs,
    checks: [
      checkDimensions(image.width, image.height),
      checkFormat(file.head),
      checkWeight(file.size),
      checkDetails(preview120),
    ],
  };
}

export type TextAnalysis = {
  /** Где мы считаем название; null — не нашли. */
  region: Rect | null;
  checks: CheckResult[];
};

/**
 * Проверки, которым нужен текст: запрещённые надписи, ширина и контраст логотипа, читаемость в 120×45.
 * lines — строки из всех проходов распознавания вместе.
 * manualRegion — рамка, которую человек обвёл сам; тогда автоматический выбор не нужен.
 */
export function analyzeText(
  base: Pick<BaseAnalysis, "work" | "previews">,
  lines: OcrLine[],
  manualRegion?: Rect,
): TextAnalysis {
  const { work, previews } = base;
  const { ocr } = CHECK_RULES;
  const hits = findMarketingText(lines, {
    minConfidence: ocr.minWordConfidence,
    longWordConfidence: ocr.longWordConfidence,
    longWordMinLength: ocr.longWordMinLength,
    otherConfidence: ocr.phraseWordConfidence,
    fuzzyMinLength: ocr.fuzzyMinLength,
  });
  const found = manualRegion
    ? null
    : pickTitleRegion(
        lines,
        work.width,
        work.height,
        {
          minLineHeight: ocr.titleLineMinHeight,
          minWordConfidence: ocr.titleWordConfidence,
          minWordLength: ocr.titleWordMinLength,
          partConfidence: ocr.titlePartConfidence,
        },
        hits.map((h) => h.bbox),
      );
  const region = manualRegion ?? found?.rect ?? null;
  const checks: CheckResult[] = [checkExtraText(hits)];
  if (!region) {
    checks.push({ id: "readability", level: "advice", code: "notFound" });
    return { region: null, checks };
  }
  const preview120 = previews[previews.length - 1];
  checks.push(
    checkLogoWidth(region, work.width, work.height),
    checkContrast(work, region),
    checkReadability(preview120, region, work.width, found?.letterHeight),
  );
  return { region, checks };
}

const SEVERITY: Record<Level, number> = { error: 3, warning: 2, advice: 1, ok: 0 };
/** Порядок важности при одинаковом уровне: то, что ломает загрузку в Steamworks, — первым. */
const ORDER: CheckId[] = [
  "format",
  "dimensions",
  "extraText",
  "contrast",
  "logoWidth",
  "readability",
  "weight",
  "details",
];

export function sortChecks(checks: CheckResult[]): CheckResult[] {
  return [...checks].sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level] || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

/** Самая серьёзная проблема — для подсказки над списком. null — всё хорошо. */
export function topProblem(checks: CheckResult[]): CheckResult | null {
  const [first] = sortChecks(checks);
  return first && first.level !== "ok" ? first : null;
}
