-- Leaderboard identity: verified Telegram display name/photo + opt-out.
alter table players add column if not exists display_name text check (display_name is null or char_length(display_name) <= 40);
alter table players add column if not exists photo_url text check (photo_url is null or (photo_url like 'https://%' and char_length(photo_url) <= 512));
alter table players add column if not exists leaderboard_hidden boolean not null default false;
alter table players add column if not exists profile_updated_at timestamptz;
