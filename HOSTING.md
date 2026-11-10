# Warmly web testing

The complete user interface is English. The same Angular UI supports two runtimes:

- Local development: Express + Socket.IO, with messages in server memory.
- Public web testing: a Cloudflare Worker deployed through Sites, with shared D1 storage.

The hosted room polls for new messages every 1.5 seconds. It retains the latest 100 messages.
Guests choose a display name; names are not verified. Everyone in the public room can read its history.
There are no accounts, private chats, attachments or moderation tools yet.

The hosted API issues random, short-lived guest tokens, stores only their hashes,
validates message lengths, limits sending frequency, and ignores client-supplied sender identities.
Online presence expires after 30 seconds without a heartbeat. Guest sessions expire after 24 hours.

## Build and test

```sh
npm ci
npm test
npm run build
npm run preview:hosted
```

The last command starts a local preview of the hosted Worker at http://127.0.0.1:4300,
using an in-memory SQLite adapter with the same schema and SQL as D1. It does not use the live database.
Set `CHAT_URL` to that address and run `npm run test:browser` for two-browser checks.
The existing `npm run dev` command still starts local Angular and Socket.IO development.

`Hosting/worker.js` contains the hosted API, `Hosting/build.mjs` embeds the compiled Angular assets,
and `drizzle/` contains the initial D1 schema migration. Applied migrations must not be edited.
The Site identity and D1 binding are in `.openai/hosting.json`.

The hosted Worker does not execute Express or the local Node dependency tree. Remaining local
toolchain/server audit warnings are documented in `DEPENDENCIES.md`.
