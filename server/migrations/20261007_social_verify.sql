-- 2026-10-07 Social verification: X / TikTok personal-code submissions reviewed by admins.
create table if not exists social_submissions (
  id bigserial primary key,
  telegram_id bigint not null references players(telegram_id),
  platform text not null check (platform in ('x','tiktok')),
  kind text not null check (kind in ('follow','daily')),
  proof text not null,
  proof_norm text not null unique,
  code text not null,
  day date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  points integer not null default 0 check (points >= 0),
  reviewed_at timestamptz,
  reviewed_by bigint,
  created_at timestamptz not null default now()
);
create index if not exists social_submissions_player_idx on social_submissions(telegram_id, created_at desc);
create index if not exists social_submissions_status_idx on social_submissions(status, created_at);
alter table social_submissions enable row level security;
revoke all on social_submissions from anon, authenticated;
grant select, insert, update on social_submissions to service_role;
grant usage, select on sequence social_submissions_id_seq to service_role;
