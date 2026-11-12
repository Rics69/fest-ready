import type { Rect, RgbaImage } from "./types.ts";

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** sRGB 0…255 → линейная яркость 0…1 (таблица на 256 значений). */
const LINEAR = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

/** Относительная яркость пикселя по WCAG, 0…1. */
export function luminanceAt(img: RgbaImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  return 0.2126 * LINEAR[img.data[i]] + 0.7152 * LINEAR[img.data[i + 1]] + 0.0722 * LINEAR[img.data[i + 2]];
}

/** Карта относительной яркости всего изображения. */
export function luminanceMap(img: RgbaImage): Float32Array {
  const out = new Float32Array(img.width * img.height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    out[p] = 0.2126 * LINEAR[img.data[i]] + 0.7152 * LINEAR[img.data[i + 1]] + 0.0722 * LINEAR[img.data[i + 2]];
  }
  return out;
}

/** Контраст двух яркостей по WCAG: 1…21. */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Прямоугольник, обрезанный по границам изображения, с целыми координатами. */
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(width, Math.floor(rect.x)));
  const y = Math.max(0, Math.min(height, Math.floor(rect.y)));
  const x1 = Math.max(x, Math.min(width, Math.ceil(rect.x + rect.w)));
  const y1 = Math.max(y, Math.min(height, Math.ceil(rect.y + rect.h)));
  return { x, y, w: x1 - x, h: y1 - y };
}

export function scaleRect(rect: Rect, sx: number, sy: number = sx): Rect {
  return { x: rect.x * sx, y: rect.y * sy, w: rect.w * sx, h: rect.h * sy };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Яркости пикселей внутри прямоугольника (построчно) и признак «пиксель на краю рамки». */
export function sampleRect(lum: Float32Array, width: number, rect: Rect): { values: Float32Array; edge: Uint8Array } {
  const values = new Float32Array(rect.w * rect.h);
  const edge = new Uint8Array(rect.w * rect.h);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const k = y * rect.w + x;
      values[k] = lum[(rect.y + y) * width + rect.x + x];
      edge[k] = x === 0 || y === 0 || x === rect.w - 1 || y === rect.h - 1 ? 1 : 0;
    }
  }
  return { values, edge };
}

/**
 * Порог Оцу по яркости 0…1: делит пиксели на два класса с наибольшей разницей.
 * Для области с названием это «буквы» и «фон под ними».
 */
export function otsuThreshold(values: Float32Array): number {
  const bins = 256;
  const hist = new Float64Array(bins);
  for (const v of values) hist[Math.min(bins - 1, Math.floor(v * bins))]++;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < bins; i++) sumAll += i * hist[i];
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let bestBetween = -1;
  for (let i = 0; i < bins; i++) {
    weightB += hist[i];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += i * hist[i];
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) ** 2;
    if (between > bestBetween) {
      bestBetween = between;
      best = i;
    }
  }
  return (best + 1) / bins;
}

export type TwoTone = {
  /** Контраст средних яркостей двух классов. */
  ratio: number;
  /** 1 — «чернила» (буквы), 0 — фон. Фон — класс, который чаще лежит на краю рамки. */
  ink: Uint8Array;
  inkShare: number;
};

/** Делит область на буквы и фон и считает их контраст. */
export function twoTone(lum: Float32Array, width: number, rect: Rect): TwoTone {
  const { values, edge } = sampleRect(lum, width, rect);
  if (values.length === 0) return { ratio: 1, ink: new Uint8Array(0), inkShare: 0 };
  const t = otsuThreshold(values);
  let sumHi = 0;
  let nHi = 0;
  let sumLo = 0;
  let nLo = 0;
  let edgeHi = 0;
  let edgeTotal = 0;
  for (let k = 0; k < values.length; k++) {
    const hi = values[k] >= t;
    if (hi) {
      sumHi += values[k];
      nHi++;
    } else {
      sumLo += values[k];
      nLo++;
    }
    if (edge[k]) {
      edgeTotal++;
      if (hi) edgeHi++;
    }
  }
  if (nHi === 0 || nLo === 0) return { ratio: 1, ink: new Uint8Array(values.length), inkShare: 0 };
  const ratio = contrastRatio(sumHi / nHi, sumLo / nLo);
  // На краю рамки в основном фон: если светлых там больше половины — буквы тёмные.
  const inkIsHi = edgeHi / Math.max(1, edgeTotal) < 0.5;
  const ink = new Uint8Array(values.length);
  let inkCount = 0;
  for (let k = 0; k < values.length; k++) {
    const isInk = values[k] >= t === inkIsHi;
    ink[k] = isInk ? 1 : 0;
    inkCount += ink[k];
  }
  return { ratio, ink, inkShare: inkCount / values.length };
}

/** Контраст между двумя процентилями яркости в прямоугольнике: устойчив к обводкам и бликам. */
export function percentileContrast(lum: Float32Array, width: number, rect: Rect, lo: number, hi: number): number {
  const { values } = sampleRect(lum, width, rect);
  if (values.length === 0) return 1;
  const sorted = Float32Array.from(values).sort();
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return contrastRatio(at(lo), at(hi));
}

/**
 * Медианная толщина штриха в маске букв: для каждого пикселя буквы — меньшая из длин
 * горизонтальной и вертикальной серии, в которую он входит.
 */
export function medianStrokeWidth(ink: Uint8Array, w: number, h: number): number {
  const hRun = new Uint16Array(ink.length);
  const vRun = new Uint16Array(ink.length);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!ink[y * w + x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < w && ink[y * w + end]) end++;
      for (let i = x; i < end; i++) hRun[y * w + i] = end - x;
      x = end;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink[y * w + x]) {
        y++;
        continue;
      }
      let end = y;
      while (end < h && ink[end * w + x]) end++;
      for (let i = y; i < end; i++) vRun[i * w + x] = end - y;
      y = end;
    }
  }
  const widths: number[] = [];
  for (let k = 0; k < ink.length; k++) if (ink[k]) widths.push(Math.min(hRun[k], vRun[k]));
  if (widths.length === 0) return 0;
  widths.sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)];
}

/** Доля пикселей с сильным перепадом яркости (оператор Собеля), 0…1. */
export function edgeDensity(lum: Float32Array, width: number, height: number, threshold: number): number {
  if (width < 3 || height < 3) return 0;
  let strong = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = (dx: number, dy: number) => lum[(y + dy) * width + x + dx];
      const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
      if (Math.hypot(gx, gy) / 4 > threshold) strong++;
    }
  }
  return strong / ((width - 2) * (height - 2));
}

/**
 * Оттенки серого с растяжкой контраста по 1-му и 99-му процентилю — вход для распознавания текста.
 * Перцептивная яркость (Rec. 709 по sRGB), а не линейная: так видит буквы tesseract.
 */
export function grayStretch(img: RgbaImage): RgbaImage {
  const n = img.width * img.height;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const g = Math.round(0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]);
    gray[p] = g;
    hist[g]++;
  }
  const percentile = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= q * n) return v;
    }
    return 255;
  };
  const lo = percentile(0.01);
  const hi = Math.max(lo + 1, percentile(0.99));
  const out = createImage(img.width, img.height);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((gray[p] - lo) * 255) / (hi - lo))));
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  return out;
}
