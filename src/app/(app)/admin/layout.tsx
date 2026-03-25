import type { Metadata } from "next";

/** Super-admin tools should not appear in search results. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
