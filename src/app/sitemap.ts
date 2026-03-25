import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * Public/marketing and app entry URLs. Login is noindex via layout; /admin is not listed
 * (super-admin-only, noindex via admin layout).
 */
const PATHS = [
  "/",
  "/login",
  "/privacy",
  "/driver",
  "/manager",
  "/manager/approvals",
  "/manager/alerts",
  "/manager/branches",
  "/manager/drivers",
  "/manager/drivers/add",
  "/manager/journeys",
  "/manager/nip-lookup",
  "/manager/reports",
  "/manager/reviews",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  return PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
