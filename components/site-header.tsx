import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader() {
  const t = useTranslations("header");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label={t("home")} className="press flex min-h-11 items-center gap-2.5 rounded-md">
          {/* Знак — силуэт малой капсулы 462×174. */}
          <span aria-hidden className="h-[9px] w-6 rounded-[3px] bg-accent" />
          <span className="text-[17px] font-semibold tracking-tight">FestReady</span>
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
