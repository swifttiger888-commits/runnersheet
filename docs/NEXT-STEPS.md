# RunnerSheet — next steps (ordered checklist)

Use this after deploys or when planning a sprint. Check items off as you go.

## 1. Ship & verify

- [ ] Deploy: `npm run ship` (or Cloudflare pipeline).
- [ ] Smoke test: home (`/`), sign-in (`/login`) — Google, email sign-in, create account, forgot password, request access.
- [ ] Smoke test: manager (`/manager`) and driver (`/driver`) with a real Firebase user.
- [ ] If Firestore rules changed: `npm run firebase:deploy:firestore`.

## 2. Performance & quality

- [ ] Run Lighthouse or PageSpeed Insights on `/` and `/login` (mobile + desktop).
- [ ] Fix any regressions (LCP, CLS, large JS) before adding heavy features.

## 3. Product reliability

- [ ] **NIP lookup**: if misses are common — normalize plate in Firestore queries and/or relax the time-window rule (see `lib/nip-journey.ts` and `manager/nip-lookup`).
- [ ] **Roles**: decide whether super-admins should access `/manager/*` or only `/admin/master` (currently manager-only).

## 4. SEO (optional)

- [ ] Keep `NEXT_PUBLIC_SITE_URL` correct in production for metadata, sitemap, and OG URLs.
- [ ] Refresh `public/og.png` after branding changes: `npm run generate:og`.

## 5. Security (when you need it)

- [ ] Firebase Console: password policy, authorized domains for password reset.
- [ ] Optional: App Check, reCAPTCHA, MFA — plan before implementing in the app.

## 6. Automation

- [ ] CI runs on PRs (see `.github/workflows/ci.yml`): `npm ci` + `npm run build` (+ lint if you want).

---

*Last updated with repo layout: `(app)` route group for auth-heavy routes, `og.png` for social previews.*
