import { MARKETING_TEXT } from "../../data/check-rules.ts";
import { scaleRect, unionRects } from "./image.ts";
import type { OcrLine, Rect } from "./types.ts";

/** Минимальная форма ответа tesseract.js (blocks → paragraphs → lines → words), чтобы не тянуть его типы. */
type TessBbox = { x0: number; y0: number; x1: number; y1: number };
type TessWord = { text: string; confidence: number; bbox: TessBbox };
type TessLine = { text: string; confidence: number; bbox: TessBbox; words: TessWord[] };
export type TessPage = { blocks: { paragraphs: { lines: TessLine[] }[] }[] | null };

const toRect = (b: TessBbox, scale: number, offset: { x: number; y: number }): Rect => {
  const r = scaleRect({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }, scale);
  return { ...r, x: r.x + offset.x, y: r.y + offset.y };
};

/**
 * Строки tesseract → строки в координатах рабочего изображения.
 * scale = рабочее / распознаваемое; offset — где распознаваемый кусок лежит на капсуле.
 */
export function linesFromTesseract(page: TessPage, scale: number, offset = { x: 0, y: 0 }): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        lines.push({
          text: line.text.trim(),
          confidence: line.confidence,
          bbox: toRect(line.bbox, scale, offset),
          words: line.words.map((w) => ({
            text: w.text,
            confidence: w.confidence,
            bbox: toRect(w.bbox, scale, offset),
          })),
        });
      }
    }
  }
  return lines;
}

/** Нижний регистр, ё → е, дефисы и кавычки → пробел; оставляем буквы, цифры, %, /, точку и запятую. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-_–—'’`"«»]/g, " ")
    .replace(/[^a-zа-я0-9%/.,\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Совпадение с поправкой на одну ошибку распознавания — только для длинных слов («ISHLIST» → wishlist). */
function similar(token: string, target: string, fuzzyMinLength: number): boolean {
  if (token === target) return true;
  if (target.length < fuzzyMinLength || Math.abs(token.length - target.length) > 1) return false;
  return levenshtein(token, target) <= 1;
}

export type MarketingHit = { match: string; text: string; bbox: Rect };

export type MarketingOptions = {
  /** Хотя бы одно слово совпадения должно быть распознано с такой уверенностью. */
  minConfidence: number;
  /** Слова ниже этой уверенности не учитываем вовсе. */
  otherConfidence?: number;
  fuzzyMinLength?: number;
};

type Token = { text: string; word: number; start: number };

/**
 * Запрещённый текст: слова и фразы из словаря и шаблоны скидок и оценок.
 * Совпадение засчитываем, только если хотя бы одно его слово распознано уверенно, —
 * так мусор от стилизованных логотипов не превращается в ложные ошибки.
 */
export function findMarketingText(lines: OcrLine[], options: MarketingOptions): MarketingHit[] {
  const { minConfidence, otherConfidence = 0, fuzzyMinLength = 8 } = options;
  const hits: MarketingHit[] = [];

  for (const line of lines) {
    const words = line.words.filter((w) => w.confidence >= otherConfidence);
    const tokens: Token[] = [];
    let joined = "";
    words.forEach((w, word) => {
      for (const text of normalizeText(w.text).split(" ")) {
        if (!text) continue;
        if (joined) joined += " ";
        tokens.push({ text, word, start: joined.length });
        joined += text;
      }
    });
    if (tokens.length === 0) continue;

    let found: { match: string; from: number; to: number } | null = null;

    for (const phrase of MARKETING_TEXT.phrases) {
      const parts = phrase.split(" ");
      // Варианты фразы: целиком и — для фраз от четырёх слов — без одного слова:
      // tesseract теряет короткие слова («GAME THE YEAR» вместо «GAME OF THE YEAR»).
      // У фраз короче остаток слишком общий: «free to play» без «free» — это «to play» из названия игры.
      const variants = [
        parts,
        ...(parts.length >= 4 ? parts.map((_, skip) => parts.filter((__, j) => j !== skip)) : []),
      ];
      for (const variant of variants) {
        const k = variant.length;
        const target = variant.join(" ");
        const allowed = target.length >= 10 ? 2 : target.length >= 6 ? 1 : 0;
        for (let i = 0; !found && i + k <= tokens.length; i++) {
          const window = tokens
            .slice(i, i + k)
            .map((t) => t.text)
            .join(" ");
          if (window === target || (allowed > 0 && levenshtein(window, target) <= allowed)) {
            found = { match: phrase, from: i, to: i + k - 1 };
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    for (let i = 0; !found && i < tokens.length; i++) {
      const word = MARKETING_TEXT.words.find((w) => similar(tokens[i].text, w, fuzzyMinLength));
      if (word) found = { match: word, from: i, to: i };
    }

    for (const pattern of MARKETING_TEXT.patterns) {
      if (found) break;
      const m = pattern.exec(joined);
      if (!m) continue;
      const at = m.index;
      const end = at + m[0].length;
      const from = tokens.findIndex((t) => t.start + t.text.length > at);
      let to = from;
      while (to + 1 < tokens.length && tokens[to + 1].start < end) to++;
      found = { match: m[0].trim(), from, to };
    }

    if (!found) continue;
    const matched = [...new Set(tokens.slice(found.from, found.to + 1).map((t) => t.word))].map((i) => words[i]);
    if (Math.max(...matched.map((w) => w.confidence)) < minConfidence) continue;
    const bbox = unionRects(matched.map((w) => w.bbox))!;
    // Два прохода распознавания находят одну и ту же надпись — оставляем одну.
    if (hits.some((h) => intersects(h.bbox, bbox))) continue;
    hits.push({ match: found.match, text: matched.map((w) => w.text).join(" "), bbox });
  }
  return hits;
}

function overlapX(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
}

function intersects(a: Rect, b: Rect): boolean {
  return overlapX(a, b) > 0 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
}

const alnum = (s: string) => (s.match(/[a-zа-яё0-9]/gi) ?? []).length;

/**
 * Где на капсуле название. Опора — самая крупная строка, в которой хотя бы одно слово распознано уверенно
 * (название — самый крупный текст). К ней подклеиваем куски той же строки и строки над и под ней
 * похожего размера, даже если их распознало мусором: «HOLLO(92)» + «IGHT(46)», «Slay» + «the» + «pire».
 * Строки с запрещённым текстом названием не считаем. null — не нашли или не уверены: просим обвести вручную.
 */
export function pickTitleRegion(
  lines: OcrLine[],
  width: number,
  height: number,
  options: { minLineHeight: number; minWordConfidence: number; minWordLength: number },
  exclude: Rect[] = [],
): Rect | null {
  const usable = lines.filter((l) => l.bbox.w > 0 && l.bbox.h > 0 && !exclude.some((e) => intersects(e, l.bbox)));
  const anchors = usable.filter(
    (l) =>
      l.bbox.h >= options.minLineHeight * height &&
      l.bbox.w >= 0.08 * width &&
      // Стилизованный логотип tesseract «видит» мусором с низкой уверенностью — такой рамке не верим.
      l.words.some((w) => w.confidence >= options.minWordConfidence && alnum(w.text) >= options.minWordLength),
  );
  if (anchors.length === 0) return null;
  const anchor = anchors.reduce((a, b) => (b.bbox.w * b.bbox.h > a.bbox.w * a.bbox.h ? b : a));
  const h = anchor.bbox.h;
  let region = anchor.bbox;
  const taken = new Set<OcrLine>([anchor]);

  let grew = true;
  while (grew) {
    grew = false;
    for (const line of usable) {
      if (taken.has(line)) continue;
      const r = line.bbox;
      const ratio = r.h / h;
      const verticalOverlap = Math.min(r.y + r.h, region.y + region.h) - Math.max(r.y, region.y);
      const horizontalGap = r.x > region.x + region.w ? r.x - (region.x + region.w) : region.x - (r.x + r.w);
      const sameRow =
        verticalOverlap >= 0.5 * Math.min(r.h, h) && ratio >= 0.5 && ratio <= 1.6 && horizontalGap <= 3 * h;
      const verticalGap = r.y > region.y + region.h ? r.y - (region.y + region.h) : region.y - (r.y + r.h);
      const stacked =
        overlapX(r, region) >= 0.4 * Math.min(r.w, region.w) && verticalGap <= 0.5 * h && ratio >= 0.4 && ratio <= 1.6;
      const inside =
        r.x >= region.x && r.y >= region.y && r.x + r.w <= region.x + region.w && r.y + r.h <= region.y + region.h;
      if (sameRow || stacked || inside) {
        taken.add(line);
        region = unionRects([region, r])!;
        grew = true;
      }
    }
  }
  return region;
}
