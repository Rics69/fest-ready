"use client";

import Script from "next/script";
import { useEffect } from "react";
import { rememberRef } from "@/lib/analytics";

/** Токен Cloudflare Web Analytics (дашборд → Web Analytics → сайт → JS snippet). Нет токена — без счётчика. */
const BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

/** Один на страницу: запоминает ?ref= первого визита и подключает счётчик посещений Cloudflare (без cookie). */
export function Analytics() {
  useEffect(() => {
    rememberRef();
  }, []);

  if (!BEACON_TOKEN) return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: BEACON_TOKEN })}
      strategy="afterInteractive"
    />
  );
}
