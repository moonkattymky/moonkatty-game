-- Additive: never delete balances, achievements or existing ledger events.
create table if not exists public.mkty_cloud_saves (
 telegram_id bigint primary key references public.players(telegram_id),
 revision bigint not null default 0,
 snapshot jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=500000)
);
create table if not exists public.mkty_campaign_routes (
 telegram_id bigint not null references public.players(telegram_id),
 life integer not null check(life between 1 and 9),
 route uuid not null default gen_random_uuid(),
 seed bigint not null check(seed between 0 and 4294967295),
 edition integer not null check(edition in(1,2)),
 started_at timestamptz not null default now(),
 verified_at timestamptz,
 primary key(telegram_id,life)
);
alter table public.mkty_cloud_saves enable row level security;
alter table public.mkty_campaign_routes enable row level security;
revoke all on public.mkty_cloud_saves,public.mkty_campaign_routes from public,anon,authenticated;
grant all on public.mkty_cloud_saves,public.mkty_campaign_routes to service_role;
create index if not exists referral_events_referral_id_idx on public.referral_events(referral_id);

create or replace function public.mkty_cloud(p_id bigint,p_expected bigint default null,p_snapshot jsonb default null,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.mkty_cloud_saves%rowtype;
begin
 if p_snapshot is null then
  select * into s from public.mkty_cloud_saves where telegram_id=p_id;
  return jsonb_build_object('revision',coalesce(s.revision,0),'snapshot',coalesce(s.snapshot,'{}'::jsonb));
 end if;
 if jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>500000 or p_expected is null then return jsonb_build_object('error','snapshot');end if;
 insert into public.mkty_cloud_saves(telegram_id) values(p_id) on conflict do nothing;
 select * into strict s from public.mkty_cloud_saves where telegram_id=p_id for update;
 if s.revision<>p_expected then return jsonb_build_object('conflict',true,'revision',s.revision,'snapshot',s.snapshot);end if;
 update public.mkty_cloud_saves set snapshot=p_snapshot,revision=revision+1,updated_at=p_now where telegram_id=p_id returning * into s;
 return jsonb_build_object('revision',s.revision);
end $$;

create or replace function public.mkty_campaign_route(p_id bigint,p_life integer,p_seed bigint default null,p_edition integer default 2,p_reset boolean default false,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype;r public.mkty_campaign_routes%rowtype;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p_life not between 1 and 9 or p_life>p.story_life+1 then return jsonb_build_object('error','life');end if;
 select * into r from public.mkty_campaign_routes where telegram_id=p_id and life=p_life;
 if not found and p_seed is not null then
  if p_seed not between 0 and 4294967295 or p_edition not in(1,2) then return jsonb_build_object('error','proof');end if;
  insert into public.mkty_campaign_routes(telegram_id,life,seed,edition,started_at) values(p_id,p_life,p_seed,p_edition,p_now) returning * into r;
 elsif found and p_seed is not null and (p.story_life>=p_life or p_reset) and (p_seed<>r.seed or p_edition<>r.edition) then
  update public.mkty_campaign_routes set seed=p_seed,edition=p_edition,route=gen_random_uuid(),started_at=p_now,verified_at=null where telegram_id=p_id and life=p_life returning * into r;
 end if;
 return case when r.telegram_id is null then 'null'::jsonb else to_jsonb(r) end;
end $$;

-- This RPC is reachable only by the verified Edge handler after model validation.
create or replace function public.mkty_campaign_verified(p_id bigint,p_life integer,p_route uuid,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.mkty_campaign_routes%rowtype;
begin
 update public.mkty_campaign_routes set verified_at=p_now where telegram_id=p_id and life=p_life and route=p_route returning * into r;
 if not found then return jsonb_build_object('error','proof');end if;
 return to_jsonb(r);
end $$;

-- Lock the player before counting attempts, checking the code and issuing its reward.
-- Concurrent requests cannot observe the same remaining attempt.
create or replace function public.mkty_youtube(p_id bigint,p_code text,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype;c public.youtube_codes%rowtype;r jsonb;used integer;today date;pts integer;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p_code is null or p_code !~ '^[A-Z0-9]{3,32}$' then return jsonb_build_object('error','code');end if;
 today=(p_now at time zone 'UTC')::date;
 select count(*) into used from public.reward_events where telegram_id=p_id and event_type='daily.youtube_fail' and event_key like 'ytfail:'||today||':%';
 if used>=10 then return jsonb_build_object('error','no_attempts');end if;
 select * into c from public.youtube_codes where code=p_code and active and (starts_at is null or starts_at<=p_now) and (expires_at is null or expires_at>p_now) limit 1;
 if not found then
  perform public.mkty_reward(p_id,'ytfail:'||today||':'||gen_random_uuid(),'daily.youtube_fail',0,'{}',p_now);
  return jsonb_build_object('valid',false,'awarded',false,'attempts_left',9-used,'player',to_jsonb(p));
 end if;
 pts=greatest(0,least(50,c.points));
 r=public.mkty_reward(p_id,'yt:'||c.id,'daily.youtube_code',pts,'{}',p_now);
 if r ? 'error' then return r;end if;
 return jsonb_build_object('valid',true,'awarded',r->'inserted','duplicate',not (r->>'inserted')::boolean,'points',case when (r->>'inserted')::boolean then pts else 0 end,'player',r->'player');
end $$;

revoke all on function public.mkty_cloud(bigint,bigint,jsonb,timestamptz),public.mkty_campaign_route(bigint,integer,bigint,integer,boolean,timestamptz),public.mkty_campaign_verified(bigint,integer,uuid,timestamptz),public.mkty_youtube(bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_cloud(bigint,bigint,jsonb,timestamptz),public.mkty_campaign_route(bigint,integer,bigint,integer,boolean,timestamptz),public.mkty_campaign_verified(bigint,integer,uuid,timestamptz),public.mkty_youtube(bigint,text,timestamptz) to service_role;
