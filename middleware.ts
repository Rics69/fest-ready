import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Только выбор языка: / → /ru или /en по браузеру и cookie.
//
// Почему middleware.ts, а не proxy.ts: в Next.js 16 proxy работает только в Node.js-рантайме,
// а его поддержка в OpenNext для Cloudflare экспериментальная. Edge-middleware OpenNext
// поддерживает штатно. Предупреждение Next.js об устаревшем имени при сборке — ожидаемо.
export default createMiddleware(routing);

export const config = {
  // Всё, кроме API, служебных путей Next.js и файлов с расширением.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
