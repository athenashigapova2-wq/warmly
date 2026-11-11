-- Apply after 003. Re-runnable, no existing data is removed.
begin;
create table if not exists public.saved_posts (
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 post_id uuid not null references public.social_posts(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,post_id)
);
alter table public.saved_posts enable row level security;
revoke all on public.saved_posts from anon,authenticated;
grant select,delete on public.saved_posts to authenticated;
grant insert(post_id) on public.saved_posts to authenticated;
drop policy if exists saved_read on public.saved_posts;
create policy saved_read on public.saved_posts for select to authenticated using(user_id=auth.uid());
drop policy if exists saved_delete on public.saved_posts;
create policy saved_delete on public.saved_posts for delete to authenticated using(user_id=auth.uid());
drop policy if exists saved_insert on public.saved_posts;
create policy saved_insert on public.saved_posts for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.social_posts p where p.id=post_id and p.kind='post'));
create table if not exists public.book_listings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 author text not null default '' check(length(author)<=120),
 price numeric(10,2) not null default 0 check(price>=0),
 currency text not null default 'SEK' check(currency in ('SEK','EUR','USD','RUB')),
 condition text not null default 'Good' check(condition in ('Like new','Good','Used')),
 description text not null default '' check(length(description)<=1000),
 status text not null default 'available' check(status in ('available','sold')),
 created_at timestamptz not null default now()
);
alter table public.book_listings enable row level security;
revoke all on public.book_listings from anon,authenticated;
grant select,delete on public.book_listings to authenticated;
grant insert(id,title,author,price,currency,condition,description,status),update(title,author,price,currency,condition,description,status) on public.book_listings to authenticated;
drop policy if exists books_owner on public.book_listings;
create policy books_owner on public.book_listings for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
commit;
