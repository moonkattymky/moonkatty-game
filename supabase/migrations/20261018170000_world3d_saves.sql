-- MOONKATTY 3D world (chapter 1) saves for the Telegram Mini App port. Additive only:
-- a new table + a new service-role-only function. Existing tables, balances and ledger are untouched.
-- Moon Points for 3D rewards reuse public.mkty_reward (event keys 'world3d:...', types 'world3d.*').
-- Rollback: drop function public.mkty_world_save(bigint,bigint,jsonb,timestamptz); drop table public.mkty_world_saves;
create table if not exists public.mkty_world_saves (
 telegram_id bigint primary key references public.players(telegram_id),
 revision bigint not null default 0,
 snapshot jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=65536)
);
alter table public.mkty_world_saves enable row level security;
revoke all on public.mkty_world_saves from public,anon,authenticated;
grant select,insert,update on public.mkty_world_saves to service_role;

-- p_snapshot null: read. Otherwise compare-and-swap on revision (conflict returns the authoritative copy).
create or replace function public.mkty_world_save(p_id bigint,p_expected bigint default null,p_snapshot jsonb default null,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.mkty_world_saves%rowtype;
begin
 if p_snapshot is null then
  select * into s from public.mkty_world_saves where telegram_id=p_id;
  return jsonb_build_object('revision',coalesce(s.revision,0),'snapshot',coalesce(s.snapshot,'{}'::jsonb));
 end if;
 if jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>65536 or p_expected is null then return jsonb_build_object('error','snapshot');end if;
 insert into public.mkty_world_saves(telegram_id) values(p_id) on conflict do nothing;
 select * into strict s from public.mkty_world_saves where telegram_id=p_id for update;
 if s.revision<>p_expected then return jsonb_build_object('conflict',true,'revision',s.revision,'snapshot',s.snapshot);end if;
 update public.mkty_world_saves set snapshot=p_snapshot,revision=revision+1,updated_at=p_now where telegram_id=p_id returning * into s;
 return jsonb_build_object('revision',s.revision);
end $$;
revoke all on function public.mkty_world_save(bigint,bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_world_save(bigint,bigint,jsonb,timestamptz) to service_role;
