import type { UserRole } from "@/types/user";

/** Dev/demo only — not secret; do not use in production backends. */
export const DEMO_ACCOUNT_HINT =
  "driver@demo.runnersheet + demo1234 · manager@demo.runnersheet + demo1234";

const PAIRS: Record<
  string,
  { password: string; role: UserRole }
> = {
  "driver@demo.runnersheet": { password: "demo1234", role: "driver" },
  "manager@demo.runnersheet": { password: "demo1234", role: "manager" },
};

export function validateDemoCredentials(
  email: string,
  password: string,
): UserRole | null {
  const key = email.trim().toLowerCase();
  const entry = PAIRS[key];
  if (!entry || entry.password !== password) return null;
  return entry.role;
}
