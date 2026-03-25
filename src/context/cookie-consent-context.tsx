"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/** localStorage key — analytics / measurement cookies only */
export const COOKIE_CONSENT_STORAGE_KEY = "runnersheet.analyticsConsent";

export type CookieConsentStatus = "loading" | "pending" | "granted" | "denied";

type CookieConsentContextValue = {
  status: CookieConsentStatus;
  grant: () => void;
  deny: () => void;
  /** Clears choice and reloads so the banner appears again */
  reopenChoice: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
);

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<CookieConsentStatus>(() => {
    if (typeof window === "undefined") return "loading";
    try {
      const v = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (v === "granted" || v === "denied") return v;
      return "pending";
    } catch {
      return "pending";
    }
  });

  const grant = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "granted");
    } catch {
      /* ignore */
    }
    setStatus("granted");
  }, []);

  const deny = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "denied");
    } catch {
      /* ignore */
    }
    setStatus("denied");
  }, []);

  const reopenChoice = useCallback(() => {
    try {
      localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, []);

  const value = useMemo(
    () => ({ status, grant, deny, reopenChoice }),
    [status, grant, deny, reopenChoice],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}
