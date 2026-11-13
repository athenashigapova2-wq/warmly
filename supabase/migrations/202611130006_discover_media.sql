-- Additive feature migration. Apply only to the isolated feature test database first.
begin;
alter table public.profiles add column if not exists avatar_path text not null default ''
 check(avatar_path='' or (length(avatar_path)<200 and avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and split_part(avatar_path,'/',1)=id::text));
grant update(avatar_path) on public.profiles to authenticated;
alter table public.social_posts add column if not exists media_path text not null default '';
alter table public.social_posts add column if not exists media_type text not null default '';
-- Replace the legacy content check to allow media-only posts; keep other checks.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.social_posts'::regclass and contype='c' and pg_get_constraintdef(oid) like '%btrim(body)%' loop
 execute format('alter table public.social_posts drop constraint %I',c.conname); end loop;
end $$;
alter table public.social_posts drop constraint if exists social_content;
alter table public.social_posts add constraint social_content check(length(btrim(body))>0 or image<>'' or media_path<>'');
alter table public.social_posts drop constraint if exists social_media;
alter table public.social_posts add constraint social_media check(
 (media_path='' and media_type='') or
 (length(media_path)<200 and split_part(media_path,'/',1)=author_id::text and
 ((media_type='image' and media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') or
  (media_type='video' and media_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm)$'))));
grant insert(media_path,media_type) on public.social_posts to authenticated;

create or replace function public.can_read_social(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.social_posts p where p.id=target and
 public.social_visible(p.author_id) and (p.kind='post' or p.created_at>now()-interval '24 hours'));
$$;
revoke all on function public.can_read_social(uuid) from public,anon;
grant execute on function public.can_read_social(uuid) to authenticated;

create table if not exists public.post_reactions (
 post_id uuid not null references public.social_posts(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('heart','thumb')), primary key(post_id,user_id)
);
create table if not exists public.post_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.social_posts(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists comments_timeline on public.post_comments(post_id,created_at,id);
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
revoke all on public.post_reactions,public.post_comments from anon,authenticated;
grant select,delete on public.post_reactions,public.post_comments to authenticated;
grant insert(post_id,kind),update(kind) on public.post_reactions to authenticated;
grant insert(id,post_id,body) on public.post_comments to authenticated;
drop policy if exists reactions_read on public.post_reactions;
create policy reactions_read on public.post_reactions for select to authenticated using(public.can_read_social(post_id));
drop policy if exists reactions_add on public.post_reactions;
create policy reactions_add on public.post_reactions for insert to authenticated with check(user_id=auth.uid() and public.can_read_social(post_id));
drop policy if exists reactions_edit on public.post_reactions;
create policy reactions_edit on public.post_reactions for update to authenticated using(user_id=auth.uid() and public.can_read_social(post_id)) with check(user_id=auth.uid() and public.can_read_social(post_id));
drop policy if exists reactions_remove on public.post_reactions;
create policy reactions_remove on public.post_reactions for delete to authenticated using(user_id=auth.uid());
drop policy if exists comments_read on public.post_comments;
create policy comments_read on public.post_comments for select to authenticated using(public.can_read_social(post_id));
drop policy if exists comments_add on public.post_comments;
create policy comments_add on public.post_comments for insert to authenticated with check(author_id=auth.uid() and public.can_read_social(post_id));
drop policy if exists comments_remove on public.post_comments;
create policy comments_remove on public.post_comments for delete to authenticated using(author_id=auth.uid() or exists(select 1 from public.social_posts p where p.id=post_id and p.author_id=auth.uid()));

create or replace function public.social_activity(targets uuid[])
returns table(post_id uuid,hearts bigint,thumbs bigint,comments bigint,mine text)
language sql stable set search_path='' as $$
 select p.id,
 (select count(*) from public.post_reactions r where r.post_id=p.id and r.kind='heart'),
 (select count(*) from public.post_reactions r where r.post_id=p.id and r.kind='thumb'),
 (select count(*) from public.post_comments c where c.post_id=p.id),
 (select r.kind from public.post_reactions r where r.post_id=p.id and r.user_id=auth.uid())
 from public.social_posts p where p.id=any(targets[1:100]);
$$;
revoke all on function public.social_activity(uuid[]) from public,anon;
grant execute on function public.social_activity(uuid[]) to authenticated;

-- Per-user DB serialization prevents simultaneous comments bypassing the cooldown.
create or replace function public.limit_social_comments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.author_id::text,6));
 if exists(select 1 from public.post_comments where author_id=new.author_id and created_at>clock_timestamp()-interval '2 seconds' and id<>new.id) then
 raise exception 'Please wait a moment before commenting again.'; end if;
 return new;
end $$;
drop trigger if exists comment_cooldown on public.post_comments;
create trigger comment_cooldown before insert on public.post_comments for each row execute function public.limit_social_comments();
revoke all on function public.limit_social_comments() from public,anon,authenticated;

-- Private buckets: even known object paths require authorization for new URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('warmly-avatars','warmly-avatars',false,2097152,array['image/jpeg']),
 ('warmly-social','warmly-social',false,26214400,array['image/jpeg','video/mp4','video/webm'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists warmly_media_insert on storage.objects;
create policy warmly_media_insert on storage.objects for insert to authenticated with check(
 bucket_id in ('warmly-avatars','warmly-social') and split_part(name,'/',1)=auth.uid()::text and
 name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|mp4|webm)$' and
 (bucket_id<>'warmly-avatars' or name like '%.jpg'));
drop policy if exists warmly_media_delete on storage.objects;
create policy warmly_media_delete on storage.objects for delete to authenticated using(bucket_id in ('warmly-avatars','warmly-social') and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists warmly_media_read on storage.objects;
create policy warmly_media_read on storage.objects for select to authenticated using(
 (bucket_id in ('warmly-avatars','warmly-social') and split_part(name,'/',1)=auth.uid()::text) or
 (bucket_id='warmly-avatars' and exists(select 1 from public.profiles p where p.avatar_path=storage.objects.name)) or
 (bucket_id='warmly-social' and exists(select 1 from public.social_posts p where p.media_path=storage.objects.name and public.can_read_social(p.id))));
commit;
