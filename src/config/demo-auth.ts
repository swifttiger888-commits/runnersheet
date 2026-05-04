import type { UserRole } from "@/types/user";
import type { UserProfile } from "@/types/user";

/** Local sample accounts — not secret; do not use in production backends. */
export const DEMO_ACCOUNT_HINT =
  "Sample: driver@demo.runnersheet + demo1234 · manager@demo.runnersheet + demo1234";

const PAIRS: Record<
  string,
  { password: string; role: UserRole }
> = {
  "driver@demo.runnersheet": { password: "demo1234", role: "driver" },
  "manager@demo.runnersheet": { password: "demo1234", role: "manager" },
};

export const DEMO_PROFILE: Record<UserRole, UserProfile> = {
  driver: {
    name: "Alex Driver",
    employeeId: "AC-D-1001",
    homeBranch: "Leeds",
  },
  manager: {
    name: "Sam Manager",
    employeeId: "AC-M-2001",
    homeBranch: "Leeds",
  },
  "super-admin": {
    name: "Super Admin",
    employeeId: "AC-SA-0",
    homeBranch: "HQ",
  },
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
