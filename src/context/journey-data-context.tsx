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
import { alertsForCompletedJourney } from "@/lib/alert-engine";
import { mapAlertDoc, mapJourneyDoc } from "@/lib/firestore-mappers";
import { ensureFirebaseClients } from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebase-env";
import {
  parseAlertArrayFromSessionJson,
  parseJourneyArrayFromSessionJson,
} from "@/lib/normalize-records";
import {
  canDriverCorrectJourneyUntil5pm,
  clampCorrectionNote,
} from "@/lib/journey-corrections";
import { friendlyFirestoreError } from "@/lib/user-facing-errors";
import { formatUkPostcode, formatUkVehicleRegistration } from "@/lib/uk-format";
import type { AlertRecord } from "@/types/alert";
import type {
  JourneyCorrectionReason,
  JourneyRecord,
  JourneyType,
} from "@/types/journey";
import { useAuth } from "@/context/auth-context";

const DEMO_J = "rs_demo_journeys_v1";
const DEMO_A = "rs_demo_alerts_v1";

const DEMO_DRIVER_UID = "demo-auth-driver";

function persistDemo(j: JourneyRecord[], a: AlertRecord[]) {
  sessionStorage.setItem(
    DEMO_J,
    JSON.stringify(j, (_, v) => (v instanceof Date ? v.toISOString() : v)),
  );
  sessionStorage.setItem(
    DEMO_A,
    JSON.stringify(a, (_, v) => (v instanceof Date ? v.toISOString() : v)),
  );
}

type StartJourneyInput = {
  journeyType: JourneyType;
  vehicleRegistration: string;
  startingMileage: number;
  destinationPostcode: string;
  homeBranch: string;
  startOriginType?: "branch" | "gps";
  startOriginLabel?: string;
  certifiedVehicle: {
    make: string;
    model: string;
    color: string;
  } | null;
};

type JourneyDataContextValue = {
  journeys: JourneyRecord[];
  alerts: AlertRecord[];
  loading: boolean;
  hasPendingWrites: boolean;
  error: string | null;
  startJourney: (input: StartJourneyInput) => Promise<void>;
  endJourney: (
    journeyId: string,
    endingMileage?: number,
    options?: { cancelled?: boolean; destinationPostcode?: string | null },
  ) => Promise<void>;
  correctJourney: (input: {
    journeyId: string;
    startTime: Date;
    endTime: Date;
    reason: JourneyCorrectionReason;
    note?: string;
  }) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
};

const JourneyDataContext = createContext<JourneyDataContextValue | null>(null);

export function JourneyDataProvider({ children }: { children: React.ReactNode }) {
  const { usesFirebaseAuth, user, role, profile } = useAuth();
  const [journeys, setJourneys] = useState<JourneyRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const journeysRef = useRef<JourneyRecord[]>([]);

  const driverUid = user?.uid ?? (role === "driver" ? DEMO_DRIVER_UID : "");
  const isDemoBackend = !usesFirebaseAuth;
  const canUseFirestore =
    usesFirebaseAuth &&
    isFirebaseConfigured() &&
    Boolean(user) &&
    Boolean(profile) &&
    (role === "driver" || role === "manager");

  useEffect(() => {
    journeysRef.current = journeys;
  }, [journeys]);

  /** Demo / local session store (never mixed with Firebase mode) */
  useEffect(() => {
    if (!isDemoBackend) return;
    queueMicrotask(() => {
      setLoading(true);
      const load = () => {
        if (typeof window === "undefined") return;
        const j = parseJourneyArrayFromSessionJson(
          sessionStorage.getItem(DEMO_J) ?? "[]",
        );
        const a = parseAlertArrayFromSessionJson(
          sessionStorage.getItem(DEMO_A) ?? "[]",
        );
        setJourneys(j);
        setAlerts(a);
        setLoading(false);
        setHasPendingWrites(false);
      };
      load();
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_J || e.key === DEMO_A) {
        queueMicrotask(() => {
          const j = parseJourneyArrayFromSessionJson(
            sessionStorage.getItem(DEMO_J) ?? "[]",
          );
          const a = parseAlertArrayFromSessionJson(
            sessionStorage.getItem(DEMO_A) ?? "[]",
          );
          setJourneys(j);
          setAlerts(a);
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isDemoBackend]);

  /** Firestore subscriptions */
  useEffect(() => {
    if (isDemoBackend) return;
    if (!usesFirebaseAuth) return;
    if (!user) {
      queueMicrotask(() => {
        setJourneys([]);
        setAlerts([]);
        setLoading(false);
        setHasPendingWrites(false);
        setError(null);
      });
      return;
    }
    if (!profile) {
      queueMicrotask(() => {
        setJourneys([]);
        setAlerts([]);
        setLoading(false);
        setHasPendingWrites(false);
        setError(
          "Add a Firestore document users/{uid} with name, employeeId, homeBranch, and role.",
        );
      });
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const clients = await ensureFirebaseClients();
      if (cancelled || !clients) {
        queueMicrotask(() => setLoading(false));
        return;
      }
      const fs = await import("firebase/firestore");
      if (cancelled) return;
      const {
        collection,
        query,
        where,
        orderBy,
        limit,
        onSnapshot,
      } = fs;
      const { db } = clients;
      queueMicrotask(() => {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
      });

      if (cancelled) return;

      if (role === "driver") {
        const q = query(
          collection(db, "journeys"),
          where("userId", "==", user.uid),
          orderBy("startTime", "desc"),
          limit(400),
        );
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              const rows = snap.docs.map((d) =>
                mapJourneyDoc(d.id, d.data() as Record<string, unknown>),
              );
              setJourneys(rows);
              setHasPendingWrites(snap.metadata.hasPendingWrites);
              setLoading(false);
            },
            (e) => {
              setError(friendlyFirestoreError(e.message));
              setHasPendingWrites(false);
              setLoading(false);
            },
          ),
        );
      } else if (role === "manager") {
        const q = query(
          collection(db, "journeys"),
          orderBy("startTime", "desc"),
          limit(400),
        );
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              const rows = snap.docs.map((d) =>
                mapJourneyDoc(d.id, d.data() as Record<string, unknown>),
              );
              setJourneys(rows);
              setHasPendingWrites(snap.metadata.hasPendingWrites);
              setLoading(false);
            },
            (e) => {
              setError(friendlyFirestoreError(e.message));
              setHasPendingWrites(false);
              setLoading(false);
            },
          ),
        );
      }

      const aq = query(
        collection(db, "alerts"),
        orderBy("createdAt", "desc"),
        limit(400),
      );
      unsubs.push(
        onSnapshot(
          aq,
          (snap) => {
            const rows = snap.docs.map((d) =>
              mapAlertDoc(d.id, d.data() as Record<string, unknown>),
            );
            setAlerts(rows);
          },
          () => {
            /* alerts collection may be missing */
          },
        ),
      );
    })();

    return () => {
      cancelled = true;
      unsubs.splice(0).forEach((u) => u());
    };
  }, [isDemoBackend, usesFirebaseAuth, user, profile, role]);

  const startJourney = useCallback(
    async (input: StartJourneyInput) => {
      const reg = formatUkVehicleRegistration(input.vehicleRegistration);
      const pcRaw = input.destinationPostcode.trim();
      const pc = pcRaw ? formatUkPostcode(pcRaw) : "";
      if (!reg) throw new Error("Vehicle registration is required.");
      if (input.startingMileage < 0)
        throw new Error("Starting mileage must be zero or greater.");
      if (!profile) throw new Error("Profile not loaded.");

      const now = new Date();
      const row: JourneyRecord = {
        id: crypto.randomUUID(),
        userId: driverUid || DEMO_DRIVER_UID,
        driverId: profile.employeeId,
        driverName: profile.name,
        journeyType: input.journeyType,
        vehicleRegistration: reg,
        startingMileage: input.startingMileage,
        endingMileage: null,
        destinationPostcode: pc || null,
        homeBranch: input.homeBranch,
        startOriginType: input.startOriginType ?? "branch",
        startOriginLabel: input.startOriginLabel ?? input.homeBranch,
        startTime: now,
        endTime: null,
        status: "active",
        createdAt: now,
        milesTraveled: null,
        durationSeconds: null,
        certifiedVehicleMake: input.certifiedVehicle?.make ?? null,
        certifiedVehicleModel: input.certifiedVehicle?.model ?? null,
        certifiedVehicleColor: input.certifiedVehicle?.color ?? null,
        correctionLog: [],
      };

      if (canUseFirestore && user) {
        const clients = await ensureFirebaseClients();
        if (!clients) throw new Error("Firebase not available.");
        const {
          addDoc,
          collection,
          getDocs,
          query,
          serverTimestamp,
          where,
        } = await import("firebase/firestore");
        const activeQ = query(
          collection(clients.db, "journeys"),
          where("userId", "==", user.uid),
        );
        const activeSnap = await getDocs(activeQ);
        const hasActive = activeSnap.docs.some(
          (d) => (d.data() as { status?: string }).status === "active",
        );
        if (hasActive)
          throw new Error("You already have an active journey. End it first.");
        await addDoc(collection(clients.db, "journeys"), {
          userId: user.uid,
          driverId: profile.employeeId,
          driverName: profile.name,
          journeyType: input.journeyType,
          vehicleRegistration: reg,
          startingMileage: input.startingMileage,
          destinationPostcode: pc || null,
          homeBranch: input.homeBranch,
          startOriginType: input.startOriginType ?? "branch",
          startOriginLabel: input.startOriginLabel ?? input.homeBranch,
          startTime: serverTimestamp(),
          endTime: null,
          status: "active",
          createdAt: serverTimestamp(),
          milesTraveled: null,
          durationSeconds: null,
          certifiedVehicleMake: input.certifiedVehicle?.make ?? null,
          certifiedVehicleModel: input.certifiedVehicle?.model ?? null,
          certifiedVehicleColor: input.certifiedVehicle?.color ?? null,
          correctionLog: [],
        });
        return;
      }

      const prev = parseJourneyArrayFromSessionJson(sessionStorage.getItem(DEMO_J) ?? "[]");
      const active = prev.filter((j) => j.userId === row.userId && j.status === "active");
      if (active.length > 0)
        throw new Error("You already have an active journey. End it first.");
      prev.unshift(row);
      const al = parseAlertArrayFromSessionJson(sessionStorage.getItem(DEMO_A) ?? "[]");
      persistDemo(prev, al);
      setJourneys([...prev]);
    },
    [canUseFirestore, user, profile, driverUid],
  );

  const endJourney = useCallback(
    async (
      journeyId: string,
      endingMileage?: number,
      options?: { cancelled?: boolean; destinationPostcode?: string | null },
    ) => {
      if (!profile) throw new Error("Profile not loaded.");
      const list = journeysRef.current;
      const j = list.find((x) => x.id === journeyId);
      if (!j) throw new Error("Journey not found.");
      const resolvedEndingMileage =
        endingMileage === undefined ? j.startingMileage : endingMileage;
      if (resolvedEndingMileage < j.startingMileage)
        throw new Error("Ending mileage must be greater than or equal to starting mileage.");
      const end = new Date();
      const miles = Math.max(0, resolvedEndingMileage - j.startingMileage);
      const seconds = Math.max(0, (end.getTime() - j.startTime.getTime()) / 1000);
      const wasCancelled = Boolean(options?.cancelled);
      const resolvedDestination =
        typeof options?.destinationPostcode === "string"
          ? formatUkPostcode(options.destinationPostcode.trim()) || null
          : j.destinationPostcode ?? null;

      if (canUseFirestore) {
        const clients = await ensureFirebaseClients();
        if (!clients) throw new Error("Firebase not available.");
        const {
          addDoc,
          collection,
          doc,
          serverTimestamp,
          updateDoc,
        } = await import("firebase/firestore");
        await updateDoc(doc(clients.db, "journeys", journeyId), {
          endingMileage: resolvedEndingMileage,
          destinationPostcode: resolvedDestination,
          endTime: serverTimestamp(),
          status: "completed",
          wasCancelled,
          milesTraveled: miles,
          durationSeconds: seconds,
        });
        const completed: JourneyRecord = {
          ...j,
          endingMileage: resolvedEndingMileage,
          destinationPostcode: resolvedDestination,
          endTime: end,
          status: "completed",
          wasCancelled,
          milesTraveled: miles,
          durationSeconds: seconds,
          correctionLog: j.correctionLog ?? [],
        };
        if (!wasCancelled) {
          const recent = list.filter(
            (x) =>
              x.vehicleRegistration === j.vehicleRegistration && x.id !== j.id,
          );
          const candidates = alertsForCompletedJourney(completed, recent);
          for (const c of candidates) {
            await addDoc(collection(clients.db, "alerts"), {
              ...c,
              createdAt: serverTimestamp(),
              resolvedBy: null,
              resolvedAt: null,
            });
          }
        }
        return;
      }

      const prev = parseJourneyArrayFromSessionJson(
        sessionStorage.getItem(DEMO_J) ?? "[]",
      );
      const idx = prev.findIndex((x) => x.id === journeyId);
      if (idx === -1) throw new Error("Journey not found.");
      const completed: JourneyRecord = {
        ...prev[idx],
        endingMileage: resolvedEndingMileage,
        destinationPostcode: resolvedDestination,
        endTime: end,
        status: "completed",
        wasCancelled,
        milesTraveled: miles,
        durationSeconds: seconds,
        correctionLog: prev[idx]?.correctionLog ?? [],
      };
      prev[idx] = completed;
      const existingAlerts = parseAlertArrayFromSessionJson(
        sessionStorage.getItem(DEMO_A) ?? "[]",
      );
      const generated: AlertRecord[] = wasCancelled
        ? []
        : alertsForCompletedJourney(
            completed,
            prev.filter(
              (x) =>
                x.vehicleRegistration === j.vehicleRegistration && x.id !== j.id,
            ),
          ).map((c) => ({
            ...c,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            resolvedBy: null,
            resolvedAt: null,
          }));
      const al = [...generated, ...existingAlerts];
      persistDemo(prev, al);
      setJourneys([...prev]);
      setAlerts([...al]);
    },
    [canUseFirestore, profile],
  );

  const correctJourney = useCallback(
    async (input: {
      journeyId: string;
      startTime: Date;
      endTime: Date;
      reason: JourneyCorrectionReason;
      note?: string;
    }) => {
      if (!profile) throw new Error("Profile not loaded.");
      const list = journeysRef.current;
      const row = list.find((x) => x.id === input.journeyId);
      if (!row) throw new Error("Journey not found.");
      if (row.userId !== (user?.uid ?? driverUid)) {
        throw new Error("You can only correct your own journeys.");
      }
      if (row.status !== "completed" || !row.endTime) {
        throw new Error("Only completed journeys can be corrected.");
      }
      const gate = canDriverCorrectJourneyUntil5pm(row.startTime, new Date());
      if (!gate.allowed) throw new Error(gate.reason ?? "Correction window closed.");
      if (input.endTime <= input.startTime) {
        throw new Error("End time must be after start time.");
      }

      const updatedDuration = Math.max(
        0,
        Math.round((input.endTime.getTime() - input.startTime.getTime()) / 1000),
      );
      const note = clampCorrectionNote(input.note);
      const editedAt = new Date();
      const entry = {
        editedAt,
        editedByUid: user?.uid ?? driverUid,
        editedByDriverId: profile.employeeId,
        reason: input.reason,
        note,
        previousStartTime: row.startTime,
        newStartTime: input.startTime,
        previousEndTime: row.endTime,
        newEndTime: input.endTime,
      };

      if (canUseFirestore) {
        const clients = await ensureFirebaseClients();
        if (!clients) throw new Error("Firebase not available.");
        const { Timestamp, doc, getDoc, updateDoc } = await import("firebase/firestore");
        const ref = doc(clients.db, "journeys", input.journeyId);
        const snap = await getDoc(ref);
        const existingLog = Array.isArray(snap.data()?.correctionLog)
          ? (snap.data()?.correctionLog as Array<Record<string, unknown>>)
          : [];
        await updateDoc(ref, {
          startTime: Timestamp.fromDate(input.startTime),
          endTime: Timestamp.fromDate(input.endTime),
          durationSeconds: updatedDuration,
          needsReview: true,
          isLateEntry: true,
          isApproved: null,
          correctionLog: [
            ...existingLog,
            {
              editedAt: entry.editedAt.toISOString(),
              editedByUid: entry.editedByUid,
              editedByDriverId: entry.editedByDriverId,
              reason: entry.reason,
              note: entry.note,
              previousStartTime: entry.previousStartTime.toISOString(),
              newStartTime: entry.newStartTime.toISOString(),
              previousEndTime: entry.previousEndTime?.toISOString() ?? null,
              newEndTime: entry.newEndTime?.toISOString() ?? null,
            },
          ],
        });
        return;
      }

      const prev = parseJourneyArrayFromSessionJson(
        sessionStorage.getItem(DEMO_J) ?? "[]",
      );
      const idx = prev.findIndex((x) => x.id === input.journeyId);
      if (idx === -1) throw new Error("Journey not found.");
      const existing = prev[idx]!;
      prev[idx] = {
        ...existing,
        startTime: input.startTime,
        endTime: input.endTime,
        durationSeconds: updatedDuration,
        needsReview: true,
        isLateEntry: true,
        isApproved: null,
        correctionLog: [...(existing.correctionLog ?? []), entry],
      };
      const al = parseAlertArrayFromSessionJson(sessionStorage.getItem(DEMO_A) ?? "[]");
      persistDemo(prev, al);
      setJourneys([...prev]);
    },
    [canUseFirestore, profile, user?.uid, driverUid],
  );

  const resolveAlert = useCallback(
    async (alertId: string) => {
      if (canUseFirestore && user) {
        const clients = await ensureFirebaseClients();
        if (!clients) throw new Error("Firebase not available.");
        const { doc, serverTimestamp, updateDoc } = await import(
          "firebase/firestore"
        );
        await updateDoc(doc(clients.db, "alerts", alertId), {
          isResolved: true,
          resolvedBy: profile?.employeeId ?? user.uid,
          resolvedAt: serverTimestamp(),
        });
        return;
      }
      const al = parseAlertArrayFromSessionJson(sessionStorage.getItem(DEMO_A) ?? "[]");
      const i = al.findIndex((a) => a.id === alertId);
      if (i === -1) return;
      al[i] = {
        ...al[i],
        isResolved: true,
        resolvedBy: profile?.employeeId ?? "manager",
        resolvedAt: new Date(),
      };
      persistDemo(parseJourneyArrayFromSessionJson(sessionStorage.getItem(DEMO_J) ?? "[]"), al);
      setAlerts([...al]);
    },
    [canUseFirestore, user, profile],
  );

  const value = useMemo(
    () => ({
      journeys,
      alerts,
      loading,
      hasPendingWrites,
      error,
      startJourney,
      endJourney,
      correctJourney,
      resolveAlert,
    }),
    [
      journeys,
      alerts,
      loading,
      hasPendingWrites,
      error,
      startJourney,
      endJourney,
      correctJourney,
      resolveAlert,
    ],
  );

  return (
    <JourneyDataContext.Provider value={value}>
      {children}
    </JourneyDataContext.Provider>
  );
}

export function useJourneyData(): JourneyDataContextValue {
  const ctx = useContext(JourneyDataContext);
  if (!ctx)
    throw new Error("useJourneyData must be used within JourneyDataProvider");
  return ctx;
}

/** Manager: journeys visible for branch filter */
export function filterJourneysByBranch(
  rows: JourneyRecord[],
  branch: string,
): JourneyRecord[] {
  if (branch === "All") return rows;
  return rows.filter((j) => j.homeBranch === branch);
}
