import { describe, expect, it } from "vitest";
import { ASSETS, SMALL_CAPSULE_PREVIEWS, getAsset } from "@/data/steam-assets";

describe("конфиг ассетов Steam", () => {
  it("девять ассетов, у каждого свой id", () => {
    expect(ASSETS).toHaveLength(9);
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(9);
  });

  it("размеры совпадают со Steamworks", () => {
    const sizes = Object.fromEntries(ASSETS.map((a) => [a.id, `${a.w}x${a.h}`]));
    expect(sizes).toEqual({
      header: "920x430",
      small: "462x174",
      main: "1232x706",
      vertical: "748x896",
      pageBackground: "1438x810",
      libraryCapsule: "600x900",
      libraryHeader: "920x430",
      libraryHero: "3840x1240",
      libraryLogo: "1280x720",
    });
  });

  it("превью малой капсулы сохраняют её пропорции (±1 px) и идут от крупного к мелкому", () => {
    const small = getAsset("small");
    let prevWidth = Infinity;
    for (const [w, h] of SMALL_CAPSULE_PREVIEWS) {
      expect(Math.abs(Math.round((w * small.h) / small.w) - h)).toBeLessThanOrEqual(1);
      expect(w).toBeLessThan(prevWidth);
      prevWidth = w;
    }
  });

  it("безопасная зона hero помещается в hero", () => {
    const hero = getAsset("libraryHero");
    const [w, h] = hero.safeArea!;
    expect(w).toBeLessThanOrEqual(hero.w);
    expect(h).toBeLessThanOrEqual(hero.h);
  });
});
