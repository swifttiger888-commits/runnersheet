import type { UserAccessStatus, UserProfile, UserRole } from "@/types/user";

export type ParsedFirestoreUser = {
  accessStatus: UserAccessStatus | "none";
  role: UserRole | null;
  profile: UserProfile | null;
};

/**
 * Maps `users/{uid}` to app state. Legacy documents may only have `role` + profile fields.
 */
export function parseFirestoreUser(
  data: Record<string, unknown> | undefined,
): ParsedFirestoreUser {
  if (!data) {
    return { accessStatus: "none", role: null, profile: null };
  }

  const roleRaw = data.role;
  const role: UserRole | null =
    roleRaw === "driver" ||
    roleRaw === "manager" ||
    roleRaw === "super-admin"
      ? roleRaw
      : null;

  const accessRaw = data.accessStatus;
  const accessStatus =
    accessRaw === "pending" ||
    accessRaw === "approved" ||
    accessRaw === "rejected"
      ? accessRaw
      : undefined;

  const profile: UserProfile | null =
    data.name != null || data.employeeId != null || data.homeBranch != null
      ? {
          name: String(data.name ?? ""),
          employeeId: String(data.employeeId ?? ""),
          homeBranch: String(data.homeBranch ?? ""),
        }
      : null;

  // Legacy: role set without accessStatus → treat as approved
  if (!accessStatus && role) {
    return { accessStatus: "approved", role, profile };
  }

  if (accessStatus === "pending") {
    return { accessStatus: "pending", role: null, profile };
  }

  if (accessStatus === "rejected") {
    return { accessStatus: "rejected", role: null, profile };
  }

  if (accessStatus === "approved" && role) {
    return { accessStatus: "approved", role, profile };
  }

  // Incomplete / awaiting first request
  return { accessStatus: "none", role: null, profile };
}
