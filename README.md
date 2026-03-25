This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloudflare (Workers)

This app uses [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`).

Next.js is pinned to **16.1.x** (not 16.2.x) until OpenNext fixes [Cloudflare Error 1101 / `prefetch-hints.json`](https://github.com/opennextjs/opennextjs-cloudflare/issues/1157) on Workers.

**One-time:** install the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and run `npx wrangler login`.

**From your machine**

```bash
npm install
npm run deploy
```

`deploy` runs `opennextjs-cloudflare build` then `opennextjs-cloudflare deploy`. Set the same `NEXT_PUBLIC_*` variables you use in `.env.local` in the Cloudflare dashboard (**Workers & Pages → your worker → Settings → Variables**) for production builds, or rely on a CI secret store—`next build` inlines `NEXT_PUBLIC_*` at build time.

**Preview locally (production bundle)**

```bash
npm run preview
```

**Custom domain (e.g. runnersheet.win)** attach the domain to the Worker in the Cloudflare dashboard (Workers route or custom domains). Add `runnersheet.win` (and `www` if used) under **Firebase → Authentication → Authorized domains**.

See also: [Next.js on Cloudflare](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/).
