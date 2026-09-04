"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const PROJECT_NAME = "vulncascade";
const VISITOR_ID_KEY = "pm_anonymous_visitor_id_v1";
const SENT_FLAG = "__pm_page_view_sent_v1";

declare global {
  interface Window {
    __pm_page_view_sent_v1?: Record<string, true>;
  }
}

function getVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)
        );

  localStorage.setItem(VISITOR_ID_KEY, generated);
  return generated;
}

function getReferrer(): string | null {
  if (!document.referrer) return null;

  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function AnonymousPageAnalytics(): null {
  const pathname = usePathname();
  const sentPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pagePath = pathname || "/";
    if (sentPaths.current.has(pagePath)) return;
    window[SENT_FLAG] = window[SENT_FLAG] || {};
    if (window[SENT_FLAG][pagePath]) return;

    sentPaths.current.add(pagePath);
    window[SENT_FLAG][pagePath] = true;

    const send = () => {
      try {
        const payload = JSON.stringify({
          project_name: PROJECT_NAME,
          page_path: pagePath,
          referrer: getReferrer(),
          anonymous_visitor_id: getVisitorId()
        });
        const blob = new Blob([payload], { type: "application/json" });
        const ok = navigator.sendBeacon?.("/api/_analytics/page-view", blob) ?? false;

        if (!ok) {
          fetch("/api/_analytics/page-view", {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: payload
          }).catch(() => {});
        }
      } catch {}
    };

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(send, { timeout: 4000 });
        return;
      }

      setTimeout(send, 2500);
    };

    if (document.readyState === "complete") {
      schedule();
      return;
    }

    window.addEventListener("load", schedule, { once: true });
    return () => window.removeEventListener("load", schedule);
  }, [pathname]);

  return null;
}
