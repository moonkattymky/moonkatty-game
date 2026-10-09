-- Preserve existing balances and ledger. Inviter lock serializes concurrent payouts.
create or replace function public.mkty_referral(p_invitee bigint,p_inviter bigint,p_source text,p_activation boolean,p_cap integer default 10,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.players%rowtype; b public.players%rowtype; own jsonb; paid jsonb; cnt integer; total integer; key text; pts integer;
begin
 perform telegram_id from public.players where telegram_id in(p_invitee,p_inviter) order by telegram_id for update;
 select * into a from public.players where telegram_id=p_invitee;
 select * into b from public.players where telegram_id=p_inviter;
 if a.telegram_id is null or b.telegram_id is null or a.referred_by is distinct from p_inviter or p_invitee=p_inviter then return jsonb_build_object('error','referral'); end if;
 if a.story_life<1 then return jsonb_build_object('error','source'); end if;
 if p_activation then
  if a.story_life<1 then return jsonb_build_object('error','source'); end if;
  if a.balance_locked_at is null then own=public.mkty_reward(p_invitee,'referral:invitee:life1','referral.invitee',200,'{}',p_now); end if;
  key='life1';pts=200;
 else
  if p_source is null or length(p_source) not between 3 and 200 or not exists(select 1 from public.reward_events where telegram_id=p_invitee and event_key=p_source and verified and points>0 and (event_type='life.complete' or event_type like 'daily.%' or event_type like 'social.%')) then return jsonb_build_object('error','source'); end if;
  key=p_source;pts=1;
 end if;
 if b.balance_locked_at is not null then
  if not p_activation then return jsonb_build_object('error','locked'); end if;
 elsif not exists(select 1 from public.referral_events where inviter_id=p_inviter and referral_id=p_invitee and source_event_key=key) then
  select count(*) into cnt from public.referral_events where inviter_id=p_inviter and created_at>=date_trunc('day',p_now at time zone 'UTC') at time zone 'UTC';
  select count(*) into total from public.referral_events where inviter_id=p_inviter;
  if cnt<greatest(0,least(coalesce(p_cap,10),10)) and total<100 then
   insert into public.referral_events(inviter_id,referral_id,source_event_key,points,created_at) values(p_inviter,p_invitee,key,pts,p_now);
   paid=public.mkty_reward(p_inviter,'referral:'||p_invitee||':'||key,case when p_activation then 'referral.inviter' else 'referral.claim' end,pts,'{}',p_now);
   if paid ? 'error' then raise exception 'referral reward failed'; end if;
  elsif not p_activation then return jsonb_build_object('error','cap'); end if;
 end if;
 select * into a from public.players where telegram_id=p_invitee;
 select * into b from public.players where telegram_id=p_inviter;
 return jsonb_build_object('invitee',to_jsonb(a),'player',to_jsonb(b),'invitee_points',case when (own->>'inserted')::boolean then 200 else 0 end,'inviter_paid',coalesce((paid->>'inserted')::boolean,false),'awarded',coalesce((paid->>'inserted')::boolean,false));
end $$;

revoke all on function public.mkty_referral(bigint,bigint,text,boolean,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_referral(bigint,bigint,text,boolean,integer,timestamptz) to service_role;
