"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Pixels } from "@/lib/capsule-engine/protocol";
import type { CheckResult, Level, Rect } from "@/lib/capsule-engine/types";
import { SMALL_CAPSULE_PREVIEWS } from "@/data/steam-assets";

export const WORK_W = 462;
export const WORK_H = 174;

/** Порядковый номер в появлении (см. .rise-in в globals.css). */
export const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** Картинка из воркера → canvas в натуральных пикселях. */
export function PixelsCanvas({
  pixels,
  className,
  style,
}: {
  pixels: Pixels;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }, [pixels]);
  return <canvas ref={ref} width={pixels.width} height={pixels.height} className={className} style={style} />;
}

/** Условная капсула, пока файла нет: видно, как быстро мельчает название. */
function PlaceholderCapsule({ w, h }: { w: number; h: number }) {
  const t = useTranslations("capsuleTest");
  return (
    <div
      className="flex items-center overflow-hidden rounded-[3px] bg-gradient-to-br from-[#2b2f5a] via-[#1d2036] to-[#3a2340]"
      style={{ width: w, height: h }}
    >
      <span
        className="pl-[8%] leading-none font-semibold tracking-tight text-white/85"
        style={{ fontSize: Math.round(w * 0.085) }}
      >
        {t("placeholder")}
      </span>
    </div>
  );
}

/** Полоса «как в Steam»: три размера показа малой капсулы в настоящих CSS-пикселях, на тёмном фоне магазина. */
export function SteamStrip({ previews }: { previews: Pixels[] | null }) {
  const t = useTranslations("capsuleTest");
  return (
    <div className="rounded-xl bg-[#11151c] p-5 ring-1 ring-border sm:p-6">
      <p className="text-sm text-muted">{t("inSteam")}</p>
      <ul className="mt-5 flex flex-wrap items-end gap-x-7 gap-y-5">
        {SMALL_CAPSULE_PREVIEWS.map(([w, h], i) => (
          <li key={w} className="flex flex-col gap-2">
            {previews?.[i] ? (
              <PixelsCanvas pixels={previews[i]} className="rounded-[3px]" style={{ width: w, height: h }} />
            ) : (
              <PlaceholderCapsule w={w} h={h} />
            )}
            <span className="font-mono text-xs text-subtle">
              {w}×{h}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Рамка поверх капсулы 462×174 в процентах — растягивается вместе с картинкой. */
export function RegionBox({ rect, tone }: { rect: Rect; tone: "title" | "text" }) {
  return (
    <span
      aria-hidden
      className={
        "pointer-events-none absolute rounded-[2px] border-2 " +
        (tone === "title"
          ? "border-ok shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
          : "border-stop shadow-[0_0_0_1px_rgb(0_0_0/0.5)]")
      }
      style={{
        left: pct(rect.x, WORK_W),
        top: pct(rect.y, WORK_H),
        width: pct(rect.w, WORK_W),
        height: pct(rect.h, WORK_H),
      }}
    />
  );
}

/** Слой, на котором человек обводит название. Esc — отмена. */
export function OutlineLayer({ onDone, onCancel }: { onDone: (rect: Rect) => void; onCancel: () => void }) {
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const toWork = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
    return {
      x: clamp(((e.clientX - box.left) / box.width) * WORK_W, WORK_W),
      y: clamp(((e.clientY - box.top) / box.height) * WORK_H, WORK_H),
    };
  };

  const rect = drag && {
    x: Math.min(drag.x0, drag.x1),
    y: Math.min(drag.y0, drag.y1),
    w: Math.abs(drag.x1 - drag.x0),
    h: Math.abs(drag.y1 - drag.y0),
  };

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none bg-black/35"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toWork(e);
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = toWork(e);
        setDrag({ ...drag, x1: p.x, y1: p.y });
      }}
      onPointerUp={() => {
        if (rect && rect.w >= 8 && rect.h >= 6) onDone(rect);
        setDrag(null);
      }}
    >
      {rect && (
        <span
          className="pointer-events-none absolute rounded-[2px] border-2 border-dashed border-accent bg-accent/10"
          style={{
            left: pct(rect.x, WORK_W),
            top: pct(rect.y, WORK_H),
            width: pct(rect.w, WORK_W),
            height: pct(rect.h, WORK_H),
          }}
        />
      )}
    </div>
  );
}

const DOT: Record<Level, string> = {
  ok: "bg-ok",
  advice: "bg-accent",
  warning: "bg-warn",
  error: "bg-stop",
};

const BORDER: Record<Level, string> = {
  ok: "border-ok",
  advice: "border-accent",
  warning: "border-warn",
  error: "border-stop",
};

/** Текст проверки: заголовок и сообщение с параметрами из messages → capsuleTest.checks. */
export function useCheckText() {
  const t = useTranslations("capsuleTest.checks");
  return (check: CheckResult) => ({
    // Ключи собираются из id и code движка — набор закрыт типами и тестом messages.
    title: t(`${check.id}.title` as never),
    message: t(`${check.id}.${check.code}` as never, check.params as never),
  });
}

export function Summary({ top, hasAdvice }: { top: CheckResult | null; hasAdvice: boolean }) {
  const t = useTranslations("capsuleTest");
  const text = useCheckText();
  if (!top) {
    return (
      <div className="rise-in rounded-xl border-l-2 border-ok bg-surface px-5 py-4">
        <p className="text-[15px] font-medium">{hasAdvice ? t("summaryOkAdvice") : t("summaryOk")}</p>
      </div>
    );
  }
  const { title, message } = text(top);
  return (
    <div className={`rise-in rounded-xl border-l-2 bg-surface px-5 py-4 ${BORDER[top.level]}`}>
      <p className="text-xs text-subtle">
        {t("summaryProblem")} · {t(`levels.${top.level}`)}
      </p>
      <p className="mt-1 text-[15px] font-medium">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
    </div>
  );
}

export function CheckList({ checks }: { checks: CheckResult[] }) {
  const t = useTranslations("capsuleTest");
  const text = useCheckText();
  return (
    <ul>
      {checks.map((check, i) => {
        const { title, message } = text(check);
        return (
          <li
            key={check.id}
            className="rise-in flex gap-3 border-t border-border py-3.5 first:border-t-0"
            style={order(i)}
          >
            <span aria-hidden className={`mt-[7px] size-2 shrink-0 rounded-full ${DOT[check.level]}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {title}
                <span className="sr-only"> — {t(`levels.${check.level}`)}</span>
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-pretty break-words text-muted">{message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-border-strong border-t-accent [animation-duration:700ms]"
    />
  );
}
