# Warmly

A student community chat with an English interface and **Supabase PostgreSQL storage**.

Public test site: https://warmly-campus-chat.athena-is-you.chatgpt.site

> This Supabase-only version has D1 disabled. Chat is temporarily offline until project access,
> schema migration and server credentials are configured and verified.

## Run locally

Use Node.js 24.15 or later. Configure the selected Supabase project using [HOSTING.md](HOSTING.md),
then create a local `.env` from `.env.example`. Do not commit the server key.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4200. Angular proxies API calls to the local server on port 3000.
Both local and hosted clients use Supabase; missing credentials return a configuration
error rather than silently storing data elsewhere.

For a built preview: `npm start` serves http://127.0.0.1:3000.

## Current features

- A shared guest chat, English interface and responsive mobile layout.
- Online presence, reconnect handling and the latest 100 messages.
- Server-generated identity, input limits, duplicate prevention and transactional rate limits.
- Public testing without verified accounts; all room participants can read its messages.

## Checks

```sh
npm test
npm run build
```

With a configured database and running server, `npm run test:browser` checks two browser sessions.
SQL migration and RLS checks must also pass against Supabase before publishing the cutover.

Source: `Client/src`, `Server`, `Hosting`, and `supabase/migrations`.
Known dependency limitations: [DEPENDENCIES.md](DEPENDENCIES.md).
