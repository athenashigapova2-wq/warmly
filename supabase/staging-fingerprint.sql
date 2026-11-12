-- READ ONLY. Run as database owner before backup and on the restored target.
-- Pause test writes while exporting. Compare table counts AND hashes.
-- No password hashes or user records are emitted.
begin read only;
select 'profiles' as relation, count(*) as rows, md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) as fingerprint from public.profiles t
union all select 'friendships',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.friendships t
union all select 'conversations',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.conversations t
union all select 'conversation_members',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by conversation_id,user_id),'')) from public.conversation_members t
union all select 'messages',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.messages t
union all select 'social_posts',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.social_posts t
union all select 'saved_posts',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,post_id),'')) from public.saved_posts t
union all select 'book_listings',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.book_listings t
union all select 'account_roles',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id),'')) from public.account_roles t
union all select 'campus_events',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.campus_events t
union all select 'event_registrations',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by event_id,user_id),'')) from public.event_registrations t
union all select 'warmly_sessions',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.warmly_sessions t
union all select 'warmly_messages',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by seq),'')) from public.warmly_messages t
union all select 'auth.users',count(*),md5(coalesce(string_agg(id::text||coalesce(email,'')||coalesce(encrypted_password,''),'' order by id),'')) from auth.users
union all select 'auth.identities',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from auth.identities t
order by relation;
select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
commit;
