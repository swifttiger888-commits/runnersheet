import { ensureFirebaseClients } from "@/lib/firebase";

export async function getAuthHeader(): Promise<Record<string, string>> {
  const clients = await ensureFirebaseClients();
  const user = clients?.auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}
