import type { CSSProperties } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/landing/countdown";
import { CapsuleSizes } from "@/components/landing/capsule-sizes";
import { routing } from "@/i18n/routing";

/** Порядковый номер в появлении первого экрана (см. .rise-in в globals.css). */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Главная фазы 0: обещание, таймер до дедлайна и наглядно — в каком размере Steam показывает капсулу.
 * Тест капсулы встанет сюда в фазе 1, остальные блоки лендинга — в фазе 2.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:pt-24">
        <p className="rise-in font-mono text-xs tracking-[0.14em] text-subtle uppercase" style={order(0)}>
          {t("eyebrow")}
        </p>
        <h1
          className="rise-in mt-5 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl"
          style={order(1)}
        >
          {t("titleLead")} <span className="text-muted">{t("titleTail")}</span>
        </h1>
        <p className="rise-in mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted" style={order(2)}>
          {t("subtitle")}
        </p>
        <div className="rise-in mt-8 flex flex-wrap items-center gap-3" style={order(3)}>
          <Countdown />
          <span className="text-sm text-subtle">{t("soon")}</span>
        </div>
      </section>

      <section aria-labelledby="sizes-title" className="mx-auto max-w-5xl px-4 pb-24">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-10">
          <h2 id="sizes-title" className="text-lg font-medium">
            {t("sizes.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t("sizes.body")}</p>
          <CapsuleSizes />
        </div>
      </section>
    </>
  );
}
