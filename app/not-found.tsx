import Link from "next/link";
import "./globals.css";

// 404 для адресов вне /ru и /en. Языковой layout здесь не работает, поэтому свой <html>.
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-4 font-sans">
        <main className="text-center">
          <p className="font-mono text-sm text-subtle">404</p>
          <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
          <p className="mt-6 flex justify-center gap-6">
            <Link className="text-accent hover:underline" href="/en">
              Home
            </Link>
            <Link className="text-accent hover:underline" href="/ru" lang="ru">
              На главную
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
