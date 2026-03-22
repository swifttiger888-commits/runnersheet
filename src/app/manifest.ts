import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RunnerSheet",
    short_name: "RunnerSheet",
    description: "AC Vehicle Tracker — journeys and branch reports",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f4f5",
    theme_color: "#c41e3a",
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
