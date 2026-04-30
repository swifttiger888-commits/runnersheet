# RunnerSheet System Overview

## Product shape

RunnerSheet is a web application with two operational personas:

- **Driver**: start/end journeys, correction requests in allowed window
- **Manager**: monitor journeys, review corrections, generate reports

The app is designed for browser-first operation (mobile for drivers, desktop for managers).

## Runtime and deployment

- Next.js App Router application
- OpenNext build target for Cloudflare Workers
- CI deploy on pushes to `main`

## Core technical layers

- **UI/routes**: `src/app` and shared components in `src/components`
- **Domain logic**: `src/lib`
- **State/contexts**: `src/context`
- **APIs**: `src/app/api/*`

## Authentication and roles

- Firebase Auth provides identity.
- App role is resolved from Firestore `users/{uid}` profile (`driver`, `manager`, `super-admin`).
- Role-gated areas:
  - Driver app: `/driver`
  - Manager app: `/manager/*`
  - Admin area: `/admin/master`

## Primary data model (high level)

- `users` - role + profile + access status
- `journeys` - journey lifecycle and correction metadata
- `alerts` - manager-facing operational alerts
- `branches` - branch metadata for selection/reporting

## Key workflows

### Driver

1. Sign in
2. Start journey
3. End journey
4. (Optional) Submit correction within allowed time window

### Manager

1. Sign in
2. Review journeys/corrections
3. Filter/search and inspect details
4. Export reports

## External service touchpoints

- Firebase APIs (`*.googleapis.com`, `*.gstatic.com`, `accounts.google.com`)
- DeepSeek API (manager search, when enabled)
- Postcodes API (lookup features)
- DVLA API (vehicle checks)

## Design and code quality notes

- Shared UI primitives in `src/components/ui/*`
- Type-safe records in `src/types/*`
- Normalization/parsing in `src/lib/normalize-records.ts`
- Centralized auth state in `src/context/auth-context.tsx`

## Related docs

- `README.md`
- `docs/SECURITY-AND-TRIAL-SCOPE.md`
- `docs/IT-ALLOWLIST.md`
- `docs/NEXT-STEPS.md`
