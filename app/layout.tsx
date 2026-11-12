import type { ReactNode } from "react";

// Настоящий корневой layout с <html> и <body> — в app/[locale]/layout.tsx.
// Этот файл нужен, чтобы работал app/not-found.tsx для адресов вне языковых разделов.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
