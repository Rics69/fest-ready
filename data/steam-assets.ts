/**
 * Графические ассеты Steam, которые собирает Capsule Kit.
 * Сверено со Steamworks 12.11.2026:
 *   https://partner.steamgames.com/doc/store/assets/standard
 *   https://partner.steamgames.com/doc/store/assets/libraryassets
 *
 * Если Valve поменяет требования — правим здесь, а не в коде движка.
 */

export type AssetId =
  | "header"
  | "small"
  | "main"
  | "vertical"
  | "pageBackground"
  | "libraryCapsule"
  | "libraryHeader"
  | "libraryHero"
  | "libraryLogo";

export type SteamAsset = {
  id: AssetId;
  /** Точный размер файла, который ждёт Steamworks. Для libraryLogo — рамка, в которую логотип вписывается. */
  w: number;
  h: number;
  /** На ассете должен быть логотип (название игры). */
  logo: boolean;
  /** Ассет — только логотип на прозрачном фоне. */
  logoOnly?: boolean;
  /** Необязательный ассет. */
  optional?: boolean;
  /** Формат файла, если Steam требует конкретный. Иначе PNG или JPG на выбор. */
  format?: "png";
  transparent?: boolean;
  /** Логотип вписывается в рамку: «1280 px в ширину и/или 720 px в высоту». */
  fitWithin?: boolean;
  /** Центральная безопасная зона, которая не обрезается при любом размере окна клиента. */
  safeArea?: readonly [number, number];
  /** Размеры, в которых Steam показывает ассет (генерирует сам из загруженного). */
  previews?: readonly (readonly [number, number])[];
  /**
   * Мягкий лимит веса файла, МБ. В документации Steamworks лимита нет —
   * цифра 2 МБ из сторонних валидаторов (см. docs/decisions.md), поэтому это предупреждение, а не ошибка.
   */
  softMaxMB?: number;
};

export const ASSETS = [
  { id: "header", w: 920, h: 430, logo: true, softMaxMB: 2 },
  {
    id: "small",
    w: 462,
    h: 174,
    logo: true,
    softMaxMB: 2,
    // 120×45 и 184×69 Steamworks генерирует сам; 231×87 — половина исходника, его показывают списки магазина.
    previews: [
      [231, 87],
      [184, 69],
      [120, 45],
    ],
  },
  { id: "main", w: 1232, h: 706, logo: true, softMaxMB: 2 },
  { id: "vertical", w: 748, h: 896, logo: true, softMaxMB: 2 },
  { id: "pageBackground", w: 1438, h: 810, logo: false, optional: true },
  { id: "libraryCapsule", w: 600, h: 900, logo: true },
  { id: "libraryHeader", w: 920, h: 430, logo: true },
  { id: "libraryHero", w: 3840, h: 1240, logo: false, format: "png", safeArea: [860, 380] },
  {
    id: "libraryLogo",
    w: 1280,
    h: 720,
    logo: true,
    logoOnly: true,
    format: "png",
    transparent: true,
    fitWithin: true,
  },
] as const satisfies readonly SteamAsset[];

export function getAsset(id: AssetId): SteamAsset {
  const asset = ASSETS.find((a) => a.id === id);
  if (!asset) throw new Error(`Unknown Steam asset: ${id}`);
  return asset;
}

/** Размеры малой капсулы, в которых проверяем читаемость (от крупного к мелкому). */
export const SMALL_CAPSULE_PREVIEWS = getAsset("small").previews!;
