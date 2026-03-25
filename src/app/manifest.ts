import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RunnerSheet",
    short_name: "RunnerSheet",
    description:
      "RunnerSheet — free journeys and reports for Arnold Clark drivers and managers. Independent app.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0d0d0f",
    theme_color: "#635bff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
