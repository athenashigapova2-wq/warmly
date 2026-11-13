# Discover, media and conversations

Feature branch: `feature/discover-social`. Keep the current staging test round
on its existing commit. No remote database migration is performed by the build.

Discover now opens three destinations: Stories, Events and Marketplace. People,
university browsing and friendship requests remain available in Connections.
Stories supports persistent posts or 24-hour stories, one image/video attachment,
one changeable heart/thumb reaction per member, and paginated comments. Users can
delete their own comments; post owners can remove comments on their posts.
Profile photos appear in profiles, feed, Connections, account menu and messages.

## Rollout after the existing test round

1. Back up the target test database. Apply ONLY
   `supabase/migrations/202611130006_discover_media.sql` in its SQL Editor.
   This migration is additive and rerunnable. Do not rerun bootstrap or seed.
2. The migration creates private `warmly-social` and `warmly-avatars` buckets.
   Confirm Storage is enabled and the global upload limit permits 25 MB.
3. Open a Preview of the feature branch with staging variables. Confirm its
   `/config.json` points to the intended test project, never production.
4. Repeat Alice/Ben/Outsider tests for posts, comments, reactions, avatar changes,
   story expiry and signed media access; also test a real MP4 on Android/iOS.
5. Only merge/release after the live checks pass. Existing clients can still read
   text and legacy inline images; they will not render new media attachments.

## Backend boundaries

- Contact-only RLS covers posts, reaction rows, comments, aggregate counts and
  social media. Non-contacts cannot create/read interactions on hidden posts.
- New signed URLs require permission; already-issued URLs are bearer links valid
  for up to five minutes. Revocation/expiry cannot retract already-downloaded
  bytes. Avatar photos are visible to authenticated profile viewers.
- Uploads require a path under the signed-in user's UUID; profile/post constraints
  prevent attaching a different user's path. No object overwrite policy is granted.
- Photos: JPG/PNG/WebP input up to 10 MB, resized/re-encoded as JPEG. Avatar bucket
  max 2 MB; social bucket max 25 MB, JPEG/MP4/WebM only. Client checks supplement
  bucket/RLS enforcement. No server transcoding or malware scanning is provided.
- Videos use browser playback controls with no autoplay. Codec support depends
  on the browser/device; MP4/WebM container names alone do not guarantee playback.
- Comments are 1–1000 characters, server-dated, with a serialized two-second
  per-author cooldown. Unique client comment IDs make retry inserts idempotent.
- Feed activity is fetched in batches of up to 100 post IDs; comments fetch only
  when opened, 20 at a time. No per-post background polling was introduced.
- Media objects are immutable. Old/replaced avatars, abandoned uploads and
  deleted/expired post files currently remain private in Storage. Before a broad
  release add a scheduled Storage-API cleanup with a grace period and a verified
  reference check. Never delete storage.objects rows directly as blob cleanup.
- Reactions/comments cascade when a post is deleted. Blocking/reporting and a
  moderator workflow remain separate production-readiness work.

## Backup impact

Database dumps no longer suffice for new attachments. In addition to Auth and
application data, back up private bucket object bytes and verify checksums during
restore. Preserve bucket configuration/RLS from migrations; test original logins,
post visibility and media retrieval on the restored project. Existing recovery
runbook must be exercised with at least one photo, video and avatar.

## Verification scope

`npm test` includes PostgreSQL tests for read/write isolation, spoofed media paths,
exclusive reactions, comment cooldown, expiry and revoked friendship. PGlite uses
a simulated Storage metadata schema: this is NOT a live Storage HTTP test.
`tests/discover-hub-ui.mjs` uses local fixtures for routing, reactions, comments,
uploads/avatar controls and mobile layout. The fixture video tests the upload UI,
not actual decoding. Real Supabase upload/playback/OAuth checks remain required.

## Retention hypothesis

Measure whether people return to useful conversations: weekly returning members,
posts receiving replies, accepted friendships leading to conversations and event
participation. Treat session duration as context, not the success target. This
change adds no analytics SDK, notification pressure, autoplay or infinite scroll.
