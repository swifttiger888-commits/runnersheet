import type { UserRole } from "@/types/user";
import type { UserProfile } from "@/types/user";

/** Local sample accounts — not secret; do not use in production backends. */
export const DEMO_ACCOUNT_HINT = "";

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
  void email;
  void password;
  return null;
}
