-- Apply after 002. Re-runnable; preserves existing accounts and chats.
begin;
alter table public.profiles add column if not exists university text not null default '' check(length(university)<=100);
alter table public.profiles add column if not exists program text not null default '' check(length(program)<=100);
alter table public.profiles add column if not exists bio text not null default '' check(length(bio)<=500);
alter table public.profiles add column if not exists interests text not null default '' check(length(interests)<=200);
create table if not exists public.social_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('post','story')),
 body text not null default '' check(length(body)<=2000),
 image text not null default '' check(image='' or (length(image)<=220000 and image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
 created_at timestamptz not null default now(),
 check(length(btrim(body))>0 or image<>'')
);
create index if not exists social_timeline on public.social_posts(created_at desc,id desc);
create or replace function public.social_visible(author uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=author or exists(select 1 from public.friendships where status='accepted' and ((sender=auth.uid() and recipient=author) or (recipient=auth.uid() and sender=author)));
$$;
revoke all on function public.social_visible(uuid) from public,anon;
grant execute on function public.social_visible(uuid) to authenticated;
alter table public.social_posts enable row level security;
revoke all on public.social_posts from anon,authenticated;
grant select,delete on public.social_posts to authenticated;
grant insert(id,kind,body,image) on public.social_posts to authenticated;
drop policy if exists social_read on public.social_posts;
create policy social_read on public.social_posts for select to authenticated using(public.social_visible(author_id) and (kind='post' or created_at>now()-interval '24 hours'));
drop policy if exists social_create on public.social_posts;
create policy social_create on public.social_posts for insert to authenticated with check(author_id=auth.uid());
drop policy if exists social_delete on public.social_posts;
create policy social_delete on public.social_posts for delete to authenticated using(author_id=auth.uid());
grant update(name,username,university,program,bio,interests) on public.profiles to authenticated;
drop policy if exists profile_edit on public.profiles;
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
commit;
