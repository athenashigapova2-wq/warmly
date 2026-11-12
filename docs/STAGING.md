# Warmly staging

Staging is a separate Supabase project. Never clone production user data for testing.
The same GitHub repository builds both environments. A Vercel Preview is a separate
deployment, not a second production release. Supabase does not import this GitHub repo.

## 1. Create the database

Supabase Dashboard > New project > existing organization > **Warmly Staging**.
Use the production region and save the generated database password locally.
Review any billing prompt before proceeding. Copy Project URL from Connect.
Project ref is the first part of `https://PROJECT_REF.supabase.co`.

Copy `supabase/staging.env.example` to `.env.staging` in the repo root.
Fill the two DIFFERENT project refs, staging URL and staging publishable key.
Do not paste database passwords or admin keys into chat, commits, or Vercel.

Generate a single transaction containing migrations 001–005 and a staging marker:

```powershell
node --env-file=.env.staging scripts/staging-bootstrap.mjs
```

In the **new empty staging project's SQL Editor**, run `staging-local/bootstrap.sql`.
Check the project name/ref before Run. The script refuses existing Auth users or
profiles. It is for first setup only, not a migration rerun or production upgrade.
It includes legacy schema to maintain parity with the migration history.
Do not additionally run the five migration files. This manual bootstrap does not
populate the Supabase CLI migration ledger; adopt/repair that ledger explicitly
before using `db push` later.

## 2. Seed synthetic accounts

Locally fill `STAGING_SUPABASE_SECRET_KEY` with the **staging** secret or legacy
service_role key from Supabase API Keys. This credential stays on your computer.
Set `CONFIRM_STAGING_REF` to the staging ref, then:

```powershell
node --env-file=.env.staging scripts/seed-staging.mjs
```

The script checks distinct refs and a server-side staging marker before writes.
It creates 7 confirmed synthetic email/password accounts under `warmly.example`
through the Auth Admin API. It sends no confirmation emails. Random credentials
are saved only in ignored `staging-local/accounts-PROJECT_REF.json`; store that
file securely. Reruns preserve passwords, refresh fixtures and reset their demo
role approvals. No production accounts are copied or deleted. Do not use this
seed during a load test or while collecting restore fingerprints.

Fixtures: Alice/Ben accepted friends, Chloe's pending request, a visitor, an
approved university, an unapproved university and an outsider; three campuses,
DM/group/messages, posts/story, saved post, public listing/private draft, event
with one registration and one free seat. These are a functional dataset, not a
load-test dataset. Admin seeding is not evidence that user permissions work.

## 3. Vercel environment variables

In the EXISTING Vercel project serving warmly-9s8o.vercel.app:

| Variable | Environment | Value |
| --- | --- | --- |
| SUPABASE_URL | Production only | Existing production URL |
| SUPABASE_PUBLISHABLE_KEY | Production only | Existing production publishable key |
| PRODUCTION_SUPABASE_PROJECT_REF | Production and Preview | Production ref (not a secret) |
| STAGING_SUPABASE_PROJECT_REF | Preview only | Staging ref |
| STAGING_SUPABASE_URL | Preview only | Staging URL |
| STAGING_SUPABASE_PUBLISHABLE_KEY | Preview only | Staging publishable key |

Check branch-specific overrides as well. Enable Vercel system environment
variables so `VERCEL_ENV=preview` is available during the build. Preview fails
if staging settings are missing, refs match, or URL mismatches. It never falls
back to production keys. Never override the build command to bypass this check.

Push a non-main branch containing these changes, e.g. `staging`, and use its
Vercel Preview deployment. Keep main as the production branch. Do not promote a
staging-built artifact to Production: production needs its own rebuild with
production variables. Existing previews built before this protection should be
retired or rebuilt; these changes cannot retroactively change their config.

Use the stable branch preview URL as the staging test URL. Keep deployment
protection for invited testers where available. In an incognito browser verify
`/config.json` points to STAGING and shows `environment: staging`; it must contain
no admin credential. The application displays a STAGING banner.

## 4. Staging authentication

In staging Supabase > Authentication > URL Configuration, set Site URL to the
stable staging URL and add that exact URL with trailing slash to Redirect URLs.
Add individual PR preview origins only when needed; avoid an unrestricted
`*.vercel.app` redirect. Keep production redirect settings unchanged.

Email/password synthetic accounts work immediately after seeding. Google is a
separate test: configure a staging Google OAuth Web client, enable the Google
provider in staging Supabase, and copy its client secret only into Supabase.
Google's authorized redirect URI is `https://STAGING_REF.supabase.co/auth/v1/callback`.
Allow designated tester Google accounts in Google's test audience. A successful
synthetic password login does not validate Google OAuth.

## 5. Acceptance and recovery

Use two independent browser sessions. Verify Alice and Ben can read their DM,
Outsider cannot; Visitor cannot publish listings/events; Pending University
cannot create events; approved University can; Alice sees Ben's post but not
Outsider's; private listing stays private. Test friend acceptance and message
delivery, sign-out/sign-in, then follow [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

Do not mark staging ready until the live deployment, Auth and RLS scenarios pass.
Do not mark recovery verified until a backup has actually been restored and
tested in a separate empty target. Local tests alone do not meet either gate.
