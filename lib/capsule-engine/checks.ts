import { CHECK_RULES } from "../../data/check-rules.ts";
import { ASSETS, getAsset } from "../../data/steam-assets.ts";
import {
  clampRect,
  edgeDensity,
  luminanceMap,
  medianStrokeWidth,
  percentileContrast,
  scaleRect,
  twoTone,
} from "./image.ts";
import type { MarketingHit } from "./text.ts";
import type { CheckResult, Rect, RgbaImage } from "./types.ts";

const SMALL = getAsset("small");
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Что за файл по размеру: малая капсула, другой ассет Steam, старый размер или что-то своё. */
export function checkDimensions(width: number, height: number): CheckResult {
  const size = `${width}×${height}`;
  if (width === SMALL.w && height === SMALL.h)
    return { id: "dimensions", level: "ok", code: "exact", params: { size } };
  if (width === 467 && height === 181) return { id: "dimensions", level: "error", code: "legacy", params: { size } };
  const other = ASSETS.find((a) => a.w === width && a.h === height);
  if (other) {
    return { id: "dimensions", level: "warning", code: "otherAsset", params: { size, asset: other.id } };
  }
  const aspectOff = Math.abs(width / height / (SMALL.w / SMALL.h) - 1);
  if (aspectOff <= CHECK_RULES.aspectTolerance) {
    return { id: "dimensions", level: "error", code: "wrongSize", params: { size } };
  }
  return { id: "dimensions", level: "error", code: "wrongRatio", params: { size } };
}

/** Настоящий формат по первым байтам: Steamworks принимает PNG и JPG. */
export function checkFormat(head: Uint8Array): CheckResult {
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (isPng) return { id: "format", level: "ok", code: "ok", params: { format: "PNG" } };
  if (isJpeg) return { id: "format", level: "ok", code: "ok", params: { format: "JPG" } };
  return { id: "format", level: "error", code: "unsupported" };
}

export function checkWeight(bytes: number): CheckResult {
  const mb = round1(bytes / 1024 / 1024);
  const kb = Math.round(bytes / 1024);
  if (bytes > CHECK_RULES.softMaxMB * 1024 * 1024) {
    return { id: "weight", level: "warning", code: "heavy", params: { mb, max: CHECK_RULES.softMaxMB } };
  }
  return { id: "weight", level: "ok", code: "ok", params: { kb } };
}

/** Мелкие детали в самом мелком показе: много резких перепадов — капсула превращается в шум. */
export function checkDetails(preview120: RgbaImage): CheckResult {
  const lum = luminanceMap(preview120);
  const density = edgeDensity(lum, preview120.width, preview120.height, CHECK_RULES.details.edgeThreshold);
  const percent = Math.round(density * 100);
  if (density > CHECK_RULES.details.edgeDensityMax)
    return { id: "details", level: "advice", code: "busy", params: { percent } };
  return { id: "details", level: "ok", code: "ok", params: { percent } };
}

/**
 * Лишний текст: запрещённый (оценки, награды, скидки, призывы) — ошибка; разрешённый только во временной обложке
 * («Update», «Out now», «Demo») — предупреждение: на основной капсуле его тоже отклонят.
 */
export function checkExtraText(hits: MarketingHit[]): CheckResult {
  if (hits.length === 0) return { id: "extraText", level: "ok", code: "ok" };
  const banned = hits.filter((h) => h.kind === "banned");
  const shown = banned.length ? banned : hits;
  return {
    id: "extraText",
    level: banned.length ? "error" : "warning",
    code: banned.length ? "found" : "override",
    params: { text: shown.map((h) => h.text).join(" · ") },
    region: shown[0].bbox,
  };
}

/** Ширина логотипа — совет по рекомендации Steamworks; на читаемость сильнее влияет высота букв (readability). */
export function checkLogoWidth(region: Rect, workWidth: number, workHeight: number): CheckResult {
  const share = region.w / workWidth;
  const tall = region.h / workHeight >= CHECK_RULES.logoTallHeightMin && share >= CHECK_RULES.logoTallWidthMin;
  const percent = Math.round(share * 100);
  const min = Math.round(CHECK_RULES.logoWidthMin * 100);
  if (share < CHECK_RULES.logoWidthMin && !tall) {
    return { id: "logoWidth", level: "advice", code: "narrow", params: { percent, min }, region };
  }
  return { id: "logoWidth", level: "ok", code: "ok", params: { percent } };
}

/** Контраст букв и фона под ними в полном размере. */
export function checkContrast(work: RgbaImage, region: Rect): CheckResult {
  const rect = clampRect(region, work.width, work.height);
  const [lo, hi] = CHECK_RULES.contrastPercentiles;
  const ratio = percentileContrast(luminanceMap(work), work.width, rect, lo, hi);
  const shown = round1(ratio);
  if (ratio < CHECK_RULES.contrastMin) {
    return {
      id: "contrast",
      level: "warning",
      code: "low",
      params: { ratio: shown, min: CHECK_RULES.contrastMin },
      region,
    };
  }
  return { id: "contrast", level: "ok", code: "ok", params: { ratio: shown } };
}

/**
 * Читаемость в 120×45 — только совет (спайк B: OCR тут врёт). Смотрим, что остаётся от названия в самом
 * мелком показе: контраст букв и фона, толщину штриха и высоту надписи.
 */
export function checkReadability(
  preview120: RgbaImage,
  region: Rect,
  workWidth: number,
  /** Высота букв по словам OCR (у названия в две строки рамка выше букв). Нет — берём высоту рамки. */
  letterHeight?: number,
): CheckResult {
  const scale = preview120.width / workWidth;
  const rect = clampRect(scaleRect(region, scale), preview120.width, preview120.height);
  const rules = CHECK_RULES.readability;
  if (rect.w < 2 || rect.h < 2) return { id: "readability", level: "advice", code: "small", params: { px: rect.h } };
  const lum = luminanceMap(preview120);
  const [lo, hi] = CHECK_RULES.contrastPercentiles;
  const ratio = percentileContrast(lum, preview120.width, rect, lo, hi);
  const stroke = medianStrokeWidth(twoTone(lum, preview120.width, rect).ink, rect.w, rect.h);
  const px = Math.round((letterHeight ?? region.h) * scale);
  const params = { ratio: round1(ratio), stroke: round1(stroke), px };
  if (px < rules.titleHeightMinPx) return { id: "readability", level: "advice", code: "small", params, region };
  if (ratio < rules.contrastMin) return { id: "readability", level: "advice", code: "blurry", params, region };
  if (stroke < rules.strokeMinPx) return { id: "readability", level: "advice", code: "thin", params, region };
  return { id: "readability", level: "ok", code: "ok", params };
}
