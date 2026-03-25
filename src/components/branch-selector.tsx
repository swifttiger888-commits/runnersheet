"use client";

import type { ManagerBranchFilter, WorkingBranch } from "@/config/branches";
import { useBranches } from "@/context/branches-context";

type Props =
  | {
      mode: "driver";
      value: WorkingBranch;
      onChange: (b: WorkingBranch) => void;
    }
  | {
      mode: "manager";
      value: ManagerBranchFilter;
      onChange: (b: ManagerBranchFilter) => void;
    };

export function BranchSelector(props: Props) {
  const { branchNames, loading, error } = useBranches();

  if (loading && branchNames.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted-bg/30 px-3 py-2 text-sm text-muted">
        Loading branches…
      </div>
    );
  }

  if (!loading && branchNames.length === 0) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
        {error ?? "No branches configured. Add branches in Manager → Manage branches."}
      </div>
    );
  }

  if (props.mode === "driver") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Working branch
        </span>
        {error && branchNames.length > 0 ? (
          <p className="text-xs text-muted" role="status">
            Using cached list ({error})
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {branchNames.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => props.onChange(b)}
              className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                props.value === b
                  ? "border-primary bg-primary text-primary-foreground shadow-control"
                  : "border-border bg-surface text-foreground hover:bg-muted-bg/50"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const filters: ManagerBranchFilter[] = ["All", ...branchNames];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        Branch
      </span>
      {error && branchNames.length > 0 ? (
        <p className="text-xs text-muted" role="status">
          Using cached list ({error})
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {filters.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => props.onChange(b)}
            className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              props.value === b
                ? "border-primary bg-primary text-primary-foreground shadow-control"
                : "border-border bg-surface text-foreground hover:bg-muted-bg/50"
            }`}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}
