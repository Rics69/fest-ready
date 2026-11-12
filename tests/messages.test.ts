import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import { routing } from "@/i18n/routing";

type Tree = { [key: string]: string | Tree };

/** Плоский список "a.b.c" → значение. */
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Плейсхолдеры ICU вида {year}. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}

const catalogs: Record<string, Map<string, string>> = {
  en: flatten(en),
  ru: flatten(ru),
};

describe("переводы", () => {
  it("есть файл для каждого языка", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...routing.locales].sort());
  });

  it("RU и EN содержат одинаковые ключи", () => {
    expect([...catalogs.ru.keys()].sort()).toEqual([...catalogs.en.keys()].sort());
  });

  it("нет пустых строк", () => {
    for (const [locale, catalog] of Object.entries(catalogs)) {
      for (const [key, value] of catalog) {
        expect(value.trim(), `${locale}: ${key}`).not.toBe("");
      }
    }
  });

  it("плейсхолдеры совпадают между языками", () => {
    for (const [key, value] of catalogs.en) {
      expect(placeholders(catalogs.ru.get(key) ?? ""), key).toEqual(placeholders(value));
    }
  });
});
