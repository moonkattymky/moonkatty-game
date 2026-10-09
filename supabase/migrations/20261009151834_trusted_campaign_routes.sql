-- Additive trust boundary. Existing balances, completion records and saves are unchanged.
-- Existing routes remain version 1 even if verified_at was set by the old handler.
alter table public.mkty_campaign_routes add column challenge_version integer not null default 1 check(challenge_version in (1,2));

-- Private audit/recovery history. Restart never deletes the previous challenge.
create table public.mkty_campaign_route_history (
 route uuid primary key,
 telegram_id bigint not null references public.players(telegram_id),
 life integer not null check(life between 1 and 9),
 seed bigint not null,
 edition integer not null,
 challenge_version integer not null,
 started_at timestamptz not null,
 verified_at timestamptz,
 next_route uuid not null,
 archived_at timestamptz not null default now()
);
alter table public.mkty_campaign_route_history enable row level security;
revoke all on public.mkty_campaign_route_history from public,anon,authenticated;
grant all on public.mkty_campaign_route_history to service_role;
create index mkty_campaign_route_history_owner_idx on public.mkty_campaign_route_history(telegram_id,life);

-- Preserve the RPC signature for read/resume compatibility. p_seed now only
-- signals issuance: its value and p_edition never determine a trusted challenge.
-- gen_random_uuid() is a cryptographically random v4 UUID; its first 32 bits
-- match the existing game model's uint32 seed domain.
create or replace function public.mkty_campaign_route(p_id bigint,p_life integer,p_seed bigint default null,p_edition integer default 2,p_reset boolean default false,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype;r public.mkty_campaign_routes%rowtype;issued uuid;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p_life not between 1 and 9 or p_life>p.story_life+1 then return jsonb_build_object('error','life');end if;
 if p_reset then return jsonb_build_object('error','route_restart_required');end if;
 select * into r from public.mkty_campaign_routes where telegram_id=p_id and life=p_life;
 if not found and p_seed is not null then
  issued=gen_random_uuid();
  insert into public.mkty_campaign_routes(telegram_id,life,route,seed,edition,challenge_version,started_at)
  values(p_id,p_life,issued,('x'||substr(replace(issued::text,'-',''),1,8))::bit(32)::bigint,2,2,p_now) returning * into r;
 end if;
 return case when r.telegram_id is null then 'null'::jsonb else to_jsonb(r) end;
end $$;

-- Explicit compare-and-restart, safe against duplicate requests and lost replies.
create function public.mkty_campaign_restart(p_id bigint,p_life integer,p_previous_route uuid,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype;r public.mkty_campaign_routes%rowtype;issued uuid;new_seed bigint;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p_life not between 1 and 9 or p_life>p.story_life+1 then return jsonb_build_object('error','life');end if;
 select * into r from public.mkty_campaign_routes where telegram_id=p_id and life=p_life;
 if r.telegram_id is null or p_previous_route is null then return jsonb_build_object('error','route_changed');end if;
 if r.route<>p_previous_route then
  if exists(select 1 from public.mkty_campaign_route_history where route=p_previous_route and telegram_id=p_id and life=p_life and next_route=r.route) then return to_jsonb(r);end if;
  return jsonb_build_object('error','route_changed');
 end if;
 loop
  issued=gen_random_uuid();new_seed=('x'||substr(replace(issued::text,'-',''),1,8))::bit(32)::bigint;
  exit when new_seed<>r.seed;
 end loop;
 insert into public.mkty_campaign_route_history(route,telegram_id,life,seed,edition,challenge_version,started_at,verified_at,next_route,archived_at)
 values(r.route,r.telegram_id,r.life,r.seed,r.edition,r.challenge_version,r.started_at,r.verified_at,issued,p_now);
 update public.mkty_campaign_routes set route=issued,seed=new_seed,edition=2,challenge_version=2,started_at=p_now,verified_at=null where telegram_id=p_id and life=p_life returning * into r;
 return to_jsonb(r);
end $$;

create or replace function public.mkty_campaign_verified(p_id bigint,p_life integer,p_route uuid,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.mkty_campaign_routes%rowtype;
begin
 -- Same lock order as restart and payout; a proof cannot bless a replaced route.
 perform telegram_id from public.players where telegram_id=p_id for update;
 update public.mkty_campaign_routes set verified_at=coalesce(verified_at,p_now)
 where telegram_id=p_id and life=p_life and route=p_route and challenge_version=2 and edition=2 returning * into r;
 if not found then return jsonb_build_object('error','proof');end if;
 return to_jsonb(r);
end $$;

create or replace function public.mkty_reward(p_id bigint,p_key text,p_type text,p_points integer,p_meta jsonb default '{}'::jsonb,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype; ev public.reward_events%rowtype; n integer; prior timestamptz; opens timestamptz; earned integer; used integer;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p_key is null or length(p_key) not between 3 and 200 or p_points is null or p_points<0 or p_points>5000 then return jsonb_build_object('error','event_key'); end if;
 select * into ev from public.reward_events where telegram_id=p_id and event_key=p_key;
 if found then return jsonb_build_object('inserted',false,'row',to_jsonb(ev),'player',to_jsonb(p)); end if;
 if p.balance_locked_at is not null and p_points>0 then return jsonb_build_object('error','locked'); end if;
 if p_type='life.complete' then
  if p_key !~ '^life:[1-9]:complete$' then return jsonb_build_object('error','life'); end if;
  n=split_part(p_key,':',2)::integer;
  -- Imported legacy completions already paid: do not award under a second key.
  if n<=p.story_life then return jsonb_build_object('inserted',false,'player',to_jsonb(p)); end if;
  if n<>p.story_life+1 then return jsonb_build_object('error','life'); end if;
  -- Recheck under the same player lock used by route restart. A proof verified
  -- immediately before a reset must not pay out for the replacement challenge.
  if not exists(select 1 from public.mkty_campaign_routes r where r.telegram_id=p_id and r.life=n
   and r.challenge_version=2 and r.edition=2 and r.verified_at is not null and r.route::text=p_meta->>'route') then
   return jsonb_build_object('error','proof_required');
  end if;
  if p_points<>(array[500,500,750,1000,1250,1500,1750,2000,3000])[n] then return jsonb_build_object('error','points'); end if;
  select created_at into prior from public.reward_events where telegram_id=p_id and event_key='life:'||(n-1)||':complete' and event_type='life.complete';
  opens=((prior at time zone 'UTC')::date+1)::timestamp at time zone 'UTC';
  if n>1 and prior>='2026-10-07T10:30:00Z' and p_now<opens and not exists(select 1 from public.reward_events where telegram_id=p_id and event_key='chapter:skip:'||n and event_type='chapter.skip') then
   return jsonb_build_object('error','chapter_locked','unlock_at',opens);
  end if;
 elsif p_type='life.spend' then
  perform public.mkty_restore_lives(p_id,p_now);
  select * into p from public.players where telegram_id=p_id;
  if p.lives<=0 then return jsonb_build_object('error','no_lives'); end if;
 elsif p_type='chapter.skip' then
  if p_key !~ '^chapter:skip:[2-9]$' then return jsonb_build_object('error','life'); end if;
  n=split_part(p_key,':',3)::integer;
  if n<>p.story_life+1 then return jsonb_build_object('error','life'); end if;

  select count(*) into earned from public.players where referred_by=p_id and story_life>=1 and telegram_id<>p_id;
  select count(*) into used from public.reward_events where telegram_id=p_id and event_type='chapter.skip';
  if earned<=used then return jsonb_build_object('error','no_skips'); end if;
 end if;
 insert into public.reward_events(telegram_id,event_key,event_type,points,verified,created_at) values(p_id,p_key,p_type,p_points,true,p_now) returning * into ev;
 update public.players set moon_points=moon_points+p_points,updated_at=p_now,
  story_life=case when p_type='life.complete' then n else story_life end,
  lives=case when p_type='life.spend' then lives-1 else lives end,
  next_life_at=case when p_type='life.spend' then coalesce(next_life_at,p_now+interval '12 hours') else next_life_at end,
  final_balance=case when p_type='life.complete' and n=9 then moon_points+p_points else final_balance end,
  balance_locked_at=case when p_type='life.complete' and n=9 then p_now else balance_locked_at end
 where telegram_id=p_id returning * into p;
 if p_type='daily.cipher' then
  update public.cipher_attempts set solved=true,solved_at=p_now where telegram_id=p_id and day=split_part(p_key,':',2)::date;
 elsif p_type='daily.streak' then
  insert into public.login_streaks(telegram_id,streak,best,last_day,shield_week,updated_at)
  values(p_id,(p_meta->>'streak')::integer,(p_meta->>'best')::integer,(p_meta->>'last_day')::date,p_meta->>'shield_week',p_now)
  on conflict(telegram_id) do update set streak=excluded.streak,best=greatest(login_streaks.best,excluded.best),last_day=excluded.last_day,shield_week=excluded.shield_week,updated_at=excluded.updated_at;
 end if;
 return jsonb_build_object('inserted',true,'row',to_jsonb(ev),'player',to_jsonb(p));
end $$;

revoke all on function public.mkty_campaign_route(bigint,integer,bigint,integer,boolean,timestamptz),public.mkty_campaign_restart(bigint,integer,uuid,timestamptz),public.mkty_campaign_verified(bigint,integer,uuid,timestamptz),public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_campaign_route(bigint,integer,bigint,integer,boolean,timestamptz),public.mkty_campaign_restart(bigint,integer,uuid,timestamptz),public.mkty_campaign_verified(bigint,integer,uuid,timestamptz),public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz) to service_role;
