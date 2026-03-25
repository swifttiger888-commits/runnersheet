"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StartResp = {
  ok?: boolean;
  vrm?: string;
  destination?: string | null;
  error?: string;
};

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function mapsDirUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export default function VoiceStartPage() {
  const [vrm, setVrm] = useState("");
  const [destination, setDestination] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoRanRef = useRef(false);

  async function startJourney(next: {
    vrm: string;
    destination: string;
    token: string;
  }) {
    setBusy(true);
    setMessage(null);
    try {
      const q = new URLSearchParams({
        vrm: next.vrm,
        destination: next.destination,
        t: next.token,
      });
      const res = await fetch(`/api/voice/start?${q.toString()}`);
      const data = (await res.json().catch(() => ({}))) as StartResp;
      if (!res.ok || !data.ok) {
        setMessage(data.error || "Could not start journey.");
        return;
      }

      const confirmedVrm = data.vrm || next.vrm;
      setMessage(`Journey started for ${confirmedVrm}.`);
      speak(`Journey started for ${confirmedVrm}`);

      const dest = data.destination || next.destination;
      if (dest) {
        window.location.replace(mapsDirUrl(dest));
      }
    } catch {
      setMessage("Could not start journey.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoRanRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const isAuto = params.get("auto") === "true";
    const autoVrm = params.get("vrm")?.trim() ?? "";
    const autoDest =
      params.get("dest")?.trim() ??
      params.get("destination")?.trim() ??
      "";
    const autoToken =
      params.get("t")?.trim() ?? params.get("token")?.trim() ?? "";

    if (!isAuto) return;
    if (!autoVrm) {
      setMessage("Auto start needs vrm.");
      return;
    }
    if (!autoToken) {
      setMessage("Auto start needs token.");
      return;
    }

    autoRanRef.current = true;
    setVrm(autoVrm);
    setDestination(autoDest);
    setToken(autoToken);
    void startJourney({
      vrm: autoVrm,
      destination: autoDest,
      token: autoToken,
    });
  }, []);

  return (
    <AppShell title="Voice start" showBrand>
      <Card>
        <CardHeader>
          <CardTitle>Start journey by voice link</CardTitle>
        </CardHeader>
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void startJourney({ vrm, destination, token });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="vrm">VRM</Label>
            <Input id="vrm" value={vrm} onChange={(e) => setVrm(e.target.value)} placeholder="AB12 CDE" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destination">Destination postcode (optional)</Label>
            <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="LS1 4DY" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tok">Voice token</Label>
            <Input
              id="tok"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste secure start token"
            />
          </div>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
          <Button
            type="submit"
            disabled={busy || !vrm.trim() || !token.trim()}
            className="w-full"
          >
            {busy ? "Starting…" : "Start journey"}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
