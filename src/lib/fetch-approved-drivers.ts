import type { Firestore } from "firebase/firestore";

export type ApprovedDriverRow = {
  id: string;
  name: string;
  email: string;
  isInstalled: boolean;
};

function isApprovedDriverDoc(data: Record<string, unknown>): boolean {
  const st = data.accessStatus;
  if (st === "pending" || st === "rejected") return false;
  return true;
}

export async function fetchApprovedDrivers(
  db: Firestore,
): Promise<ApprovedDriverRow[]> {
  const { collection, getDocs, query, where } = await import("firebase/firestore");
  const q = query(collection(db, "users"), where("role", "==", "driver"));
  const snap = await getDocs(q);
  const rows: ApprovedDriverRow[] = [];
  snap.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    if (!isApprovedDriverDoc(x)) return;
    rows.push({
      id: d.id,
      name: String(x.name ?? ""),
      email: String(x.email ?? ""),
      isInstalled: x.isInstalled === true,
    });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return rows;
}

export function computeAppAdoptionPercent(
  drivers: ApprovedDriverRow[],
): number | null {
  if (drivers.length === 0) return null;
  const installed = drivers.filter((d) => d.isInstalled).length;
  return Math.round((installed / drivers.length) * 100);
}
