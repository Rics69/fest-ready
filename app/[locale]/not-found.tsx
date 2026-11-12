import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");

  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-sm text-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t("title")}</h1>
      <Link href="/" className="press mt-6 inline-block text-accent hover:underline">
        {t("back")}
      </Link>
    </section>
  );
}
