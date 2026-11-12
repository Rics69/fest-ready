/**
 * Типы движка капсул. Движок работает с сырыми RGBA-буферами и не знает ни про canvas, ни про Next.js:
 * в браузере его кормит Web Worker, в Node — sharp (тесты и калибровка).
 */

export type RgbaImage = {
  width: number;
  height: number;
  /** RGBA, 4 байта на пиксель, построчно. */
  data: Uint8ClampedArray;
};

/** Прямоугольник в пикселях рабочего изображения 462×174. */
export type Rect = { x: number; y: number; w: number; h: number };

/** От безобидного к серьёзному. Ошибка — Valve отклонит; предупреждение — вредит кликам; совет — стоит подумать. */
export type Level = "ok" | "advice" | "warning" | "error";

export type CheckId =
  "dimensions" | "format" | "weight" | "extraText" | "logoWidth" | "contrast" | "readability" | "details";

export type CheckResult = {
  id: CheckId;
  level: Level;
  /** Вариант текста: messages → capsuleTest.checks.<id>.<code>. */
  code: string;
  params?: Record<string, string | number>;
  /** Где проблема — рисуем рамку на капсуле. */
  region?: Rect;
};

/** Слово из распознавания, координаты — в пикселях рабочего изображения. */
export type OcrWord = { text: string; confidence: number; bbox: Rect };
export type OcrLine = { text: string; confidence: number; bbox: Rect; words: OcrWord[] };

export type FileInfo = {
  /** Первые байты файла — по ним определяем настоящий формат, а не по расширению. */
  head: Uint8Array;
  size: number;
};
