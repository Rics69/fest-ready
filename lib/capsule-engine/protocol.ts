import type { CheckResult, OcrLine, Rect } from "./types.ts";

/** Сообщения между страницей и Web Worker движка капсул. */

export type WorkerRequest =
  { type: "load"; id: number; file: File } | { type: "text"; id: number; lines: OcrLine[]; region?: Rect };

/** Картинка, которую страница рисует через putImageData. */
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

export type WorkerResponse =
  | {
      type: "base";
      id: number;
      /** Размер исходного файла в пикселях. */
      source: { width: number; height: number };
      /** Капсула 462×174, на которой считаются проверки. */
      work: Pixels;
      /** 231×87, 184×69, 120×45. */
      previews: Pixels[];
      checks: CheckResult[];
      /** PNG для распознавания текста и где каждый кусок лежит на капсуле. */
      ocrImages: { blob: Blob; offset: { x: number; y: number }; scale: number; psm: string }[];
      ms: number;
    }
  | { type: "text"; id: number; region: Rect | null; checks: CheckResult[] }
  | { type: "error"; id: number; code: "decode" | "internal" };
