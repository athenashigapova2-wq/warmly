# Architecture

Angular UI → supabase-js → Supabase Auth / PostgreSQL.

Web distribution: static files. Android: Capacitor 8 packages the same static files. No OpenAI hosting and no trusted API key in either client.

Tables: profiles (public name/username), friendships (pending/accepted), conversations (direct/group), conversation_members, messages. Auth identity comes from auth.uid(). RLS protects all reads; direct table writes are denied. The messenger SQL function handles validated writes in transactions. It validates friendship before creating a direct chat or adding a group member, owner rights for group changes, and membership before reading/sending. Direct pairs and client message IDs are unique. The is_chat_member helper avoids recursive membership policies.

Polling every 2.5 seconds refreshes conversations and the selected chat. History uses id-based pagination of 50 messages. Retrying an unconfirmed send reuses its client ID. Old guest messages remain in warmly_messages; no guest identity is treated as an authenticated account.

Before production: abuse protection, account recovery, removal/blocking, membership history semantics, attachment storage policies, push delivery, and explicit retention policy. Group members currently see the group's full history including messages before joining. Leaving removes future server access but cannot erase content a member already viewed.
