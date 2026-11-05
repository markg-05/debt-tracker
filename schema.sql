-- The Tab (markg-05/debt-tracker): a running tab between two friends.
-- Data lives in the unexposed `tab` schema; the app only reaches it through
-- public.tab_sync, which checks a shared passcode.

create schema if not exists tab;
revoke all on schema tab from public, anon, authenticated;

create table tab.config (
  id boolean primary key default true check (id),
  key_hash text not null -- hex sha256 of the shared passcode
);

create table tab.entries (
  id text primary key check (char_length(id) between 1 and 40),
  kind text not null check (kind in ('debt', 'payout')),
  from_seat text not null check (from_seat in ('a', 'b')),
  amount integer not null check (amount > 0),
  tag text check (char_length(tag) <= 20),
  method text check (char_length(method) <= 20),
  note text not null default '' check (char_length(note) <= 80),
  ts bigint not null,
  deleted bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tab.config enable row level security;
alter table tab.entries enable row level security;
revoke all on all tables in schema tab from public, anon, authenticated;

-- The Tab: each entry needs both people's OK. `by_seat` added it (that's one OK);
-- `approved` is set when the other person approves. Only approved entries count.
alter table tab.entries
  add column by_seat text check (by_seat in ('a', 'b')),
  add column approved bigint;

-- Deleting an approved entry also needs the other person's OK. A request is open
-- while delete_asked is newer than delete_refused; `deleted` is set when it's approved.
alter table tab.entries
  add column delete_asked bigint,
  add column delete_by text check (delete_by in ('a', 'b')),
  add column delete_refused bigint;

create or replace function public.tab_sync(p_key text, p_entries jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null
     or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') is distinct from (select key_hash from tab.config) then
    raise exception 'wrong passcode' using errcode = '28P01';
  end if;

  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) > 5000 then
    raise exception 'bad entries' using errcode = '22023';
  end if;

  -- new ids are added; approvals and deletions only ever get set, never cleared;
  -- delete requests and refusals keep the newest time, so they can repeat
  insert into tab.entries as cur (
    id, kind, from_seat, amount, tag, method, note, ts, deleted, by_seat, approved,
    delete_asked, delete_by, delete_refused
  )
  select e.id, e.kind, e."from", e.amount, e.tag, e.method, coalesce(e.note, ''), e.ts, e.deleted, e."by", e.approved,
    e."delAsked", e."delBy", e."delRefused"
  from jsonb_to_recordset(p_entries) as e(
    id text, kind text, "from" text, amount integer, tag text, method text, note text, ts bigint,
    deleted bigint, "by" text, approved bigint,
    "delAsked" bigint, "delBy" text, "delRefused" bigint
  )
  on conflict (id) do update
    set deleted = coalesce(cur.deleted, excluded.deleted),
        approved = coalesce(cur.approved, excluded.approved),
        delete_by = case when excluded.delete_asked > coalesce(cur.delete_asked, 0) then excluded.delete_by else cur.delete_by end,
        delete_asked = greatest(cur.delete_asked, excluded.delete_asked),
        delete_refused = greatest(cur.delete_refused, excluded.delete_refused),
        updated_at = now()
    where (cur.deleted is null and excluded.deleted is not null)
       or (cur.approved is null and excluded.approved is not null)
       or excluded.delete_asked > coalesce(cur.delete_asked, 0)
       or excluded.delete_refused > coalesce(cur.delete_refused, 0);

  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'kind', kind, 'from', from_seat, 'amount', amount, 'tag', tag,
      'method', method, 'note', note, 'ts', ts, 'deleted', deleted,
      'by', by_seat, 'approved', approved,
      'delAsked', delete_asked, 'delBy', delete_by, 'delRefused', delete_refused
    )) order by ts)
    from tab.entries
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.tab_sync(text, jsonb) from public, anon, authenticated;
grant execute on function public.tab_sync(text, jsonb) to anon;

-- Then set the passcode:
-- insert into tab.config (key_hash) values (encode(sha256(convert_to('your-passcode', 'UTF8')), 'hex'));
