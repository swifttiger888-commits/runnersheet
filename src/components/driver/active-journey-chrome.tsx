"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { formatRunningDuration } from "@/lib/running-duration";
import type { JourneyRecord } from "@/types/journey";

const BASE_TITLE = "RunnerSheet";

type ActiveJourneyChromeProps = {
  active: JourneyRecord | undefined;
  /** Scroll to the end form and focus ending mileage. */
  onEndJourneyFocus: () => void;
};

export function ActiveJourneyChrome({
  active,
  onEndJourneyFocus,
}: ActiveJourneyChromeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      document.title = BASE_TITLE;
      return;
    }
    document.title = `(Active) ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [active]);

  const isClient = useIsClient();

  if (!active) return null;

  const runningLabel = formatRunningDuration(active.startTime, now);

  const tree = (
    <div
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface-elevated/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.45)] backdrop-blur-sm supports-backdrop-filter:bg-surface-elevated/85"
      role="region"
      aria-label="Active journey"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 md:max-w-2xl xl:max-w-4xl">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            Journey in progress
          </p>
          <p className="truncate text-xs text-muted tabular-nums">{runningLabel}</p>
        </div>
        <Button
          className="min-h-11 shrink-0 gap-2"
          onClick={onEndJourneyFocus}
          type="button"
          variant="primary"
        >
          <StopCircle className="h-4 w-4" aria-hidden />
          End journey
        </Button>
      </div>
    </div>
  );

  if (!isClient) return null;
  return createPortal(tree, document.body);
}

/** Bottom padding so fixed chrome does not cover scrollable content. */
export const ACTIVE_JOURNEY_CHROME_BOTTOM_PAD_CLASS =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom))]";
