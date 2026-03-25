"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import type { UserRole } from "@/types/user";

/**
 * Redirects to `/login` when the session role does not match `expected`.
 * Use `gateOk` to render protected UI only when the user is allowed.
 */
export function useRequireRole(expected: UserRole) {
  const router = useRouter();
  const { ready, role } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (role !== expected) router.replace("/login");
  }, [ready, role, expected, router]);

  const gateOk = Boolean(ready && role === expected);
  return { gateOk };
}
