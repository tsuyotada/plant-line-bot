"use client";

import { Analytics } from "@vercel/analytics/next";
import type { BeforeSendEvent } from "@vercel/analytics";

function beforeSend(event: BeforeSendEvent) {
  try {
    const url = new URL(event.url);
    if (url.pathname.startsWith("/share/")) {
      url.pathname = "/share/[token]";
      return { ...event, url: url.toString() };
    }
  } catch {
    // malformed URL — pass through unchanged
  }
  return event;
}

export function AnalyticsProvider() {
  return <Analytics beforeSend={beforeSend} />;
}
