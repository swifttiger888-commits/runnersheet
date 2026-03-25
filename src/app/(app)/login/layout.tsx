import type { Metadata } from "next";

/** Keep sign-in out of search results; still follow links for crawl budget. */
export const metadata: Metadata = {
  title: "Sign in",
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
