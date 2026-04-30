import { getSiteUrl } from "@/lib/site";

const DESC =
  "Fewer lost journeys, clearer handovers: RunnerSheet is the digital runner sheet for drivers and managers on phone, tablet, and desktop.";

/** Basic WebApplication schema for rich results eligibility. */
export function JsonLdWebApp() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "RunnerSheet",
    alternateName: "Runner sheet",
    description: DESC,
    url,
    image: [`${url}/og.png`, `${url}/icons/icon-512.png`],
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
