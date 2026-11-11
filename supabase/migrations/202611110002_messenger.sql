-- Run once after 202611110001. Existing guest tables are preserved.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 name text not null check (length(btrim(name)) between 1 and 40)
);
create table public.friendships (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references public.profiles(id) on delete cascade,
 recipient uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted')),
 check (sender <> recipient)
);
create unique index friendship_pair on public.friendships(least(sender,recipient),greatest(sender,recipient));
create index friendship_recipient on public.friendships(recipient);
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('direct','group')),
 title text not null check (length(title) between 1 and 60),
 owner uuid not null references public.profiles(id),
 direct_key text unique,
 created_at timestamptz not null default now()
);
create table public.conversation_members (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(conversation_id,user_id)
);
create index member_user on public.conversation_members(user_id,conversation_id);
create table public.messages (
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),
 body text not null check (length(btrim(body)) between 1 and 2000),
 client_id uuid not null,
 created_at timestamptz not null default now(),
 unique(sender_id,client_id)
);
create index message_timeline on public.messages(conversation_id,id desc);

create function public.is_chat_member(chat uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.conversation_members where conversation_id=chat and user_id=(select auth.uid()));
$$;
revoke all on function public.is_chat_member(uuid) from public, anon;
grant execute on function public.is_chat_member(uuid) to authenticated;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.profiles,public.friendships,public.conversations,public.conversation_members,public.messages from anon,authenticated;
grant select on public.profiles,public.friendships,public.conversations,public.conversation_members,public.messages to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy friends_read on public.friendships for select to authenticated using ((select auth.uid()) in (sender,recipient));
create policy chats_read on public.conversations for select to authenticated using (public.is_chat_member(id));
create policy members_read on public.conversation_members for select to authenticated using (public.is_chat_member(conversation_id));
create policy messages_read on public.messages for select to authenticated using (public.is_chat_member(conversation_id));

-- All writes go through this authenticated, validated transaction boundary.
create function public.messenger(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 me uuid := auth.uid(); target uuid; chat uuid; other uuid; item record;
 handle text; display_name text; content text; pair text; result jsonb;
 selected uuid[]; key uuid; before_id bigint;
begin
 if me is null then raise exception 'Please sign in.'; end if;
 if action='profile' then
   handle := lower(btrim(payload->>'username')); display_name := btrim(payload->>'name');
   if handle is null or handle !~ '^[a-z0-9_]{3,24}$' then raise exception 'Username must contain 3–24 lowercase letters, numbers or underscores.'; end if;
   if display_name is null or length(display_name) not between 1 and 40 then raise exception 'Name must contain 1–40 characters.'; end if;
   insert into public.profiles(id,username,name) values(me,handle,display_name)
   on conflict(id) do update set username=excluded.username,name=excluded.name;
   return '{}'::jsonb;
 end if;
 if not exists(select 1 from public.profiles where id=me) then raise exception 'Please complete your profile.'; end if;
 if action='request' then
   target := (payload->>'userId')::uuid;
   if target=me or target is null then raise exception 'Choose another person.'; end if;
   insert into public.friendships(sender,recipient) values(me,target) on conflict do nothing;
 elsif action in ('accept','decline','cancel') then
   target := (payload->>'requestId')::uuid;
   if action='accept' then
     update public.friendships set status='accepted' where id=target and recipient=me and status='pending';
   elsif action='decline' then
     delete from public.friendships where id=target and recipient=me and status='pending';
   else
     delete from public.friendships where id=target and sender=me and status='pending';
   end if;
   if not found then raise exception 'Request is no longer available.'; end if;
 elsif action='direct' then
   target := (payload->>'userId')::uuid;
   if not exists(select 1 from public.friendships where status='accepted' and ((sender=me and recipient=target) or (recipient=me and sender=target))) then raise exception 'Add this person as a friend first.'; end if;
   pair := least(me,target)::text || ':' || greatest(me,target)::text;
   insert into public.conversations(kind,title,owner,direct_key) values('direct','Direct message',me,pair)
   on conflict(direct_key) do update set direct_key=excluded.direct_key returning id into chat;
   insert into public.conversation_members values(chat,me),(chat,target) on conflict do nothing;
   return jsonb_build_object('id',chat);
 elsif action='group' then
   display_name := btrim(payload->>'title');
   if display_name is null or length(display_name) not between 1 and 60 then raise exception 'Group name must contain 1–60 characters.'; end if;
   select array_agg(distinct value::uuid) into selected from jsonb_array_elements_text(payload->'members');
   if coalesce(cardinality(selected),0) not between 1 and 49 then raise exception 'Choose 1–49 friends.'; end if;
   foreach target in array selected loop
     if not exists(select 1 from public.friendships where status='accepted' and ((sender=me and recipient=target) or (recipient=me and sender=target))) then raise exception 'Only accepted friends can be added.'; end if;
   end loop;
   insert into public.conversations(kind,title,owner) values('group',display_name,me) returning id into chat;
   insert into public.conversation_members values(chat,me);
   insert into public.conversation_members select chat,unnest(selected);
   return jsonb_build_object('id',chat);
 elsif action in ('add_member','leave') then
   chat := (payload->>'chatId')::uuid;
   select * into item from public.conversations where id=chat for update;
   if not found or item.kind <> 'group' or not public.is_chat_member(chat) then raise exception 'Group is not available.'; end if;
   if action='leave' then
     if item.owner=me then raise exception 'The group owner cannot leave yet.'; end if;
     delete from public.conversation_members where conversation_id=chat and user_id=me;
   else
     if item.owner<>me then raise exception 'Only the group owner can add members.'; end if;
     target := (payload->>'userId')::uuid;
     if (select count(*) from public.conversation_members where conversation_id=chat)>=50 then raise exception 'This group is full.'; end if;
     if not exists(select 1 from public.friendships where status='accepted' and ((sender=me and recipient=target) or (recipient=me and sender=target))) then raise exception 'Add this person as a friend first.'; end if;
     insert into public.conversation_members values(chat,target) on conflict do nothing;
   end if;
 elsif action in ('send','history') then
   chat := (payload->>'chatId')::uuid;
   if not public.is_chat_member(chat) then raise exception 'This conversation is not available.'; end if;
   if action='send' then
     content := btrim(payload->>'body'); key := (payload->>'clientId')::uuid;
     if content is null or length(content) not between 1 and 2000 or key is null then raise exception 'Messages must contain 1–2000 characters.'; end if;
     perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text,0));
     select to_jsonb(m) into result from public.messages m where sender_id=me and client_id=key and conversation_id=chat;
     if result is not null then return result; end if;
     if exists(select 1 from public.messages where sender_id=me and created_at>clock_timestamp()-interval '400 milliseconds') then raise exception 'Please wait a moment before sending again.'; end if;
     insert into public.messages(conversation_id,sender_id,body,client_id) values(chat,me,content,key) returning to_jsonb(messages.*) into result;
     return result;
   end if;
   before_id := coalesce((payload->>'before')::bigint,9223372036854775807);
   select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') into result from
     (select * from public.messages where conversation_id=chat and id<before_id order by id desc limit 50) m;
   return result;
 else raise exception 'Unknown action.';
 end if;
 return '{}'::jsonb;
exception when unique_violation then raise exception 'That username or message identifier is already in use.';
end;
$$;
revoke all on function public.messenger(text,jsonb) from public,anon;
grant execute on function public.messenger(text,jsonb) to authenticated;
