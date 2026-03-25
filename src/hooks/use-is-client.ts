"use client";

import { useSyncExternalStore } from "react";

/** True after client hydration; false on the server. */
export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
