-- Creator rewards: player video submissions, reviewed by allowlisted admins.
create table if not exists creator_submissions (
  id bigserial primary key,
  telegram_id bigint not null references players(telegram_id),
  platform text not null check (platform in ('tiktok','youtube','x','instagram')),
  url text not null,
  url_norm text not null unique,
  caption text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  points integer not null default 0 check (points >= 0),
  tier_1k_at timestamptz,
  tier_10k_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by bigint,
  created_at timestamptz not null default now()
);
create index if not exists creator_submissions_player_idx on creator_submissions(telegram_id, created_at desc);
create index if not exists creator_submissions_status_idx on creator_submissions(status, created_at);
alter table creator_submissions enable row level security;
revoke all on creator_submissions from anon, authenticated;
grant select, insert, update on creator_submissions to service_role;
grant usage, select on sequence creator_submissions_id_seq to service_role;
