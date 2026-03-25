import { AuthProvider } from "@/context/auth-context";
import { BranchesProvider } from "@/context/branches-context";
import { JourneyDataProvider } from "@/context/journey-data-context";
import { SessionBranchProvider } from "@/context/session-branch-context";

/**
 * Authenticated / app shell routes: Firebase auth + journey + branch data.
 * The marketing home page (`/`) stays outside this group for a lighter first load.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <BranchesProvider>
        <SessionBranchProvider>
          <JourneyDataProvider>{children}</JourneyDataProvider>
        </SessionBranchProvider>
      </BranchesProvider>
    </AuthProvider>
  );
}
