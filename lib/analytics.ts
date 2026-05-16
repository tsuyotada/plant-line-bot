// Analytics utility — GA4 wrapper with PII guard
// Only SafeProps fields are allowed; forbidden keys are stripped at runtime.

export type SafeProps = {
  role?: "owner" | "family" | "anonymous";
  plant_count_bucket?: "0" | "1-2" | "3-5" | "6+";
  has_line_connected?: boolean;
  has_photo?: boolean;
  source?: "login" | "about" | "sample" | "line_notification";
};

// Keys that must never reach any analytics tool
const FORBIDDEN_KEYS = new Set([
  "email",
  "user_id",
  "line_user_id",
  "household_id",
  "plant_id",
  "plant_name",
  "memo",
  "photo_url",
  "token",
  "join_code",
]);

function sanitize(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(([k]) => !FORBIDDEN_KEYS.has(k))
  );
}

function gtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { gtag?: (...a: unknown[]) => void };
  if (typeof w.gtag === "function") w.gtag(...args);
}

export function trackEvent(eventName: string, props?: SafeProps): void {
  const safe = props ? sanitize(props as Record<string, unknown>) : undefined;
  gtag("event", eventName, safe);
}

// Sends a GA4 page_view with a clean, masked path.
// Always pass the normalized path (e.g. "/share/[token]"), never the raw URL.
export function trackPageView(maskedPath: string): void {
  if (typeof window === "undefined") return;
  gtag("event", "page_view", {
    page_path: maskedPath,
    page_location: `${window.location.origin}${maskedPath}`,
    page_title: document.title,
  });
}
