"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FALLBACK_BRANCHES } from "@/config/branches";
import { ensureFirebaseClients } from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebase-env";
import { useAuth } from "@/context/auth-context";
import type { QuerySnapshot } from "firebase/firestore";
import type { BranchRecord } from "@/types/branch";

type BranchesContextValue = {
  branches: BranchRecord[];
  /** Sorted display names (labels). */
  branchNames: string[];
  loading: boolean;
  error: string | null;
  /** Postcode for ETA / maps when the branch name is known. */
  getPostcodeByBranchName: (branchName: string) => string | null;
};

const BranchesContext = createContext<BranchesContextValue | null>(null);

function mapDocs(snap: QuerySnapshot): BranchRecord[] {
  const out: BranchRecord[] = [];
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const name = String(data.name ?? "").trim();
    const postcode = String(data.postcode ?? "").trim();
    if (!name) return;
    out.push({ id: d.id, name, postcode });
  });
  out.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  return out;
}

export function BranchesProvider({ children }: { children: React.ReactNode }) {
  const { usesFirebaseAuth, user } = useAuth();
  const [branches, setBranches] = useState<BranchRecord[]>(FALLBACK_BRANCHES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const useRemote =
    usesFirebaseAuth && Boolean(user) && isFirebaseConfigured();

  useEffect(() => {
    if (!useRemote) {
      unsubRef.current?.();
      unsubRef.current = null;
      setBranches(FALLBACK_BRANCHES);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const clients = await ensureFirebaseClients();
      if (cancelled) return;
      if (!clients) {
        setBranches(FALLBACK_BRANCHES);
        setLoading(false);
        return;
      }

      const { collection, onSnapshot, orderBy, query } = await import(
        "firebase/firestore"
      );
      const q = query(collection(clients.db, "branches"), orderBy("name"));

      unsubRef.current = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          setBranches(mapDocs(snap));
          setLoading(false);
          setError(null);
        },
        (e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Could not load branches.");
          setBranches(FALLBACK_BRANCHES);
          setLoading(false);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [useRemote, user?.uid]);

  const branchNames = useMemo(
    () => branches.map((b) => b.name),
    [branches],
  );

  const getPostcodeByBranchName = useCallback(
    (branchName: string): string | null => {
      const row = branches.find((b) => b.name === branchName);
      return row?.postcode?.trim() || null;
    },
    [branches],
  );

  const value = useMemo(
    () => ({
      branches,
      branchNames,
      loading,
      error,
      getPostcodeByBranchName,
    }),
    [branches, branchNames, loading, error, getPostcodeByBranchName],
  );

  return (
    <BranchesContext.Provider value={value}>{children}</BranchesContext.Provider>
  );
}

export function useBranches(): BranchesContextValue {
  const ctx = useContext(BranchesContext);
  if (!ctx) {
    throw new Error("useBranches must be used within BranchesProvider");
  }
  return ctx;
}

/** For optional UI when provider might not wrap (should not happen in app shell). */
export function useBranchesOptional(): BranchesContextValue | null {
  return useContext(BranchesContext);
}
