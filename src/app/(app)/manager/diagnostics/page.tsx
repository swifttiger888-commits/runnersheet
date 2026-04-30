"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { Card } from "@/components/ui/card";

type VersionResponse = {
  service?: string;
  commit?: string;
  builtAt?: string;
  rateLimit?: {
    scopes?: Record<
      string,
      {
        blocked?: number;
        lastBlockedAt?: string | null;
      }
    >;
  };
};

export default function ManagerDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VersionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setError(null);
        const res = await fetch("/api/version", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as VersionResponse;
        if (!res.ok) {
          throw new Error("Could not load diagnostics.");
        }
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load diagnostics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    const t = window.setInterval(() => void run(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const scopes = useMemo(
    () => Object.entries(data?.rateLimit?.scopes ?? {}),
    [data],
  );

  return (
    <ManagerPageShell title="Security diagnostics">
      <p className="text-sm text-muted">
        Live abuse-protection counters (refreshes every 30 seconds).
      </p>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{scopes.length}</p>
          <p className="text-xs text-muted">Limited routes</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">
            {scopes.reduce((acc, [, v]) => acc + (v.blocked ?? 0), 0)}
          </p>
          <p className="text-xs text-muted">Total blocks</p>
        </Card>
        <Card className="col-span-2 p-3 text-left">
          <p className="text-xs uppercase tracking-wide text-muted">Build</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {data?.commit ?? "unknown"}
          </p>
          <p className="text-xs text-muted">{data?.builtAt ?? "n/a"}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          Rate-limit scopes
        </h2>

        {loading ? (
          <p className="text-sm text-muted">Loading diagnostics…</p>
        ) : scopes.length === 0 ? (
          <p className="text-sm text-muted">
            No rate-limit blocks recorded since the worker started.
          </p>
        ) : (
          <ul className="space-y-2">
            {scopes
              .sort((a, b) => (b[1].blocked ?? 0) - (a[1].blocked ?? 0))
              .map(([scope, stat]) => (
                <li
                  key={scope}
                  className="rounded-xl border border-border/70 bg-surface/50 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-foreground">{scope}</p>
                  <p className="text-xs text-muted">
                    Blocks: {stat.blocked ?? 0}
                    {stat.lastBlockedAt
                      ? ` · last ${new Date(stat.lastBlockedAt).toLocaleString("en-GB")}`
                      : " · no timestamp"}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <p className="inline-flex items-center gap-2 text-xs text-muted">
        <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
        Data is in-memory per worker instance; counters reset on redeploy/cold start.
      </p>
    </ManagerPageShell>
  );
}
