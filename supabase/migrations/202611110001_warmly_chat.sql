-- Warmly storage. Run once against the selected Supabase project.
-- The browser cannot access these tables or RPC directly. Only the backend service role can.
create table public.warmly_sessions (
  id uuid primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 32),
  ip_hash text not null,
  created_at bigint not null,
  expires_at bigint not null,
  last_seen bigint not null,
  last_sent bigint not null default 0
);
create index warmly_sessions_presence on public.warmly_sessions(last_seen);
create index warmly_sessions_joins on public.warmly_sessions(ip_hash, created_at);
create table public.warmly_messages (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  sender_id uuid not null,
  sender_name text not null,
  text text not null check (char_length(text) between 1 and 2000),
  created_at bigint not null,
  client_message_id text not null check (client_message_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  unique (sender_id, client_message_id)
);
alter table public.warmly_sessions enable row level security;
alter table public.warmly_messages enable row level security;
revoke all on public.warmly_sessions, public.warmly_messages from anon, authenticated;
grant select, insert, update, delete on public.warmly_sessions, public.warmly_messages to service_role;
grant usage, select on sequence public.warmly_messages_seq_seq to service_role;

create function public.warmly_message_json(p_message public.warmly_messages)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', (p_message).id, 'sender', jsonb_build_object('id', (p_message).sender_id, 'name', (p_message).sender_name),
    'text', (p_message).text,
    'createdAt', to_char(to_timestamp((p_message).created_at / 1000.0) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
$$;
revoke all on function public.warmly_message_json(public.warmly_messages) from public, anon, authenticated;
grant execute on function public.warmly_message_json(public.warmly_messages) to service_role;

create function public.warmly_chat(p_action text, p_payload jsonb default '{}'::jsonb, p_token_hash text default null, p_ip_hash text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_member public.warmly_sessions%rowtype;
  v_message public.warmly_messages%rowtype;
  v_name text;
  v_text text;
  v_key text;
  v_members jsonb;
  v_messages jsonb;
begin
  if p_action = 'health' then return jsonb_build_object('ok', true, 'storage', 'supabase', 'schemaVersion', 1); end if;
  if p_action = 'join' then
    v_name := btrim(p_payload->>'name');
    if v_name is null or char_length(v_name) not between 1 and 32 then
      return jsonb_build_object('error', 'Your name must be between 1 and 32 characters.', 'status', 400);
    end if;
    if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_ip_hash is null then
      return jsonb_build_object('error', 'Invalid session request.', 'status', 400);
    end if;
    -- Serialize joins for one IP so concurrent requests cannot bypass the limit.
    perform pg_advisory_xact_lock(hashtextextended('warmly-join:' || p_ip_hash, 0));
    if (select count(*) from public.warmly_sessions where ip_hash = p_ip_hash and created_at > v_now - 60000) >= 20 then
      return jsonb_build_object('error', 'Too many joins. Please wait a minute and try again.', 'status', 429);
    end if;
    delete from public.warmly_sessions where expires_at <= v_now;
    insert into public.warmly_sessions(id, token_hash, name, ip_hash, created_at, expires_at, last_seen)
    values (gen_random_uuid(), p_token_hash, v_name, p_ip_hash, v_now, v_now + 86400000, v_now)
    returning * into v_member;
  else
    select * into v_member from public.warmly_sessions
    where token_hash = p_token_hash and expires_at > v_now for update;
    if not found then return jsonb_build_object('error', 'Your session expired. Please join again.', 'status', 401); end if;
  end if;
  if p_action = 'leave' then
    delete from public.warmly_sessions where id = v_member.id;
    return jsonb_build_object('ok', true);
  end if;
  if p_action = 'send' then
    v_text := btrim(p_payload->>'text'); v_key := p_payload->>'clientMessageId';
    if v_text is null or char_length(v_text) not between 1 and 2000 then
      return jsonb_build_object('error', 'Messages must be between 1 and 2000 characters.', 'status', 400);
    end if;
    if v_key is null or v_key !~ '^[A-Za-z0-9_-]{1,64}$' then
      return jsonb_build_object('error', 'Invalid message identifier.', 'status', 400);
    end if;
    select * into v_message from public.warmly_messages where sender_id = v_member.id and client_message_id = v_key;
    if found then return jsonb_build_object('message', public.warmly_message_json(v_message)); end if;
    if v_member.last_sent > v_now - 500 then
      return jsonb_build_object('error', 'Slow down a little. Try again in a second.', 'status', 429);
    end if;
    update public.warmly_sessions set last_sent = v_now, last_seen = v_now where id = v_member.id;
    -- Keep insertion and pruning ordered across concurrent senders.
    perform pg_advisory_xact_lock(hashtextextended('warmly-message-history', 0));
    insert into public.warmly_messages(id, sender_id, sender_name, text, created_at, client_message_id)
    values (gen_random_uuid(), v_member.id, v_member.name, v_text, v_now, v_key) returning * into v_message;
    delete from public.warmly_messages where seq not in (select seq from public.warmly_messages order by seq desc limit 100);
    return jsonb_build_object('message', public.warmly_message_json(v_message));
  end if;
  if p_action not in ('join', 'state') then return jsonb_build_object('error', 'Not found.', 'status', 404); end if;
  update public.warmly_sessions set last_seen = v_now where id = v_member.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.created_at, m.id), '[]'::jsonb)
    into v_members from (select id, name, created_at from public.warmly_sessions where last_seen > v_now - 30000 and expires_at > v_now order by created_at, id limit 500) m;
  select coalesce(jsonb_agg(public.warmly_message_json(m::public.warmly_messages) order by m.seq), '[]'::jsonb)
    into v_messages from (select * from public.warmly_messages order by seq desc limit 100) m;
  return jsonb_build_object('self', jsonb_build_object('id', v_member.id, 'name', v_member.name), 'members', v_members, 'messages', v_messages);
end;
$$;
revoke all on function public.warmly_chat(text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.warmly_chat(text, jsonb, text, text) to service_role;
