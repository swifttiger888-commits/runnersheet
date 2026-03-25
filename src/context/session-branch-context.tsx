"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ManagerBranchFilter, WorkingBranch } from "@/config/branches";
import { useBranches } from "@/context/branches-context";

const KEY = "runnersheet_working_branch";

type SessionBranchContextValue = {
  /** Driver session working location (branch name). */
  workingBranch: WorkingBranch;
  setWorkingBranch: (b: WorkingBranch) => void;
  /** Manager filter */
  managerBranchFilter: ManagerBranchFilter;
  setManagerBranchFilter: (b: ManagerBranchFilter) => void;
};

const SessionBranchContext =
  createContext<SessionBranchContextValue | null>(null);

export function SessionBranchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { branchNames } = useBranches();
  const [workingBranch, setWorkingBranchState] = useState<WorkingBranch>("");
  const [managerBranchFilter, setManagerFilterState] =
    useState<ManagerBranchFilter>("All");

  useEffect(() => {
    if (branchNames.length === 0) return;
    queueMicrotask(() => {
      setWorkingBranchState((prev) => {
        if (prev && branchNames.includes(prev)) return prev;
        if (typeof window !== "undefined") {
          const raw = sessionStorage.getItem(KEY);
          if (raw && branchNames.includes(raw)) return raw;
        }
        return branchNames[0] ?? "";
      });
    });
  }, [branchNames]);

  const setWorkingBranch = useCallback((b: WorkingBranch) => {
    setWorkingBranchState(b);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(KEY, b);
    }
  }, []);

  const setManagerBranchFilter = useCallback((b: ManagerBranchFilter) => {
    setManagerFilterState(b);
  }, []);

  const value = useMemo(
    () => ({
      workingBranch:
        workingBranch && branchNames.includes(workingBranch)
          ? workingBranch
          : (branchNames[0] ?? ""),
      setWorkingBranch,
      managerBranchFilter:
        managerBranchFilter === "All" || branchNames.includes(managerBranchFilter)
          ? managerBranchFilter
          : "All",
      setManagerBranchFilter,
    }),
    [
      workingBranch,
      branchNames,
      setWorkingBranch,
      managerBranchFilter,
      setManagerBranchFilter,
    ],
  );

  return (
    <SessionBranchContext.Provider value={value}>
      {children}
    </SessionBranchContext.Provider>
  );
}

export function useSessionBranch(): SessionBranchContextValue {
  const ctx = useContext(SessionBranchContext);
  if (!ctx)
    throw new Error("useSessionBranch must be used within SessionBranchProvider");
  return ctx;
}
