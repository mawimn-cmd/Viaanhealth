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

