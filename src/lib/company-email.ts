/**
 * Restricts sign-in to company addresses when `NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN`
 * is set (e.g. `arnoldclark.com`). If unset, all emails are allowed (local dev).
 */
export function getCompanyEmailDomain(): string {
  return (process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN ?? "").trim();
}

export function isCompanyEmailAllowed(email: string | null | undefined): boolean {
  const domain = getCompanyEmailDomain();
  if (!domain) return true;
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  const suffix = domain.startsWith("@") ? domain.toLowerCase() : `@${domain.toLowerCase()}`;
  return lower.endsWith(suffix);
}
