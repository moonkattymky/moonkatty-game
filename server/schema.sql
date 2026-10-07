-- MOONKATTY server-side source of truth
create table if not exists players (
  telegram_id bigint primary key,
  username text,
  first_name text,
  moon_points integer not null default 0 check (moon_points >= 0),
  lives integer not null default 9 check (lives between 0 and 9),
  next_life_at timestamptz,
  story_life integer not null default 0 check (story_life between 0 and 9),
  final_balance integer,
  balance_locked_at timestamptz,
  referred_by bigint references players(telegram_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_events (
  id bigserial primary key,
  telegram_id bigint not null references players(telegram_id),
  event_key text not null,
  event_type text not null,
  points integer not null check (points >= 0),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (telegram_id, event_key)
);

create table if not exists referral_events (
  id bigserial primary key,
  inviter_id bigint not null references players(telegram_id),
  referral_id bigint not null references players(telegram_id),
  source_event_key text not null,
  points integer not null default 1,
  created_at timestamptz not null default now(),
  unique (inviter_id, referral_id, source_event_key),
  check (inviter_id <> referral_id)
);

create index if not exists referral_events_day_idx on referral_events(inviter_id, created_at);

-- 2026-10-07: rewards Edge Function (service_role) needs ledger access
grant select, insert on referral_events to service_role;
grant usage, select on sequence referral_events_id_seq to service_role;
grant select, insert on reward_events to service_role;
grant usage, select on sequence reward_events_id_seq to service_role;
grant select, insert, update on players to service_role;
-- 2026-10-07 Daily retention: cipher attempts, login streaks, YouTube code words.
-- Additive only: existing players / reward_events / referral_events are untouched.
create table if not exists cipher_attempts (
  telegram_id bigint not null references players(telegram_id),
  day date not null,
  attempts integer not null default 0 check (attempts between 0 and 20),
  solved boolean not null default false,
  solved_at timestamptz,
  primary key (telegram_id, day)
);
create table if not exists login_streaks (
  telegram_id bigint primary key references players(telegram_id),
  streak integer not null default 0 check (streak >= 0),
  best integer not null default 0 check (best >= 0),
  last_day date,
  shield_week text,
  updated_at timestamptz not null default now()
);
create table if not exists youtube_codes (
  id bigserial primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{3,32}$'),
  points integer not null default 10 check (points between 1 and 50),
  video_url text,
  note text,
  is_test boolean not null default false,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table cipher_attempts enable row level security;
alter table login_streaks enable row level security;
alter table youtube_codes enable row level security;
revoke all on cipher_attempts, login_streaks, youtube_codes from anon, authenticated;
grant select, insert, update on cipher_attempts, login_streaks to service_role;
grant select on youtube_codes to service_role;

-- Atomic attempt counter: returns attempts used after this try, or -1 when exhausted.
create or replace function cipher_attempt(p_telegram_id bigint, p_day date, p_max integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare used integer;
begin
  insert into cipher_attempts(telegram_id, day, attempts) values (p_telegram_id, p_day, 1)
  on conflict (telegram_id, day) do update set attempts = cipher_attempts.attempts + 1
    where cipher_attempts.attempts < p_max and not cipher_attempts.solved
  returning attempts into used;
  return coalesce(used, -1);
end $$;
revoke all on function cipher_attempt(bigint, date, integer) from public, anon, authenticated;
grant execute on function cipher_attempt(bigint, date, integer) to service_role;

-- TEST code (clearly marked): safe to deactivate any time.
insert into youtube_codes (code, points, note, is_test, expires_at)
values ('MOONTEST', 5, 'TEST CODE — example only, not from a real video', true, '2026-10-31T23:59:59Z')
on conflict (code) do nothing;

-- 2026-10-07: referral attribution lookups (players.referred_by set once from signed start_param ref_<id>)
create index if not exists players_referred_by_idx on players(referred_by);
