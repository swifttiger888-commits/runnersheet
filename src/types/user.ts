export type UserRole = "driver" | "manager" | "super-admin";

/** Firestore `users/{uid}.accessStatus` — legacy profiles may omit this (treated as approved). */
export type UserAccessStatus = "pending" | "approved" | "rejected";

export type UserProfile = {
  name: string;
  employeeId: string;
  homeBranch: string;
};
