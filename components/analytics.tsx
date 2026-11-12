"use client";

import { useEffect } from "react";
import { rememberRef } from "@/lib/analytics";
import { CF_BEACON_TOKEN, SITE_URL } from "@/lib/site";

/**
 * Один на страницу: запоминает ?ref= первого визита и подключает счётчик посещений Cloudflare Web Analytics
 * (без cookie). Счётчик — только на боевом адресе: localhost и превью-сборки статистику не портят.
 */
export function Analytics() {
  useEffect(() => {
    rememberRef();
    if (!CF_BEACON_TOKEN || location.hostname !== new URL(SITE_URL).hostname) return;
    if (document.querySelector("script[data-cf-beacon]")) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_BEACON_TOKEN }));
    document.body.appendChild(script);
  }, []);

  return null;
}
