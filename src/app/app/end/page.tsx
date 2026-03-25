"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EndResp = {
  ok?: boolean;
  error?: string;
};

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export default function VoiceEndPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoRanRef = useRef(false);

  async function endJourney(next: { token: string }) {
    setBusy(true);
    setMessage(null);
    try {
      const q = new URLSearchParams({ t: next.token });
      const res = await fetch(`/api/voice/end?${q.toString()}`);
      const data = (await res.json().catch(() => ({}))) as EndResp;
      if (!res.ok || !data.ok) {
        setMessage(data.error || "Could not end journey.");
        return;
      }
      setMessage("Journey ended.");
      speak("Journey ended");
    } catch {
      setMessage("Could not end journey.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoRanRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const auto = params.get("auto") === "true";
    const autoVrm = params.get("vrm")?.trim() ?? "";
    const autoToken =
      params.get("t")?.trim() ?? params.get("token")?.trim() ?? "";
    if (!auto) return;
    if (!autoVrm || !autoToken) {
      setMessage("Auto end needs vrm and token.");
      return;
    }
    autoRanRef.current = true;
    setToken(autoToken);
    void endJourney({ token: autoToken });
  }, []);

  return (
    <AppShell title="Voice end" showBrand>
      <Card>
        <CardHeader>
          <CardTitle>End journey by voice link</CardTitle>
        </CardHeader>
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void endJourney({ token });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="tok">Voice token</Label>
            <Input
              id="tok"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste secure end token"
            />
          </div>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
          <Button type="submit" disabled={busy || !token.trim()} className="w-full">
            {busy ? "Ending…" : "End journey"}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
