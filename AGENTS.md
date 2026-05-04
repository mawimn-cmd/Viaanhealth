# AGENTS.md

Instructions for agents working in this repository.

## What This Repo Is

This is the public `viaanhealth.com` marketing and web auth entry surface. It is separate from the main Viaan product monorepo on purpose.

The main product repo owns PHI-bearing member app, nutritionist console, scoring, Supabase migrations, Edge Functions, and database behavior. This repo must stay public-surface only.

## Scope Rules

- F131 owns route shells for `/`, `/sign-in`, `/auth/confirm`, `/auth/reset`, `/imprint`, `/privacy`, and `/terms`.
- F135 may improve public homepage/static marketing UI only.
- F133 CMS/blog and F134 checkout/subscription are separate features and must not be added here unless explicitly scoped.
- Do not add analytics, session replay, ad pixels, or tracking tags.
- Do not add PHI inputs, biomarker entry forms, scoring prototypes, or biological-age calculators.
- Do not describe Viaan's deterministic scoring as AI.

## Security Rules

- Never commit Supabase service-role keys, API secrets, `.env` files, or credentials.
- Do not hardcode a Supabase project URL or anon key unless the human confirms it is the production Viaan Auth project for this repo.
- Auth pages may use the Supabase anon key only after confirmation.
- `/auth/confirm` must not show an endless "confirming" spinner unless it actually processes the Supabase verification result.
- Push production cutover remains blocked until real Impressum and Datenschutzerklaerung text land via F120/F121 and Vercel processor review is complete under F123/F124.

## Verification

Run:

```sh
pnpm test
```

Tests should fail if hardcoded Supabase refs, JWT-looking keys, analytics tags, PHI examples, or fake production confirmation copy are introduced.

