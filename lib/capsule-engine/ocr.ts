/**
 * Распознавание текста в браузере (tesseract.js). Свой Web Worker у tesseract.js, поэтому страница не тормозит.
 * Ядро и модели — со своего домена (scripts/copy-tesseract.mjs). Модели после первой загрузки лежат в IndexedDB.
 */
import { CHECK_RULES } from "../../data/check-rules.ts";
import { OCR_SCALE } from "./analyze.ts";
import { linesFromTesseract, type TessPage } from "./text.ts";
import type { OcrLine } from "./types.ts";

type TessWorker = {
  setParameters(params: Record<string, string>): Promise<unknown>;
  recognize(image: Blob, options: object, output: { blocks: boolean; text: boolean }): Promise<{ data: TessPage }>;
};

const BASE = "/vendor/tesseract";
/** Английский и русский вместе — так калибровали проверки (`npm run calibrate`). */
const LANGS = ["eng", "rus"];

let ready: Promise<TessWorker> | null = null;

/** Начать загрузку заранее — например, когда человек тащит файл к зоне теста. Повторный вызов ничего не делает. */
export function warmUpOcr(): Promise<TessWorker> {
  ready ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = (await createWorker(LANGS, 1, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: `${BASE}/core`,
      langPath: `${BASE}/lang`,
      workerBlobURL: false,
    })) as unknown as TessWorker;
    await worker.setParameters({ tessedit_pageseg_mode: "11", user_defined_dpi: String(CHECK_RULES.ocr.dpi) });
    return worker;
  })();
  ready.catch(() => {
    ready = null; // следующая попытка начнёт заново
  });
  return ready;
}

/** Строки текста со всех проходов, в координатах капсулы 462×174. */
export async function recognizeLines(images: { blob: Blob; offset: { x: number; y: number } }[]): Promise<OcrLine[]> {
  const worker = await warmUpOcr();
  const lines: OcrLine[] = [];
  for (const { blob, offset } of images) {
    const { data } = await worker.recognize(blob, {}, { blocks: true, text: false });
    lines.push(...linesFromTesseract(data, 1 / OCR_SCALE, offset));
  }
  return lines;
}
