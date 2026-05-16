"use client";

import { useEffect } from "react";
import { trackEvent, trackPageView, type SafeProps } from "@/lib/analytics";

type Props = {
  // Normalized path to send as page_view (must not contain real tokens/IDs)
  pagePath: string;
  // Optional custom event to fire alongside the page view
  event?: string;
  eventProps?: SafeProps;
};

// Fires a GA4 page_view (and optional custom event) once on mount.
// Renders nothing — place at the top of any Server Component page.
export function AnalyticsPageView({ pagePath, event, eventProps }: Props) {
  useEffect(() => {
    trackPageView(pagePath);
    if (event) trackEvent(event, eventProps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
