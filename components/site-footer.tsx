import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-subtle sm:flex-row sm:justify-between">
        <p>{t("disclaimer")}</p>
        <p className="font-mono text-xs">© 2026 FestReady</p>
      </div>
    </footer>
  );
}
