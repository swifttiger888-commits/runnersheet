"use client";

import { useEffect, useState } from "react";
import { formatRunningDuration } from "@/lib/running-duration";
import type { JourneyRecord } from "@/types/journey";

/** Updates a “Running …” label on an interval while a journey is active. */
export function useRunningLabel(active: JourneyRecord | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;
  return formatRunningDuration(active.startTime, now);
}
