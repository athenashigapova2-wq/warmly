# Warmly

Student messenger for desktop web and Android. Angular shares its interface with a Capacitor Android shell. The client connects directly to Supabase Auth and PostgreSQL using a public publishable key. No OpenAI Sites, D1, or server secret is used by the app.

## Set up your existing Supabase project

1. In SQL Editor run `supabase/migrations/202611110002_messenger.sql` once. The previous guest tables and their messages are preserved; they are not copied into private conversations.
2. Enable Email sign-in under Authentication → Sign In / Providers. Keep email confirmation enabled. Configure Authentication → URL Configuration with your web address (`http://localhost:3000` during local tests); users confirm in their browser and then sign in to the app.
3. Start the app. On its one-time setup screen enter Project URL and a **publishable** key (or legacy anon key). Do not enter a secret/service_role key. Configuration is stored only in that browser/app.
4. Alternatively, copy `Client/public/config.example.json` to ignored `Client/public/config.json`, fill its public values and rebuild. This skips setup on web and Android. Only this public file is bundled; `.env` is not read by the build.
5. Create two accounts, confirm their emails, and choose different usernames. Search for the other username in People, send and accept a friend request. Message opens a direct chat; New group creates a group with accepted friends.

Your old local `.env` is no longer needed by the new application. Do not copy it into `Client/public` or Android assets.

## Development

Node 24.15+:

```sh
npm ci
npm start
```

Open http://localhost:3000. For Angular live editing use `npm run dev` at http://localhost:4200. `npm test` executes the migration and authorization flows against PGlite (PostgreSQL), with a simulated auth.uid(); it does not touch your Supabase project.

## Features

- Email/password accounts and unique usernames.
- Username search, friend requests, accept, decline, cancel.
- One direct conversation per friend pair, persistent history.
- Groups of up to 50 members, owner adds accepted friends; non-owners can leave.
- Member-only reading/writing enforced in PostgreSQL, not just the interface.
- 50-message history pages, send deduplication and rate limiting, reconnect polling every 2.5 seconds.
- Responsive desktop and phone layouts, Android native project.

## Android

See `docs/ANDROID.md`. Public credentials only are permitted in the build. This test release has no push notifications, attachments, calls, end-to-end encryption, password-reset UI, group ownership transfer, or offline outgoing queue yet. Signed-in people can discover public display names and usernames; email addresses are not in profiles. Database operators can read messages. Profile discovery and friend requests need stronger abuse controls before a broad public launch.

## Deployment

`npm run build` produces `dist/warmly/browser`, which can be served by any HTTPS static web host outside OpenAI. No Node backend or secret environment variables are required for production. Supabase stores all new accounts, friendships, groups and messages. No automatic deployment is configured.
