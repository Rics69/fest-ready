import { createImage } from "./image.ts";
import type { RgbaImage } from "./types.ts";

/**
 * Масштабирование без canvas — одинаково в браузере (Web Worker) и в Node (тесты, калибровка).
 * Уменьшение — усреднением по площади: так же честно, как ресайз Steam, и без «ряби» на мелких размерах.
 * Увеличение — бикубическое (Catmull-Rom): нужно только для распознавания текста, а с размытым
 * билинейным tesseract терял слова («GAME OF THE YEAR» → «GAME oF», калибровка).
 */
export function resize(src: RgbaImage, width: number, height: number): RgbaImage {
  if (width === src.width && height === src.height) {
    return { width, height, data: new Uint8ClampedArray(src.data) };
  }
  if (width <= src.width && height <= src.height) return resizeArea(src, width, height);
  return resizeCubic(src, width, height);
}

/**
 * Обрезка по центру до нужных пропорций и масштабирование («cover»).
 * Нужна, когда человек проверяет не малую капсулу: показываем, как она выглядела бы в 462×174.
 */
export function resizeCover(src: RgbaImage, width: number, height: number): RgbaImage {
  const target = width / height;
  const current = src.width / src.height;
  let cw = src.width;
  let ch = src.height;
  if (current > target) cw = Math.round(src.height * target);
  else if (current < target) ch = Math.round(src.width / target);
  const cropped =
    cw === src.width && ch === src.height ? src : crop(src, (src.width - cw) >> 1, (src.height - ch) >> 1, cw, ch);
  return resize(cropped, width, height);
}

export function crop(src: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const out = createImage(w, h);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), row * w * 4);
  }
  return out;
}

/** Веса площадного усреднения по одной оси: для каждого выходного пикселя — список (источник, вес). */
function areaWeights(srcLen: number, dstLen: number): { start: Int32Array; count: Int32Array; weights: Float32Array } {
  const scale = srcLen / dstLen;
  const maxTaps = Math.ceil(scale) + 2;
  const start = new Int32Array(dstLen);
  const count = new Int32Array(dstLen);
  const weights = new Float32Array(dstLen * maxTaps);
  for (let i = 0; i < dstLen; i++) {
    const s0 = i * scale;
    const s1 = s0 + scale;
    const first = Math.floor(s0);
    const last = Math.min(srcLen - 1, Math.ceil(s1) - 1);
    start[i] = first;
    count[i] = last - first + 1;
    for (let j = first; j <= last; j++) {
      const overlap = Math.min(j + 1, s1) - Math.max(j, s0);
      weights[i * maxTaps + (j - first)] = overlap / scale;
    }
  }
  return { start, count, weights };
}

function resizeArea(src: RgbaImage, width: number, height: number): RgbaImage {
  // Сначала по горизонтали, потом по вертикали; промежуточный буфер — float.
  const hx = areaWeights(src.width, width);
  const tapsX = hx.weights.length / width;
  const mid = new Float32Array(width * src.height * 4);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let t = 0; t < hx.count[x]; t++) {
        const w = hx.weights[x * tapsX + t];
        const i = (y * src.width + hx.start[x] + t) * 4;
        r += src.data[i] * w;
        g += src.data[i + 1] * w;
        b += src.data[i + 2] * w;
        a += src.data[i + 3] * w;
      }
      const o = (y * width + x) * 4;
      mid[o] = r;
      mid[o + 1] = g;
      mid[o + 2] = b;
      mid[o + 3] = a;
    }
  }
  const vy = areaWeights(src.height, height);
  const tapsY = vy.weights.length / height;
  const out = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let t = 0; t < vy.count[y]; t++) {
        const w = vy.weights[y * tapsY + t];
        const i = ((vy.start[y] + t) * width + x) * 4;
        r += mid[i] * w;
        g += mid[i + 1] * w;
        b += mid[i + 2] * w;
        a += mid[i + 3] * w;
      }
      const o = (y * width + x) * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = a;
    }
  }
  return out;
}

/** Ядро Catmull-Rom (a = −0.5). */
function cubic(t: number): number {
  const x = Math.abs(t);
  if (x <= 1) return 1.5 * x ** 3 - 2.5 * x ** 2 + 1;
  if (x < 2) return -0.5 * x ** 3 + 2.5 * x ** 2 - 4 * x + 2;
  return 0;
}

/** Веса бикубической интерполяции по одной оси: 4 отсчёта на выходной пиксель. */
function cubicWeights(srcLen: number, dstLen: number): { index: Int32Array; weights: Float32Array } {
  const scale = srcLen / dstLen;
  const index = new Int32Array(dstLen * 4);
  const weights = new Float32Array(dstLen * 4);
  for (let i = 0; i < dstLen; i++) {
    const f = (i + 0.5) * scale - 0.5;
    const base = Math.floor(f);
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const j = base - 1 + k;
      index[i * 4 + k] = Math.max(0, Math.min(srcLen - 1, j));
      const w = cubic(f - j);
      weights[i * 4 + k] = w;
      sum += w;
    }
    for (let k = 0; k < 4; k++) weights[i * 4 + k] /= sum;
  }
  return { index, weights };
}

function resizeCubic(src: RgbaImage, width: number, height: number): RgbaImage {
  const hx = cubicWeights(src.width, width);
  const mid = new Float32Array(width * src.height * 4);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let k = 0; k < 4; k++)
          v += src.data[(y * src.width + hx.index[x * 4 + k]) * 4 + c] * hx.weights[x * 4 + k];
        mid[(y * width + x) * 4 + c] = v;
      }
    }
  }
  const vy = cubicWeights(src.height, height);
  const out = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let k = 0; k < 4; k++) v += mid[(vy.index[y * 4 + k] * width + x) * 4 + c] * vy.weights[y * 4 + k];
        out.data[(y * width + x) * 4 + c] = v; // Uint8ClampedArray сам обрежет выбросы ядра
      }
    }
  }
  return out;
}
