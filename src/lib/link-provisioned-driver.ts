import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

/**
 * When a manager pre-creates users/{placeholderId} with provisionedByManager,
 * the first sign-in with the same email migrates to users/{auth.uid}.
 */
export async function migrateProvisionedDriverProfile(
  db: Firestore,
  user: User,
): Promise<boolean> {
  /** Must match Firestore `users` email field and Auth token for rules. */
  const emailForDoc = user.email?.trim() ?? "";
  if (!emailForDoc) return false;

  const {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch,
  } = await import("firebase/firestore");

  const uidSnap = await getDoc(doc(db, "users", user.uid));
  if (uidSnap.exists()) return false;

  const q = query(
    collection(db, "users"),
    where("email", "==", emailForDoc),
    where("provisionedByManager", "==", true),
  );
  const found = await getDocs(q);
  if (found.empty) return false;

  const placeholder = found.docs[0]!;
  const d = placeholder.data() as Record<string, unknown>;
  const pid = placeholder.id;

  const batch = writeBatch(db);
  batch.set(doc(db, "users", user.uid), {
    accessStatus: "approved",
    role: "driver",
    name: String(d.name ?? ""),
    employeeId: String(d.employeeId ?? ""),
    homeBranch: String(d.homeBranch ?? ""),
    email: emailForDoc,
    linkedFromProvisionId: pid,
  });
  batch.delete(doc(db, "users", pid));
  await batch.commit();
  return true;
}
