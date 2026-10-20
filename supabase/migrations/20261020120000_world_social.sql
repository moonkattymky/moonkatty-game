-- MOONKATTY 3D world (Telegram port): friend help + robot/storage notification queue. Additive only:
-- three new tables + four new service-role-only functions. players / reward_events / referral_events / mkty_world_saves
-- and save v3 are untouched; no Moon Points are paid by these functions.
-- Friends = the existing referral graph (players.referred_by, either direction).
-- Rollback:
--   drop function if exists public.mkty_world_help(bigint,bigint,timestamptz,integer,integer);
--   drop function if exists public.mkty_world_help_claim(bigint,timestamptz);
--   drop function if exists public.mkty_notify_schedule(bigint,text,timestamptz,timestamptz);
--   drop function if exists public.mkty_notify_due(timestamptz,integer,integer,integer);
--   drop table if exists public.mkty_notify_queue; drop table if exists public.mkty_notify_prefs; drop table if exists public.mkty_world_help;
create table if not exists public.mkty_world_help (
 id bigserial primary key,
 helper_id bigint not null references public.players(telegram_id),
 target_id bigint not null references public.players(telegram_id),
 day date not null,
 created_at timestamptz not null default now(),
 consumed_at timestamptz,
 unique (helper_id,target_id,day),
 check (helper_id<>target_id)
);
create index if not exists mkty_world_help_target_idx on public.mkty_world_help(target_id,day);
create index if not exists mkty_world_help_helper_idx on public.mkty_world_help(helper_id,day);
create table if not exists public.mkty_notify_prefs (
 telegram_id bigint primary key references public.players(telegram_id),
 opted_in boolean not null default false,
 lang text check (lang is null or char_length(lang)<=8),
 opted_at timestamptz,
 sent_day date,
 sent_count integer not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists public.mkty_notify_queue (
 telegram_id bigint not null references public.players(telegram_id),
 kind text not null check (kind in ('robot','storage')),
 due_at timestamptz not null,
 sent_at timestamptz,
 last_sent_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (telegram_id,kind)
);
create index if not exists mkty_notify_queue_due_idx on public.mkty_notify_queue(due_at) where sent_at is null;
alter table public.mkty_world_help enable row level security;
alter table public.mkty_notify_prefs enable row level security;
alter table public.mkty_notify_queue enable row level security;
revoke all on public.mkty_world_help, public.mkty_notify_prefs, public.mkty_notify_queue from public,anon,authenticated;
revoke all on sequence public.mkty_world_help_id_seq from public,anon,authenticated;
grant select,insert,update on public.mkty_world_help, public.mkty_notify_prefs, public.mkty_notify_queue to service_role;
grant usage,select on sequence public.mkty_world_help_id_seq to service_role;

-- One help per helper -> friend per UTC day; a friend can receive at most p_target_cap helps per day, a helper can give p_helper_cap.
create or replace function public.mkty_world_help(p_helper bigint,p_target bigint,p_now timestamptz default now(),p_target_cap integer default 3,p_helper_cap integer default 10)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.players%rowtype; b public.players%rowtype; d date:=(p_now at time zone 'utc')::date; n integer;
begin
 if p_helper is null or p_target is null or p_helper=p_target then return jsonb_build_object('error','self');end if;
 select * into a from public.players where telegram_id=p_helper; select * into b from public.players where telegram_id=p_target;
 if a.telegram_id is null or b.telegram_id is null then return jsonb_build_object('error','not_friend');end if;
 if a.referred_by is distinct from p_target and b.referred_by is distinct from p_helper then return jsonb_build_object('error','not_friend');end if;
 perform pg_advisory_xact_lock(7311,(p_target % 2147483647)::integer);
 if exists(select 1 from public.mkty_world_help where helper_id=p_helper and target_id=p_target and day=d) then return jsonb_build_object('ok',true,'inserted',false,'duplicate',true);end if;
 select count(*) into n from public.mkty_world_help where target_id=p_target and day=d; if n>=p_target_cap then return jsonb_build_object('error','target_cap');end if;
 select count(*) into n from public.mkty_world_help where helper_id=p_helper and day=d; if n>=p_helper_cap then return jsonb_build_object('error','helper_cap');end if;
 insert into public.mkty_world_help(helper_id,target_id,day,created_at) values(p_helper,p_target,d,p_now);
 return jsonb_build_object('ok',true,'inserted',true);
end $$;

-- Consume unclaimed helps received in the last 2 UTC days (each one = +10% speed on the receiver's running robot jobs, applied client-side).
create or replace function public.mkty_world_help_claim(p_target bigint,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 with c as (update public.mkty_world_help set consumed_at=p_now where target_id=p_target and consumed_at is null and day>=((p_now at time zone 'utc')::date-1) returning helper_id)
 select jsonb_build_object('count',count(*),'helpers',coalesce(jsonb_agg(helper_id),'[]'::jsonb)) into r from c;
 return r;
end $$;

-- Opted-in players only. p_due null cancels the pending ping of that kind. Due times are bounded to the next 48 h.
create or replace function public.mkty_notify_schedule(p_id bigint,p_kind text,p_due timestamptz,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_kind not in ('robot','storage') then return jsonb_build_object('error','kind');end if;
 if not exists(select 1 from public.mkty_notify_prefs where telegram_id=p_id and opted_in) then return jsonb_build_object('ok',true,'scheduled',false,'opted_in',false);end if;
 if p_due is null then delete from public.mkty_notify_queue where telegram_id=p_id and kind=p_kind and sent_at is null; return jsonb_build_object('ok',true,'scheduled',false);end if;
 if p_due<p_now or p_due>p_now+interval '48 hours' then return jsonb_build_object('error','due');end if;
 insert into public.mkty_notify_queue(telegram_id,kind,due_at,updated_at) values(p_id,p_kind,p_due,p_now)
  on conflict (telegram_id,kind) do update set due_at=excluded.due_at,sent_at=null,updated_at=p_now;
 return jsonb_build_object('ok',true,'scheduled',true);
end $$;

-- Sender side (scheduled job): atomically claim due pings that pass the per-player throttle
-- (>= p_min_gap seconds since the last ping of that kind, <= p_day_cap pings per player per UTC day, opted in).
create or replace function public.mkty_notify_due(p_now timestamptz default now(),p_limit integer default 50,p_min_gap integer default 10800,p_day_cap integer default 3)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; d date:=(p_now at time zone 'utc')::date;
begin
 with due as (
  select q.telegram_id,q.kind from public.mkty_notify_queue q join public.mkty_notify_prefs p on p.telegram_id=q.telegram_id
  where q.sent_at is null and q.due_at<=p_now and p.opted_in
   and (q.last_sent_at is null or q.last_sent_at<=p_now-make_interval(secs=>p_min_gap))
   and (p.sent_day is distinct from d or p.sent_count<p_day_cap)
  order by q.due_at limit greatest(1,least(p_limit,500)) for update of q skip locked),
 upd as (update public.mkty_notify_queue q set sent_at=p_now,last_sent_at=p_now,updated_at=p_now from due where q.telegram_id=due.telegram_id and q.kind=due.kind returning q.telegram_id,q.kind),
 cnt as (update public.mkty_notify_prefs p set sent_count=case when p.sent_day=d then p.sent_count+1 else 1 end,sent_day=d,updated_at=p_now
   from (select telegram_id from upd group by telegram_id) u where p.telegram_id=u.telegram_id returning p.telegram_id,p.lang)
 select coalesce(jsonb_agg(jsonb_build_object('telegram_id',upd.telegram_id,'kind',upd.kind,'lang',cnt.lang)),'[]'::jsonb) into r from upd join cnt using (telegram_id);
 return r;
end $$;
revoke all on function public.mkty_world_help(bigint,bigint,timestamptz,integer,integer), public.mkty_world_help_claim(bigint,timestamptz),
 public.mkty_notify_schedule(bigint,text,timestamptz,timestamptz), public.mkty_notify_due(timestamptz,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.mkty_world_help(bigint,bigint,timestamptz,integer,integer), public.mkty_world_help_claim(bigint,timestamptz),
 public.mkty_notify_schedule(bigint,text,timestamptz,timestamptz), public.mkty_notify_due(timestamptz,integer,integer,integer) to service_role;
