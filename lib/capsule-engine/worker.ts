/**
 * Web Worker движка капсул: декодирует файл, считает проверки и готовит картинки для показа и распознавания.
 * Тяжёлое (4K-арт, масштабирование) идёт здесь, интерфейс не замирает. Файл никуда не отправляется.
 */
import { analyzeBase, analyzeText, type BaseAnalysis } from "./analyze.ts";
import type { Pixels, WorkerRequest, WorkerResponse } from "./protocol.ts";
import type { RgbaImage } from "./types.ts";

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};
const scope = self as unknown as WorkerScope;

/** Последний загруженный файл — для пересчёта, когда человек обводит название. */
let current: { id: number; base: BaseAnalysis } | null = null;

/** Прозрачные места Steam покажет на тёмном фоне — так и проверяем. */
const BACKDROP = "#16181d";

async function decode(file: File): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width, height, data };
}

async function toPng(img: RgbaImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

const copy = (img: RgbaImage): Pixels => ({
  width: img.width,
  height: img.height,
  data: new Uint8ClampedArray(img.data),
});

scope.onmessage = async (event) => {
  const message = event.data;
  if (message.type === "load") {
    const started = performance.now();
    let image: RgbaImage;
    try {
      image = await decode(message.file);
    } catch {
      scope.postMessage({ type: "error", id: message.id, code: "decode" });
      return;
    }
    try {
      const head = new Uint8Array(await message.file.slice(0, 8).arrayBuffer());
      const base = analyzeBase(image, { head, size: message.file.size });
      current = { id: message.id, base };
      const ocrImages = await Promise.all(
        base.ocrInputs.map(async ({ image, offset, scale, psm }) => ({ blob: await toPng(image), offset, scale, psm })),
      );
      scope.postMessage({
        type: "base",
        id: message.id,
        source: { width: image.width, height: image.height },
        work: copy(base.work),
        previews: base.previews.map(copy),
        checks: base.checks,
        ocrImages,
        ms: Math.round(performance.now() - started),
      });
    } catch {
      scope.postMessage({ type: "error", id: message.id, code: "internal" });
    }
    return;
  }

  if (message.type === "text") {
    if (!current || current.id !== message.id) return;
    const text = analyzeText(current.base, message.lines, message.region);
    scope.postMessage({ type: "text", id: message.id, region: text.region, checks: text.checks });
  }
};
