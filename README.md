# viaanhealth.com

Public website and web auth entry surface for Viaan Health v1.

This repository is intentionally separate from the main Viaan product monorepo to keep the public marketing/auth surface apart from PHI-bearing member, nutritionist, scoring, database, and Edge Function code.

## Scope

- Marketing homepage and static public pages.
- Web auth entry route shells:
  - `/sign-in`
  - `/auth/confirm`
  - `/auth/reset`
- Legal placeholder routes:
  - `/imprint`
  - `/privacy`
  - `/terms`

## Hard Boundaries

- No PHI inputs or PHI processing.
- No biomarker/scoring prototype or biological-age calculator.
- No analytics, session replay, pixels, GA4, Clarity, Hotjar, or similar tags in v1 auth pages.
- No Supabase service-role keys.
- No hardcoded Supabase project URL or anon key until the production Viaan Auth project is verified.
- No production cutover with placeholder Impressum or Datenschutzerklaerung text.

## Production Gates

Real-user production traffic is blocked until:

- F120/F121 provide real legal text.
- F123/F124 cover Vercel processor review.
- The production Supabase Auth project is verified.
- `/auth/confirm` consumes the real Supabase verification result and shows real success/error states.

## Local Checks

```sh
pnpm test
```



## Owner-first password setup implementation (approved 2026-10-30)

The human approved extending the existing password page for Supabase-issued TokenHash fragments, explicit verification and memory-only session reuse for password retries, while retaining existing recovery access-token links. DE-primary neutral initial/reset copy, fixed provider destinations, scope-local cleanup and safe localized errors are in scope. No DOB/consent/PHI input, new auth provider or member signup entry is added on this public surface.

The coordinated product-repo PR owns signup, membership and legal completion. Production remains paused. The compatible website must be deployed before a shared recovery-template switch, with both old/new link formats proved and preserved during rollback. Implementation approval is not permission to change a hosted template, credentials, quota, paid plan or production deployment.
