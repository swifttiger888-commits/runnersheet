import type { BranchRecord } from "@/types/branch";

/**
 * When Firebase isn’t used or branches haven’t loaded yet, these keep the UI usable (demo / offline).
 */
export const FALLBACK_BRANCHES: BranchRecord[] = [
  { id: "_fb_leeds", name: "Leeds", postcode: "LS1 4DY" },
  { id: "_fb_huddersfield", name: "Huddersfield", postcode: "HD1 1NE" },
  { id: "_fb_york", name: "York", postcode: "YO1 7DP" },
  { id: "_fb_sheffield", name: "Sheffield", postcode: "S1 2HE" },
];

/** Canonical branch name (matches `homeBranch` on journeys / users). */
export type WorkingBranch = string;

/** Manager branch filter: all branches or one branch name. */
export type ManagerBranchFilter = "All" | WorkingBranch;
