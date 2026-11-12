-- Apply after 004. Existing private listings remain unpublished until their owner publishes them.
begin;
create table if not exists public.account_roles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 requested_role text not null check(requested_role in ('student','university','visitor')),
 university_name text not null default '' check(length(university_name)<=150),
 approved boolean not null default false,
 created_at timestamptz not null default now(),
 check(requested_role<>'university' or length(btrim(university_name))>0)
);
alter table public.account_roles enable row level security;
revoke all on public.account_roles from anon,authenticated;
grant select on public.account_roles to authenticated;
drop policy if exists role_self_read on public.account_roles;
create policy role_self_read on public.account_roles for select to authenticated using(user_id=auth.uid());
create or replace function public.choose_account_role(choice text,institution text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Please sign in.'; end if;
 if choice is null or choice not in ('student','university','visitor') then raise exception 'Choose a valid account type.';end if;
 if choice='university' and length(btrim(coalesce(institution,''))) not between 1 and 150 then raise exception 'Enter the university name.';end if;
 insert into public.account_roles(user_id,requested_role,university_name) values(auth.uid(),choice,case when choice='university' then btrim(institution) else '' end) on conflict(user_id) do nothing;
end;$$;
create or replace function public.warmly_role() returns text language sql stable security definer set search_path='' as $$
 select coalesce((select case when requested_role='university' and not approved then 'visitor' else requested_role end from public.account_roles where user_id=auth.uid()),'visitor');
$$;
revoke all on function public.choose_account_role(text,text),public.warmly_role() from public,anon;
grant execute on function public.choose_account_role(text,text),public.warmly_role() to authenticated;
alter table public.book_listings add column if not exists category text not null default 'Books' check(category in ('Books','Notes','Electronics','Other'));
alter table public.book_listings add column if not exists image text not null default '' check(image='' or (length(image)<=220000 and image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'));
alter table public.book_listings add column if not exists published boolean not null default false;
grant insert(category,image,published),update(category,image,published) on public.book_listings to authenticated;
drop policy if exists books_owner on public.book_listings;
drop policy if exists market_read on public.book_listings;
create policy market_read on public.book_listings for select to authenticated using(owner_id=auth.uid() or published);
drop policy if exists market_create on public.book_listings;
create policy market_create on public.book_listings for insert to authenticated with check(owner_id=auth.uid() and public.warmly_role() in ('student','university'));
drop policy if exists market_edit on public.book_listings;
create policy market_edit on public.book_listings for update to authenticated using(owner_id=auth.uid() and public.warmly_role() in ('student','university')) with check(owner_id=auth.uid() and public.warmly_role() in ('student','university'));
drop policy if exists market_delete on public.book_listings;
create policy market_delete on public.book_listings for delete to authenticated using(owner_id=auth.uid());
create or replace function public.market_chat(item_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();seller uuid;chat uuid;pair text;
begin
 if me is null or not exists(select 1 from public.profiles where id=me) then raise exception 'Complete your profile first.';end if;
 select owner_id into seller from public.book_listings where id=item_id and published and status='available' for share;
 if seller is null then raise exception 'This listing is no longer available.';end if;
 if seller=me then raise exception 'This is your own listing.';end if;
 pair:=least(me,seller)::text||':'||greatest(me,seller)::text;
 insert into public.conversations(kind,title,owner,direct_key) values('direct','Direct message',me,pair) on conflict(direct_key) do update set direct_key=excluded.direct_key returning id into chat;
 insert into public.conversation_members values(chat,me),(chat,seller) on conflict do nothing;
 return chat;
end;$$;
revoke all on function public.market_chat(uuid) from public,anon;
grant execute on function public.market_chat(uuid) to authenticated;
create table if not exists public.campus_events (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 description text not null default '' check(length(description)<=3000),
 location text not null check(length(btrim(location)) between 1 and 200),
 starts_at timestamptz not null,
 capacity integer check(capacity between 1 and 100000),
 image text not null default '' check(image='' or (length(image)<=220000 and image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_at timestamptz not null default now()
);
create index if not exists events_schedule on public.campus_events(starts_at,id);
create table if not exists public.event_registrations (
 event_id uuid not null references public.campus_events(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(event_id,user_id)
);
alter table public.campus_events enable row level security;
alter table public.event_registrations enable row level security;
revoke all on public.campus_events,public.event_registrations from anon,authenticated;
grant select on public.campus_events,public.event_registrations to authenticated;
grant delete on public.event_registrations to authenticated;
grant insert(id,title,description,location,starts_at,capacity,image),update(title,description,location,starts_at,capacity,image,status) on public.campus_events to authenticated;
drop policy if exists events_read on public.campus_events;
create policy events_read on public.campus_events for select to authenticated using(true);
drop policy if exists events_create on public.campus_events;
create policy events_create on public.campus_events for insert to authenticated with check(owner_id=auth.uid() and public.warmly_role()='university');
drop policy if exists events_edit on public.campus_events;
create policy events_edit on public.campus_events for update to authenticated using(owner_id=auth.uid() and public.warmly_role()='university') with check(owner_id=auth.uid() and public.warmly_role()='university');
drop policy if exists registrations_read on public.event_registrations;
create policy registrations_read on public.event_registrations for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.campus_events e where e.id=event_id and e.owner_id=auth.uid()));
drop policy if exists registrations_cancel on public.event_registrations;
create policy registrations_cancel on public.event_registrations for delete to authenticated using(user_id=auth.uid());
create or replace function public.validate_campus_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if new.starts_at<=now() then raise exception 'Choose a future event date.';end if;
 elsif new.starts_at is distinct from old.starts_at and new.starts_at<=now() then raise exception 'Choose a future event date.';
 end if;
 if new.capacity is not null and new.capacity<(select count(*) from public.event_registrations where event_id=new.id) then raise exception 'Capacity cannot be lower than existing registrations.';end if;
 return new;
end;$$;
drop trigger if exists validate_campus_event on public.campus_events;
create trigger validate_campus_event before insert or update on public.campus_events for each row execute function public.validate_campus_event();
revoke all on function public.validate_campus_event() from public,anon,authenticated;
create or replace function public.register_event(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.campus_events;me uuid:=auth.uid();
begin
 if me is null or not exists(select 1 from public.profiles where id=me) then raise exception 'Complete your profile first.';end if;
 select * into e from public.campus_events where id=target for update;
 if not found or e.status<>'scheduled' or e.starts_at<=now() then raise exception 'Registration is closed for this event.';end if;
 if exists(select 1 from public.event_registrations where event_id=target and user_id=me) then return;end if;
 if e.capacity is not null and (select count(*) from public.event_registrations where event_id=target)>=e.capacity then raise exception 'This event is full.';end if;
 insert into public.event_registrations(event_id,user_id) values(target,me);
end;$$;
revoke all on function public.register_event(uuid) from public,anon;
grant execute on function public.register_event(uuid) to authenticated;
commit;
