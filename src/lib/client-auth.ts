import { ensureFirebaseClients } from "@/lib/firebase";

export async function getAuthHeader(): Promise<Record<string, string>> {
  const clients = await ensureFirebaseClients();
  if (!clients) return {};
  // authStateReady() resolves once Firebase has finished restoring the persisted
  // session from IndexedDB/localStorage. Without this, currentUser is null during
  // the async restoration window and the request goes out without a Bearer token.
  await clients.auth.authStateReady();
  const user = clients.auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}
