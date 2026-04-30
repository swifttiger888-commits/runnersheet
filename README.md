# RunnerSheet

RunnerSheet is a digital runner sheet for branch journey operations.

It provides:

- driver journey start/end flow with correction windows and audit trail
- manager review, approvals, reporting, and search workflows
- Firebase-backed auth and Firestore data with Cloudflare Workers deployment

This repository is currently operated as a trial product. See `docs/SECURITY-AND-TRIAL-SCOPE.md`.

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Firebase Auth + Firestore
- OpenNext + Cloudflare Workers

## Core route groups

- Public/marketing: `/`
- Auth + app: `/login`, `/driver`, `/manager/*`
- Admin: `/admin/master`
- API routes: `/api/*` (DVLA, postcodes, voice, manager search)

See `docs/SYSTEM-OVERVIEW.md` for architecture and data flow.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create local env file from `.env.example`:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

## Build and quality checks

```bash
npm run build
npm run lint
```

## Deploy (Cloudflare Workers)

This app uses [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`).

```bash
npm run deploy
```

`deploy` runs `opennextjs-cloudflare build` then `opennextjs-cloudflare deploy`.

CI deploys on pushes to `main` via `.github/workflows/ci.yml`.

## Environment configuration notes

- `NEXT_PUBLIC_*` values are inlined at build time.
- Keep production `NEXT_PUBLIC_SITE_URL` correct for canonical metadata/sitemap.
- Ensure Firebase Auth authorized domains include `runnersheet.win` and `www.runnersheet.win`.
- For manager AI search, configure DeepSeek server-side key in deployment env.

## Operations docs

- `docs/NEXT-STEPS.md` - sprint/deploy checklist
- `docs/SYSTEM-OVERVIEW.md` - architecture and flows
- `docs/SECURITY-AND-TRIAL-SCOPE.md` - trial boundaries and security posture
- `docs/IT-ALLOWLIST.md` - domains to allow on strict workplace networks
- `docs/MANAGER-EXECUTIVE-SUMMARY.md` - one-page manager handover
- `docs/MANAGER-USER-GUIDE.md` - step-by-step manager operating guide
