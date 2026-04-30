/* eslint-disable react/no-unescaped-entities */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ensureFirebaseClients } from "@/lib/firebase";
import { getSiteUrl } from "@/lib/site";

const APPLE_SHORTCUT_URL = "https://www.icloud.com/shortcuts/";
const SITE = getSiteUrl();

type TokenResp = {
  ok?: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
};

export default function VoiceSetupPage() {
  const [startToken, setStartToken] = useState("");
  const [endToken, setEndToken] = useState("");
  const [ttlDays, setTtlDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const startUrlExample = useMemo(
    () =>
      `${SITE}/app/start?auto=true&vrm=AB12CDE&dest=LS14DY&t=${encodeURIComponent(
        startToken || "VOICE_START_TOKEN",
      )}`,
    [startToken],
  );
  const endUrlExample = useMemo(
    () =>
      `${SITE}/app/end?auto=true&vrm=AB12CDE&t=${encodeURIComponent(
        endToken || "VOICE_END_TOKEN",
      )}`,
    [endToken],
  );

  async function mint(action: "start" | "end", ttlMinutes: number) {
    const clients = await ensureFirebaseClients();
    const user = clients?.auth.currentUser ?? null;
    if (!user) throw new Error("Sign in first, then generate tokens.");
    const idToken = await user.getIdToken();
    const res = await fetch("/api/voice/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ action, ttlMinutes }),
    });
    const data = (await res.json().catch(() => ({}))) as TokenResp;
    if (!res.ok || !data.ok || !data.token) {
      throw new Error(data.error || `Could not generate ${action} token.`);
    }
    return data;
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const ttl = Math.max(1, Math.min(30, Number(ttlDays) || 7));
      const ttlMinutes = ttl * 24 * 60;
      const [s, e] = await Promise.all([
        mint("start", ttlMinutes),
        mint("end", ttlMinutes),
      ]);
      setStartToken(s.token ?? "");
      setEndToken(e.token ?? "");
      setMsg(
        `Tokens generated. Start expires ${s.expiresAt ?? "soon"}, end expires ${
          e.expiresAt ?? "soon"
        }.`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not generate tokens.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Voice setup" showBrand>
      <Card>
        <CardHeader>
          <CardTitle>Secure token generator</CardTitle>
        </CardHeader>
        <div className="space-y-3 border-t border-border pt-4 text-sm text-muted">
          <p>Generate signed links for Siri / Assistant routines.</p>
          <div className="flex items-center gap-2">
            <Input
              value={ttlDays}
              onChange={(e) => setTtlDays(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              className="max-w-28"
            />
            <span>days validity (1-30)</span>
          </div>
          <Button type="button" onClick={() => void generate()} disabled={busy}>
            {busy ? "Generating…" : "Generate secure voice links"}
          </Button>
          {msg ? <p>{msg}</p> : null}
          <p className="text-xs">
            Keep these tokens private. Anyone with the URL can trigger the action
            until the token expires.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>iOS (Siri + Shortcuts)</CardTitle>
        </CardHeader>
        <div className="space-y-3 border-t border-border pt-4 text-sm text-muted">
          <p>
            Add the RunnerSheet shortcut, then configure it to call
            <code className="mx-1 rounded bg-muted-bg px-1.5 py-0.5 text-xs text-foreground">
              {startUrlExample}
            </code>
            and
            <code className="mx-1 rounded bg-muted-bg px-1.5 py-0.5 text-xs text-foreground">
              {endUrlExample}
            </code>
            .
          </p>
          <a href={APPLE_SHORTCUT_URL} target="_blank" rel="noreferrer" className="inline-block">
            <Button type="button">Open Apple Shortcut link</Button>
          </a>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Android (Google Assistant Routine)</CardTitle>
        </CardHeader>
        <div className="space-y-2 border-t border-border pt-4 text-sm text-muted">
          <p>In Google Home, create a personal Routine:</p>
          <p>1) Starter phrase: "start my journey" (and another for "end my journey").</p>
          <p>2) Action: "Open website".</p>
          <p>
            3) Start URL:
            <code className="mx-1 rounded bg-muted-bg px-1.5 py-0.5 text-xs text-foreground">
              {startUrlExample}
            </code>
          </p>
          <p>
            4) End URL:
            <code className="mx-1 rounded bg-muted-bg px-1.5 py-0.5 text-xs text-foreground">
              {endUrlExample}
            </code>
          </p>
          <p>
            <Link href="/app/start" className="font-semibold text-primary underline-offset-4 hover:underline">
              Test start page
            </Link>
            {" · "}
            <Link href="/app/end" className="font-semibold text-primary underline-offset-4 hover:underline">
              Test end page
            </Link>
          </p>
        </div>
      </Card>
    </AppShell>
  );
}
