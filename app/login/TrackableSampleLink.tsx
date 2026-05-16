"use client";

import { trackEvent } from "@/lib/analytics";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function TrackableSampleLink({ href, className, children }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => trackEvent("click_sample", { source: "login" })}
    >
      {children}
    </a>
  );
}
