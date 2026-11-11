# Warmly

Student messenger for desktop web and Android. Angular shares its interface with a Capacitor Android shell. The client connects directly to Supabase Auth and PostgreSQL using a public publishable key. No OpenAI Sites, D1, or server secret is used by the app.

## Set up your existing Supabase project

1. In SQL Editor run `supabase/migrations/202611110002_messenger.sql` once. The previous guest tables and their messages are preserved; they are not copied into private conversations.
2. Configure Google sign-in using [the manual guide](docs/GOOGLE_SIGN_IN.md). Email/password remains optional; keep email confirmation enabled.
3. Run `npm run configure` in the VS Code terminal once and enter the Project URL and **publishable** key. It writes ignored `Client/public/config.json`. Rebuild with `npm start` or `npm run android:sync`.
4. Public configuration is bundled into web and Android; users never enter it. Previously saved browser configuration remains a fallback. A fresh checkout needs configuration again; `.env` is not read.
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

- Google OAuth with PKCE, optional email/password, and unique usernames.
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
