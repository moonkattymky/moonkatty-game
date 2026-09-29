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
