# Supabase storage

Warmly's target database is the **Warmly** project in Supabase. Both the local server
and the published Worker use the same PostgreSQL RPC and tables. There is no D1 or
in-memory fallback in this version.

## Required setup

1. Apply `supabase/migrations/202611110001_warmly_chat.sql` to the selected project.
2. Configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the server environment.
   `SUPABASE_SERVICE_ROLE_KEY` is also accepted for legacy service-role keys.
3. For local development, copy `.env.example` to `.env` and fill it in locally.
4. For Sites, store these variables in the Site's runtime environment, never in source.

The secret key must not appear in Angular, browser storage, screenshots, Git, or chat messages.
The Data API RPC is executable only by `service_role`. RLS is enabled on both tables;
`anon` and `authenticated` have no table access and cannot invoke the RPC.

Tables: `public.warmly_sessions` and `public.warmly_messages`. Guest sessions expire
after 24 hours; online presence expires after 30 seconds. The latest 100 messages
are retained, and the UI refreshes every 1.5 seconds. Supabase Auth accounts are not
part of this migration: guests still enter an unverified display name.

## Cutover checklist

- Confirm the Supabase project and inspect existing objects before applying SQL.
- Verify schema, RPC health, invalid tokens, concurrent sending, and RLS denial for public keys.
- Copy retained messages from the former D1 database, preserving IDs and ordering.
  Do not migrate expired guest credentials. Existing visitors join again after cutover.
- Configure server variables, deploy with `d1: null`, and check two independent guests.
- Verify `/api/health` returns `storage: supabase` from the live deployment.
- Keep the old D1 database disconnected as a rollback backup; deleting it is a separate action.

Historical D1 migrations are archived unchanged under `docs/legacy-d1/`; they are not
part of the deployment package. Sites can continue to host the page and stateless API,
but it no longer supplies application storage after a successful cutover.

## Validation

`npm test` checks the HTTP/Supabase integration contract without production credentials.
These tests do not replace a real PostgreSQL migration/RLS check. `npm run build`
builds Angular and packages the stateless Worker. `npm run dev` and
`npm run preview:hosted` require the configured Supabase server environment.
