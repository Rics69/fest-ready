"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { track } from "@/lib/analytics";
import { sortChecks, topProblem } from "@/lib/capsule-engine/analyze";
import { recognizeLines, warmUpOcr } from "@/lib/capsule-engine/ocr";
import type { WorkerRequest, WorkerResponse } from "@/lib/capsule-engine/protocol";
import type { CheckResult, OcrLine, Rect } from "@/lib/capsule-engine/types";
import { CheckList, OutlineLayer, PixelsCanvas, RegionBox, Spinner, SteamStrip, Summary, order } from "./parts";

type Base = Extract<WorkerResponse, { type: "base" }>;
type Result = {
  id: number;
  base: Base;
  text: { region: Rect | null; checks: CheckResult[] } | null;
  regionSource: "auto" | "manual" | null;
  ocr: "running" | "done" | "failed";
};
type View =
  | { kind: "idle" }
  | { kind: "decoding"; id: number }
  | { kind: "error"; code: "decode" | "internal" }
  | { kind: "ready"; result: Result };

const count = (checks: CheckResult[], level: CheckResult["level"]) => checks.filter((c) => c.level === level).length;

/**
 * Бесплатный тест капсулы на главной. Файл обрабатывается только в браузере:
 * декодирование и проверки — в Web Worker движка, распознавание текста — в воркере tesseract.js.
 */
export function CapsuleTest() {
  const t = useTranslations("capsuleTest");
  const [view, setView] = useState<View>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [outlining, setOutlining] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const linesRef = useRef<OcrLine[]>([]);
  const manualRef = useRef(false);
  const startedRef = useRef(0);
  const trackedRef = useRef(0);

  const patch = useCallback((id: number, change: (r: Result) => Result) => {
    setView((v) => (v.kind === "ready" && v.result.id === id ? { kind: "ready", result: change(v.result) } : v));
  }, []);

  const report = useCallback((base: Base, textChecks: CheckResult[], ocr: "done" | "failed", region: boolean) => {
    if (trackedRef.current === base.id) return;
    trackedRef.current = base.id;
    const all = [...base.checks, ...textChecks];
    track("capsule_test", {
      size: String(base.checks.find((c) => c.id === "dimensions")?.code ?? ""),
      errors: count(all, "error"),
      warnings: count(all, "warning"),
      advice: count(all, "advice"),
      ocr,
      title: region,
      ms: Math.round(performance.now() - startedRef.current),
    });
  }, []);

  const post = useCallback((message: WorkerRequest) => workerRef.current?.postMessage(message), []);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../../lib/capsule-engine/worker.ts", import.meta.url), { type: "module" });
    let lastBase: Base | null = null;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.id !== idRef.current) return; // ответ по старому файлу

      if (msg.type === "error") {
        setView({ kind: "error", code: msg.code });
        return;
      }

      if (msg.type === "base") {
        lastBase = msg;
        setView({ kind: "ready", result: { id: msg.id, base: msg, text: null, regionSource: null, ocr: "running" } });
        recognizeLines(msg.ocrImages).then(
          (lines) => {
            if (msg.id !== idRef.current) return;
            linesRef.current = lines;
            // Отладка калибровки в dev: что именно распознал tesseract.
            if (process.env.NODE_ENV !== "production")
              (window as unknown as { __ocrLines: OcrLine[] }).__ocrLines = lines;
            patch(msg.id, (r) => ({ ...r, ocr: "done" }));
            post({ type: "text", id: msg.id, lines });
          },
          () => {
            if (msg.id !== idRef.current) return;
            patch(msg.id, (r) => ({ ...r, ocr: "failed" }));
            report(msg, [], "failed", false);
          },
        );
        return;
      }

      if (msg.type === "text") {
        const source = manualRef.current ? "manual" : msg.region ? "auto" : null;
        patch(msg.id, (r) => ({ ...r, text: { region: msg.region, checks: msg.checks }, regionSource: source }));
        if (lastBase && !manualRef.current) report(lastBase, msg.checks, "done", Boolean(msg.region));
      }
    };
    workerRef.current = worker;
    return worker;
  }, [patch, post, report]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const id = ++idRef.current;
      linesRef.current = [];
      manualRef.current = false;
      startedRef.current = performance.now();
      setOutlining(false);
      setView({ kind: "decoding", id });
      void warmUpOcr().catch(() => {});
      getWorker().postMessage({ type: "load", id, file } satisfies WorkerRequest);
    },
    [getWorker],
  );

  // Вставка из буфера обмена: скопировал капсулу в редакторе — Ctrl+V на странице.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) handleFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    if (!dragging) {
      setDragging(true);
      void warmUpOcr().catch(() => {});
    }
  };
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const submitRegion = (region: Rect) => {
    if (view.kind !== "ready") return;
    manualRef.current = true;
    setOutlining(false);
    post({ type: "text", id: view.result.id, lines: linesRef.current, region });
  };

  const reset = () => {
    idRef.current++;
    setOutlining(false);
    setView({ kind: "idle" });
  };

  const result = view.kind === "ready" ? view.result : null;
  const visible = result
    ? sortChecks([...result.base.checks, ...(result.text?.checks ?? [])]).filter(
        // Без распознавания про лишний текст ничего сказать нельзя — не показываем «не нашли».
        (c) => !(c.id === "extraText" && result.ocr === "failed"),
      )
    : [];
  const extraTextRegion = result?.text?.checks.find((c) => c.id === "extraText" && c.region)?.region;
  const pending = result && result.ocr !== "failed" && !result.text;

  return (
    <section
      id="test"
      aria-labelledby="test-title"
      className="mx-auto max-w-5xl scroll-mt-20 px-4 pb-24"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <h2 id="test-title" className="text-xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-pretty text-muted">{t("lead")}</p>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,462px)_minmax(0,1fr)] lg:items-start">
          {/* Левая колонка: зона загрузки или сама капсула 462×174 */}
          <div>
            {result ? (
              <>
                <div className="relative w-full max-w-[462px] overflow-hidden rounded-md ring-1 ring-border-strong">
                  <PixelsCanvas pixels={result.base.work} className="block h-auto w-full" />
                  {!outlining && result.text?.region && <RegionBox rect={result.text.region} tone="title" />}
                  {!outlining && extraTextRegion && <RegionBox rect={extraTextRegion} tone="text" />}
                  {outlining && <OutlineLayer onDone={submitRegion} onCancel={() => setOutlining(false)} />}
                  {dragging && (
                    <div className="absolute inset-0 grid place-items-center bg-accent/20 text-sm font-medium">
                      {t("dropActive")}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {outlining ? (
                    <>
                      <span className="text-sm text-muted">{t("outlineHint")}</span>
                      <button
                        type="button"
                        onClick={() => setOutlining(false)}
                        className="press text-sm text-accent hover:text-accent-hover"
                      >
                        {t("outlineCancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setOutlining(true)}
                        className="press inline-flex min-h-9 items-center rounded-lg border border-border-strong px-3 text-sm hover:border-subtle"
                      >
                        {result.text?.region ? t("outlineAgain") : t("outline")}
                      </button>
                      <button type="button" onClick={reset} className="press text-sm text-muted hover:text-foreground">
                        {t("another")}
                      </button>
                      {(result.text?.region || extraTextRegion) && (
                        <span className="flex items-center gap-3 text-xs text-subtle">
                          {result.text?.region && (
                            <span className="inline-flex items-center gap-1.5">
                              <span aria-hidden className="size-2 rounded-[2px] border-2 border-ok" />
                              {t("legendTitle")}
                            </span>
                          )}
                          {extraTextRegion && (
                            <span className="inline-flex items-center gap-1.5">
                              <span aria-hidden className="size-2 rounded-[2px] border-2 border-stop" />
                              {t("legendText")}
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <label
                onPointerEnter={() => void warmUpOcr().catch(() => {})}
                className={
                  "group relative flex aspect-[462/174] w-full max-w-[462px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 text-center transition-[background-color,border-color] duration-150 ease-out focus-within:border-accent " +
                  (dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-background hover:border-subtle")
                }
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onFocus={() => void warmUpOcr().catch(() => {})}
                  onChange={(e) => {
                    handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {view.kind === "decoding" ? (
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <Spinner />
                    {t("decoding")}
                  </span>
                ) : (
                  <>
                    <span className="text-[15px] font-medium">{dragging ? t("dropActive") : t("drop")}</span>
                    <span className="text-sm text-accent group-hover:text-accent-hover">{t("choose")}</span>
                    <span className="mt-1 text-xs text-subtle">{t("formats")}</span>
                  </>
                )}
              </label>
            )}
            {view.kind === "error" && (
              <p role="alert" className="mt-3 text-sm text-stop">
                {t("decodeError")}
              </p>
            )}
          </div>

          {/* Правая колонка: как это увидят в Steam */}
          <SteamStrip previews={result?.base.previews ?? null} />
        </div>

        {result && (
          <div key={result.id} className="mt-8 grid gap-5" aria-live="polite">
            <Summary
              top={pending ? topProblem(result.base.checks) : topProblem(visible)}
              hasAdvice={visible.some((c) => c.level === "advice")}
            />
            <div className="rounded-xl border border-border px-5 py-2">
              <CheckList checks={visible} />
              {pending && (
                <div
                  className="rise-in flex items-start gap-3 border-t border-border py-3.5"
                  style={order(visible.length)}
                >
                  <span className="mt-[3px]">
                    <Spinner />
                  </span>
                  <div className="text-sm">
                    <p className="text-muted">{t("ocrPending")}</p>
                    {/* Появляется, только если ждать дольше пары секунд — в первый раз грузятся модели. */}
                    <p className="rise-in text-xs text-subtle" style={{ animationDelay: "2.5s" }}>
                      {t("ocrFirstLoad")}
                    </p>
                  </div>
                </div>
              )}
              {result.ocr === "failed" && (
                <p className="border-t border-border py-3.5 text-sm text-muted">{t("ocrFailed")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
