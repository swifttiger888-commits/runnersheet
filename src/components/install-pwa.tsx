"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download, MoreVertical, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "runnersheet_pwa_install_dismissed_until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (Number.isNaN(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

function dismissForSevenDays() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      String(Date.now() + SEVEN_DAYS_MS),
    );
  } catch {
    /* ignore */
  }
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * iOS: Share → Add to Home Screen (same in Safari and other iOS browsers).
 * Android: show Chrome-style instructions only when the UA looks like Chrome
 * (⋮ → Install App), excluding Firefox and Edge.
 */
function detectInstallGuidePlatform(): "ios" | "android" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (!/Android/i.test(ua)) return null;
  if (/Firefox\//i.test(ua) || /Edg/i.test(ua)) return null;
  if (/Chrome\//i.test(ua)) return "android";
  return null;
}

function IconTile({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <span
      className="mx-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted-bg/60 align-middle shadow-inset-highlight"
      aria-hidden
      title={label}
    >
      {children}
    </span>
  );
}

/**
 * Mobile install guide for the login screen — iOS: Share → Add to Home Screen;
 * Android (Chrome): menu → Install app, with optional `beforeinstallprompt` shortcut.
 */
export function InstallPWA() {
  const [show, setShow] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const dismiss = useCallback(() => {
    dismissForSevenDays();
    setShow(false);
  }, []);

  useEffect(() => {
    if (isStandalonePwa()) return;
    if (isDismissed()) return;
    const platform = detectInstallGuidePlatform();
    if (!platform) return;
    setOs(platform);
    setShow(true);
  }, []);

  useEffect(() => {
    if (os !== "android" || typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setInstallReady(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [os]);

  const installAndroid = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    try {
      await ev.prompt();
      await ev.userChoice;
    } catch {
      /* ignore */
    } finally {
      deferredRef.current = null;
      setInstallReady(false);
    }
  }, []);

  if (!show || !os) return null;

  return (
    <section
      className="rounded-2xl border border-border bg-surface-elevated text-foreground shadow-card-quiet"
      aria-labelledby="install-app-heading"
    >
      <div className="h-px w-full bg-linear-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <h2
            id="install-app-heading"
            className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted"
          >
            Install app
          </h2>
          {os === "ios" ? (
            <p className="text-sm leading-relaxed text-foreground">
              To use RunnerSheet as an app: Tap the Share icon{" "}
              <IconTile label="Share">
                <Share
                  className="h-4 w-4 text-foreground"
                  strokeWidth={1.85}
                  aria-hidden
                />
              </IconTile>{" "}
              and select{" "}
              <span className="font-medium text-foreground">
                &ldquo;Add to Home Screen&rdquo;
              </span>
              .
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground">
                Tap the Three Dots{" "}
                <IconTile label="Menu">
                  <MoreVertical
                    className="h-4 w-4 text-foreground"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </IconTile>{" "}
                <span className="tabular-nums" aria-hidden>
                  (⋮)
                </span>{" "}
                and select{" "}
                <span className="font-medium text-foreground">
                  &ldquo;Install App&rdquo;
                </span>
                .
              </p>
              {installReady ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 border-border"
                  onClick={() => void installAndroid()}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Install app
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 sm:pt-7">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full border-border sm:w-auto"
            onClick={dismiss}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </section>
  );
}
