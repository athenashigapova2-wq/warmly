# Verification

`npm test` runs the actual messenger SQL migration in PGlite (PostgreSQL). It creates three synthetic identities and checks profile uniqueness, friendship consent, one direct chat per pair, message deduplication, sender identity, group ownership, leaving, pagination, RLS reads and denied direct writes. Supabase Auth itself is not emulated: auth.uid() is supplied by a local test shim. Run a separate two-account test in your real Supabase project after migration.

For visual UI checks only: `npx ng build --configuration=qa --output-path dist/qa`, then serve `dist/qa/browser` on a separate localhost port. The QA entrypoint injects synthetic people and messages without network calls. It is not the production app and is never included in `npm run build` or Android sync. It can validate UI flows, but cannot establish that live Supabase authentication or messaging works.

Manual real-project acceptance: two verified accounts, create profiles, search usernames, send/accept request, exchange messages, refresh page, sign in on another device, create group, add accepted friend, leave as non-owner, verify a third non-member cannot query the conversation. Verify soft keyboard, back navigation and resume on Android.
