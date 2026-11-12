import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Обёртки над навигацией Next.js, которые сами подставляют префикс языка.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
