/**
 * Turn raw Firestore / network messages into short, actionable copy for end users.
 */
export function friendlyFirestoreError(message: string): string {
  const m = message.trim().toLowerCase();
  if (!m) return "Something went wrong. Please try again.";

  if (
    m.includes("permission") ||
    m.includes("missing or insufficient permissions")
  ) {
    return "You don’t have permission to do that. Make sure you’re signed in as a manager and try again.";
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("load failed")
  ) {
    return "Network problem — check your connection and try again.";
  }
  if (m.includes("index") && m.includes("query")) {
    return "The database is still catching up. Wait a minute and try again, or contact support if this keeps happening.";
  }
  if (m.includes("unavailable") || m.includes("deadline")) {
    return "The service is busy. Try again in a moment.";
  }

  return message;
}
