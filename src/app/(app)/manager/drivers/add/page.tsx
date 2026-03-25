"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranches } from "@/context/branches-context";
import { ensureFirebaseClients } from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebase-env";
import { useAuth } from "@/context/auth-context";

export default function ManagerAddDriverPage() {
  const router = useRouter();
  const { usesFirebaseAuth } = useAuth();
  const { branchNames, loading: branchesLoading } = useBranches();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [homeBranch, setHomeBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    usesFirebaseAuth &&
    isFirebaseConfigured() &&
    fullName.trim() &&
    email.trim() &&
    employeeId.trim() &&
    homeBranch.trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    const emailTrim = email.trim();
    setBusy(true);
    try {
      const clients = await ensureFirebaseClients();
      if (!clients) {
        setError("Firebase not available.");
        return;
      }
      const {
        addDoc,
        collection,
        getDocs,
        query,
        where,
        serverTimestamp,
      } = await import("firebase/firestore");

      const dup = await getDocs(
        query(collection(clients.db, "users"), where("email", "==", emailTrim)),
      );
      if (!dup.empty) {
        setError("A user profile with this email already exists.");
        return;
      }

      await addDoc(collection(clients.db, "users"), {
        accessStatus: "approved",
        role: "driver",
        name: fullName.trim(),
        email: emailTrim,
        employeeId: employeeId.trim(),
        homeBranch: homeBranch.trim(),
        provisionedByManager: true,
        createdAt: serverTimestamp(),
      });
      router.push("/manager/drivers");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create driver profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManagerPageShell title="Add driver">
      <p className="text-sm text-muted">
        Creates an approved driver profile with a new Firestore document ID. When
        they first sign in with Google (or email) using the{" "}
        <strong className="font-medium text-foreground">same email</strong>, their
        account links to RunnerSheet automatically.
      </p>

      {!usesFirebaseAuth || !isFirebaseConfigured() ? (
        <p className="rounded-xl border border-border bg-muted-bg/40 px-4 py-3 text-sm text-muted">
          Manual driver entry requires Firebase mode with web keys configured.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" aria-hidden />
            Driver details
          </CardTitle>
        </CardHeader>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              required
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Must match Google / sign-in email exactly"
              required
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-id">Employee ID</Label>
            <Input
              id="emp-id"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Company ID"
              required
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch">Home branch</Label>
            {branchesLoading && branchNames.length === 0 ? (
              <p className="text-sm text-muted">Loading branches…</p>
            ) : branchNames.length === 0 ? (
              <p className="text-sm text-muted">
                No branches in Firestore. Add them under{" "}
                <span className="font-medium text-foreground">Manage branches</span>{" "}
                first.
              </p>
            ) : (
              <select
                id="branch"
                required
                disabled={busy}
                value={homeBranch}
                onChange={(e) => setHomeBranch(e.target.value)}
                className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground shadow-inset-field"
              >
                <option value="">Select branch</option>
                {branchNames.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button
            type="submit"
            className="gap-2"
            disabled={!canSubmit || busy || branchNames.length === 0}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            Add driver
          </Button>
        </form>
      </Card>
    </ManagerPageShell>
  );
}
