# Warmly MVP

Implemented in this slice: Supabase email/password accounts, unique usernames, friend requests and acceptance, direct conversations, groups, member-only messages and paginated history. English responsive Angular UI shared with Capacitor Android. Storage is Supabase, not MongoDB or D1. No OpenAI hosting integration remains.

Next: password recovery, profile editing and university details, blocking/removing contacts, group ownership transfer, attachments and push notifications. Calls and end-to-end encryption need separate design. Campus feed, study buddy, events and marketplace follow the core messenger.

Acceptance: apply the new SQL migration in the real project, register two verified accounts, accept friendship, exchange messages and create a group. Local PostgreSQL contract/access tests and fixture-based desktop/mobile UI checks are in tests; they do not substitute for real Supabase and physical-phone tests.
