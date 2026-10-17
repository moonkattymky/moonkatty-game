-- Security hardening (audit 2026-10-17). Additive: no balances, ledger rows, saves or
-- existing routes are changed or deleted. Apply BEFORE redeploying the edge functions;
-- the old handlers keep working against this schema (old RPCs are left intact).

-- 1. Private core tables: only the service_role Edge Functions may touch them.
--    (Supabase service_role has BYPASSRLS; no public policies are created on purpose.)
alter table public.players enable row level security;
alter table public.reward_events enable row level security;
alter table public.referral_events enable row level security;
revoke all on public.players, public.reward_events, public.referral_events from public, anon, authenticated;
revoke all on sequence public.reward_events_id_seq, public.referral_events_id_seq from public, anon, authenticated;

-- 2. Server-issued campaign challenges. Existing rows keep challenge_version = 1
--    (grandfathered, so in-progress players keep their progress). New rows are
--    version 2: random seed chosen by the server, edition 2, and the seed is unique
--    per chapter across ALL accounts, so one recorded run cannot be replayed on
--    another account.
alter table public.mkty_campaign_routes add column if not exists challenge_version integer not null default 1;
create unique index if not exists mkty_campaign_routes_server_seed_uniq
 on public.mkty_campaign_routes(life, seed, edition) where challenge_version = 2;

create or replace function public.mkty_campaign_issue(p_id bigint,p_life integer,p_seed bigint,p_reset boolean default false,p_reset_hours integer default 6,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype; r public.mkty_campaign_routes%rowtype; opens timestamptz;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p_life is null or p_life not between 1 and 9 or p_life>p.story_life+1 then return jsonb_build_object('error','life'); end if;
 if p_seed is null or p_seed not between 0 and 4294967295 then return jsonb_build_object('error','proof'); end if;
 select * into r from public.mkty_campaign_routes where telegram_id=p_id and life=p_life for update;
 if not found then
  begin
   insert into public.mkty_campaign_routes(telegram_id,life,seed,edition,started_at,challenge_version)
   values(p_id,p_life,p_seed,2,p_now,2) returning * into r;
  exception when unique_violation then return jsonb_build_object('error','seed_collision');
  end;
  return to_jsonb(r)||jsonb_build_object('issued',true);
 end if;
 if coalesce(p_reset,false) then
  -- An unrewarded chapter gets a new challenge at most once per p_reset_hours (1..168).
  -- Replays of already rewarded chapters pay nothing again, so they are not limited.
  opens=r.started_at+make_interval(hours=>greatest(1,least(coalesce(p_reset_hours,6),168)));
  if p_now<opens and p.story_life<p_life then return to_jsonb(r)||jsonb_build_object('reset_limited',true,'reset_available_at',opens); end if;
  begin
   update public.mkty_campaign_routes set seed=p_seed,edition=2,challenge_version=2,route=gen_random_uuid(),started_at=p_now,verified_at=null
   where telegram_id=p_id and life=p_life returning * into r;
  exception when unique_violation then return jsonb_build_object('error','seed_collision');
  end;
  return to_jsonb(r)||jsonb_build_object('issued',true);
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.mkty_campaign_issue(bigint,integer,bigint,boolean,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_campaign_issue(bigint,integer,bigint,boolean,integer,timestamptz) to service_role;

-- 3. Per-player fixed-window rate limits for heavy API actions.
create table if not exists public.mkty_rate_limits(
 telegram_id bigint not null,
 bucket text not null check (bucket ~ '^[a-z_]{1,32}$'),
 window_start timestamptz not null,
 hits integer not null default 0 check (hits >= 0),
 primary key(telegram_id,bucket)
);
alter table public.mkty_rate_limits enable row level security;
revoke all on public.mkty_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.mkty_rate_limits to service_role;

-- p_rules: [{"bucket":"all","limit":120,"window":60}, ...]. Every rule is counted;
-- the request is refused when any rule is over its limit.
create or replace function public.mkty_rate_limit(p_id bigint,p_rules jsonb,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rule jsonb; b text; lim integer; win integer; rl public.mkty_rate_limits%rowtype; allowed boolean=true; retry integer=0; denied text=null;
begin
 if p_id is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules) not between 1 and 8 then return jsonb_build_object('error','rate_rules'); end if;
 for rule in select * from jsonb_array_elements(p_rules) loop
  b=rule->>'bucket'; lim=(rule->>'limit')::integer; win=(rule->>'window')::integer;
  if b is null or b !~ '^[a-z_]{1,32}$' or lim is null or lim<1 or win is null or win not between 1 and 86400 then return jsonb_build_object('error','rate_rules'); end if;
  insert into public.mkty_rate_limits(telegram_id,bucket,window_start,hits) values(p_id,b,p_now,1)
  on conflict(telegram_id,bucket) do update set
   window_start=case when public.mkty_rate_limits.window_start<=p_now-make_interval(secs=>win) then p_now else public.mkty_rate_limits.window_start end,
   hits=case when public.mkty_rate_limits.window_start<=p_now-make_interval(secs=>win) then 1 else public.mkty_rate_limits.hits+1 end
  returning * into rl;
  if rl.hits>lim then
   allowed=false; denied=coalesce(denied,b);
   retry=greatest(retry,ceil(extract(epoch from (rl.window_start+make_interval(secs=>win)-p_now)))::integer);
  end if;
 end loop;
 return jsonb_build_object('allowed',allowed,'bucket',denied,'retry_after',greatest(retry,0));
end $$;
revoke all on function public.mkty_rate_limit(bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_rate_limit(bigint,jsonb,timestamptz) to service_role;

-- 4. One-time OAuth state for the (still disabled) YouTube subscription check.
create table if not exists public.mkty_oauth_states(
 state text primary key check (state ~ '^[A-Za-z0-9_-]{32,128}$'),
 telegram_id bigint not null,
 created_at timestamptz not null default now(),
 consumed_at timestamptz
);
create index if not exists mkty_oauth_states_player_idx on public.mkty_oauth_states(telegram_id,created_at);
alter table public.mkty_oauth_states enable row level security;
revoke all on public.mkty_oauth_states from public,anon,authenticated;
grant select,insert,update,delete on public.mkty_oauth_states to service_role;

create or replace function public.mkty_oauth_state_issue(p_id bigint,p_state text,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_id is null or p_state is null or p_state !~ '^[A-Za-z0-9_-]{32,128}$' then return jsonb_build_object('error','oauth_state'); end if;
 delete from public.mkty_oauth_states where telegram_id=p_id and (consumed_at is not null or created_at<p_now-interval '1 day');
 if (select count(*) from public.mkty_oauth_states where telegram_id=p_id)>=5 then return jsonb_build_object('error','no_attempts'); end if;
 insert into public.mkty_oauth_states(state,telegram_id,created_at) values(p_state,p_id,p_now);
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.mkty_oauth_state_consume(p_id bigint,p_state text,p_ttl_seconds integer default 600,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.mkty_oauth_states%rowtype;
begin
 if p_id is null or p_state is null or p_state !~ '^[A-Za-z0-9_-]{32,128}$' then return jsonb_build_object('valid',false); end if;
 update public.mkty_oauth_states set consumed_at=p_now
 where state=p_state and telegram_id=p_id and consumed_at is null and created_at>p_now-make_interval(secs=>greatest(60,least(coalesce(p_ttl_seconds,600),3600)))
 returning * into s;
 return jsonb_build_object('valid',found);
end $$;
revoke all on function public.mkty_oauth_state_issue(bigint,text,timestamptz),public.mkty_oauth_state_consume(bigint,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_oauth_state_issue(bigint,text,timestamptz),public.mkty_oauth_state_consume(bigint,text,integer,timestamptz) to service_role;
