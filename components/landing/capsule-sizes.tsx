import { useTranslations } from "next-intl";
import { SMALL_CAPSULE_PREVIEWS } from "@/data/steam-assets";

/**
 * Три размера, в которых Steam показывает малую капсулу, — в настоящих CSS-пикселях.
 * Внутри — условная капсула, чтобы было видно, как быстро мельчает название.
 */
export function CapsuleSizes() {
  const t = useTranslations("home.sizes");

  return (
    <ul className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-6">
      {SMALL_CAPSULE_PREVIEWS.map(([w, h]) => (
        <li key={w} className="flex flex-col gap-2.5">
          <div
            className="relative flex items-center overflow-hidden rounded-[3px] bg-gradient-to-br from-[#2b2f5a] via-[#1d2036] to-[#3a2340] ring-1 ring-border-strong"
            style={{ width: w, height: h }}
          >
            <span
              className="pl-[8%] leading-none font-semibold tracking-tight text-white/90"
              style={{ fontSize: Math.round(w * 0.085) }}
            >
              {t("placeholder")}
            </span>
          </div>
          <span className="font-mono text-xs text-subtle">
            {w}×{h}
          </span>
        </li>
      ))}
    </ul>
  );
}
