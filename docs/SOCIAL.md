# Social feed rollout

Run only supabase/migrations/202611110003_social.sql in the existing Supabase SQL Editor. It is transactional and re-runnable. It preserves accounts, friends, and chats. No new keys, bucket or provider setup is needed.

Home shows your posts and accepted contacts' posts, newest first, 20 at a time. Stories are visible for 24 hours, with a 100-story recent window. Refresh fetches new content. Authors can delete their content. Profiles support name, username, university, program/year, bio and interests.

Photos are resized locally to JPEG, up to 800px and 220,000 data-URL characters. This MVP stores small images alongside rows under the same RLS rules. For larger media volumes, migrate photos to private Storage. Video, avatar uploads, likes and comments are not included. Expired story rows remain in the database but are hidden by RLS; retention cleanup is separate future work.

Test with two friends and an unrelated account: publish text and photo posts/stories, verify visibility, refresh, delete own content, edit profile and reload. Pending friends cannot see posts. Database tests cover RLS, ownership, expiration, forged authors/timestamps, profile edits and repeated migration.
