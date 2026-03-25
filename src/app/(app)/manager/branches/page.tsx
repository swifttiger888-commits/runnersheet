"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ManagerPageShell } from "@/components/manager-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranches } from "@/context/branches-context";
import { ensureFirebaseClients } from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebase-env";
import { useAuth } from "@/context/auth-context";
import type { BranchRecord } from "@/types/branch";

export default function ManagerBranchesPage() {
  const { usesFirebaseAuth } = useAuth();
  const { branches, loading, error } = useBranches();
  const [localError, setLocalError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addName, setAddName] = useState("");
  const [addPostcode, setAddPostcode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPostcode, setEditPostcode] = useState("");

  const canWrite = usesFirebaseAuth && isFirebaseConfigured();

  useEffect(() => {
    if (editingId) {
      const row = branches.find((b) => b.id === editingId);
      if (row) {
        setEditName(row.name);
        setEditPostcode(row.postcode);
      }
    }
  }, [editingId, branches]);

  const startEdit = useCallback((row: BranchRecord) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditPostcode(row.postcode);
    setLocalError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setLocalError(null);
  }, []);

  const saveNew = useCallback(async () => {
    const name = addName.trim();
    const postcode = addPostcode.trim();
    if (!name || !postcode) {
      setLocalError("Enter branch name and postcode.");
      return;
    }
    setBusyId("__add__");
    setLocalError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) {
      setLocalError("Firebase not available.");
      setBusyId(null);
      return;
    }
    try {
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(clients.db, "branches"), { name, postcode });
      setAddName("");
      setAddPostcode("");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not add branch.");
    } finally {
      setBusyId(null);
    }
  }, [addName, addPostcode]);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const name = editName.trim();
    const postcode = editPostcode.trim();
    if (!name || !postcode) {
      setLocalError("Enter branch name and postcode.");
      return;
    }
    setBusyId(editingId);
    setLocalError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) return;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(clients.db, "branches", editingId), { name, postcode });
      setEditingId(null);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not update branch.");
    } finally {
      setBusyId(null);
    }
  }, [editingId, editName, editPostcode]);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm("Delete this branch? Existing journeys keep their stored branch name.")) {
      return;
    }
    setBusyId(id);
    setLocalError(null);
    const clients = await ensureFirebaseClients();
    if (!clients) return;
    try {
      const { deleteDoc, doc } = await import("firebase/firestore");
      await deleteDoc(doc(clients.db, "branches", id));
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not delete branch.");
    } finally {
      setBusyId(null);
    }
  }, [editingId]);

  return (
    <ManagerPageShell title="Manage branches">
      <p className="text-sm text-muted">
        Labels use the <strong className="font-medium text-foreground">name</strong>{" "}
        field (stored on journeys as home branch).{" "}
        <strong className="font-medium text-foreground">Postcode</strong> powers ETA
        and location hints (UK format).
      </p>

      {error ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {localError ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {localError}
        </p>
      ) : null}

      {!canWrite ? (
        <p className="rounded-xl border border-border bg-muted-bg/40 px-4 py-3 text-sm text-muted">
          Branch list is read-only in demo mode. Use Firebase mode to add or edit
          branches in Firestore.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add branch</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Leeds"
              disabled={!canWrite || busyId !== null}
            />
          </div>
          <div className="min-w-40 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-pc">Postcode</Label>
            <Input
              id="new-pc"
              value={addPostcode}
              onChange={(e) => setAddPostcode(e.target.value)}
              placeholder="e.g. LS1 4DY"
              disabled={!canWrite || busyId !== null}
            />
          </div>
          <Button
            type="button"
            className="gap-2"
            disabled={!canWrite || busyId !== null}
            onClick={() => void saveNew()}
          >
            {busyId === "__add__" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            Add branch
          </Button>
        </div>
      </Card>

      <div className="mt-6">
        <h2 className="mb-2 text-base font-bold text-foreground">
          Existing branches
        </h2>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : branches.length === 0 ? (
          <p className="text-sm text-muted">No branches yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {branches.map((row) => (
              <li key={row.id}>
                <Card className="border-border/80 p-4">
                  {editingId === row.id ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                      <div className="min-w-48 flex-1 space-y-1.5">
                        <Label htmlFor={`edit-name-${row.id}`}>Name</Label>
                        <Input
                          id={`edit-name-${row.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={busyId !== null}
                        />
                      </div>
                      <div className="min-w-40 flex-1 space-y-1.5">
                        <Label htmlFor={`edit-pc-${row.id}`}>Postcode</Label>
                        <Input
                          id={`edit-pc-${row.id}`}
                          value={editPostcode}
                          onChange={(e) => setEditPostcode(e.target.value)}
                          disabled={busyId !== null}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void saveEdit()}
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : null}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busyId !== null}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{row.name}</p>
                        <p className="text-sm text-muted">
                          Postcode: {row.postcode || "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2"
                          disabled={!canWrite || busyId !== null}
                          onClick={() => startEdit(row)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2 text-danger"
                          disabled={!canWrite || busyId !== null}
                          onClick={() => void remove(row.id)}
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ManagerPageShell>
  );
}
