-- Additive release integrity. Existing balances, achievements and rewards are preserved.
-- Only the authenticated Edge Function's service role can call these invoker functions.
create or replace function public.mkty_restore_lives(p_id bigint,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype; gained integer;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 if p.lives<9 and p.next_life_at<=p_now then
  gained=floor(extract(epoch from (p_now-p.next_life_at))/43200)+1;
  update public.players set lives=least(9,p.lives+gained),next_life_at=case when p.lives+gained>=9 then null else p.next_life_at+gained*interval '12 hours' end,updated_at=p_now where telegram_id=p_id returning * into p;
 end if;
 return to_jsonb(p);
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

-- Referral record, reward ledger and balances share one transaction; sorted locks prevent deadlocks.
create or replace function public.mkty_referral(p_invitee bigint,p_inviter bigint,p_source text,p_activation boolean,p_cap integer default 40,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.players%rowtype; b public.players%rowtype; own jsonb; paid jsonb; cnt integer; key text; pts integer;
begin
 perform telegram_id from public.players where telegram_id in(p_invitee,p_inviter) order by telegram_id for update;
 select * into a from public.players where telegram_id=p_invitee;
 select * into b from public.players where telegram_id=p_inviter;
 if a.telegram_id is null or b.telegram_id is null or a.referred_by is distinct from p_inviter or p_invitee=p_inviter then return jsonb_build_object('error','referral'); end if;
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
  if cnt<greatest(0,least(p_cap,10000)) then
   insert into public.referral_events(inviter_id,referral_id,source_event_key,points,created_at) values(p_inviter,p_invitee,key,pts,p_now);
   paid=public.mkty_reward(p_inviter,'referral:'||p_invitee||':'||key,case when p_activation then 'referral.inviter' else 'referral.claim' end,pts,'{}',p_now);
   if paid ? 'error' then raise exception 'referral reward failed'; end if;
  elsif not p_activation then return jsonb_build_object('error','cap'); end if;
 end if;
 select * into a from public.players where telegram_id=p_invitee;
 select * into b from public.players where telegram_id=p_inviter;
 return jsonb_build_object('invitee',to_jsonb(a),'player',to_jsonb(b),'invitee_points',case when (own->>'inserted')::boolean then 200 else 0 end,'inviter_paid',coalesce((paid->>'inserted')::boolean,false),'awarded',coalesce((paid->>'inserted')::boolean,false));
end $$;

revoke all on function public.mkty_restore_lives(bigint,timestamptz) from public,anon,authenticated;
revoke all on function public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.mkty_referral(bigint,bigint,text,boolean,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_restore_lives(bigint,timestamptz),public.mkty_reward(bigint,text,text,integer,jsonb,timestamptz),public.mkty_referral(bigint,bigint,text,boolean,integer,timestamptz) to service_role;
-- Existing event trigger should not be executable by public API roles.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

-- Correct final cipher attempt and reward cannot be separated by a network failure.
create or replace function public.mkty_cipher(p_id bigint,p_day date,p_correct boolean,p_max integer,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.cipher_attempts%rowtype; p public.players%rowtype; r jsonb;
begin
 select * into strict p from public.players where telegram_id=p_id for update;
 select * into c from public.cipher_attempts where telegram_id=p_id and day=p_day;
 if c.solved then return jsonb_build_object('correct',true,'awarded',false,'duplicate',true,'attempts_left',greatest(0,p_max-c.attempts),'player',to_jsonb(p)); end if;
 if p.balance_locked_at is not null then return jsonb_build_object('error','locked'); end if;
 if coalesce(c.attempts,0)>=p_max then return jsonb_build_object('error','no_attempts'); end if;
 insert into public.cipher_attempts(telegram_id,day,attempts) values(p_id,p_day,1) on conflict(telegram_id,day) do update set attempts=cipher_attempts.attempts+1 returning * into c;
 if p_correct then
  r=public.mkty_reward(p_id,'cipher:'||p_day,'daily.cipher',15,'{}',p_now);
  if r ? 'error' then raise exception 'cipher reward failed'; end if;
  select * into p from public.players where telegram_id=p_id;
 end if;
 return jsonb_build_object('correct',p_correct,'awarded',coalesce((r->>'inserted')::boolean,false),'points',case when p_correct then 15 else 0 end,'attempts_left',p_max-c.attempts,'player',to_jsonb(p));
end $$;
revoke all on function public.mkty_cipher(bigint,date,boolean,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_cipher(bigint,date,boolean,integer,timestamptz) to service_role;

-- Moderation decision and approved payout are also one transaction.
create or replace function public.mkty_review(p_entity text,p_id bigint,p_decision text,p_kind text,p_actor bigint,p_points integer,p_key text,p_type text,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; owner_id bigint; locked timestamptz; r jsonb; reward jsonb; pts integer=0; col text;
begin
 if p_entity not in('creator','social') or p_decision not in('approve','reject') or p_kind not in('base','tier_1k','tier_10k') then return jsonb_build_object('error','decision'); end if;
 if p_entity='creator' then select to_jsonb(c) into s from public.creator_submissions c where id=p_id for update;
 else select to_jsonb(c) into s from public.social_submissions c where id=p_id for update; end if;
 if s is null then return jsonb_build_object('error','submission'); end if;
 if p_kind<>'base' then
  if p_entity<>'creator' or s->>'status'<>'approved' then return jsonb_build_object('error','not_approved'); end if;
  if s->>(p_kind||'_at') is not null then return jsonb_build_object('submission',s,'reward',jsonb_build_object('awarded',false,'points',0,'duplicate',true)); end if;
 elsif s->>'status'<>'pending' then return jsonb_build_object('error','reviewed'); end if;
 owner_id=(s->>'telegram_id')::bigint;
 select balance_locked_at into locked from public.players where telegram_id=owner_id for update;
 reward=jsonb_build_object('awarded',false,'points',0);
 if p_decision='approve' then
  if locked is null then
   r=public.mkty_reward(owner_id,p_key,p_type,p_points,'{}',p_now);
   if r ? 'error' then raise exception 'moderation reward failed'; end if;
   pts=case when (r->>'inserted')::boolean then p_points else 0 end;
   reward=jsonb_build_object('awarded',(r->>'inserted')::boolean,'points',pts,'duplicate',not (r->>'inserted')::boolean);
  else reward=reward||jsonb_build_object('reason','locked'); end if;
 end if;
 if p_entity='creator' then
  update public.creator_submissions set status=case when p_decision='reject' then 'rejected' else 'approved' end,
   points=points+pts,reviewed_at=case when p_kind='base' then p_now else reviewed_at end,reviewed_by=case when p_kind='base' then p_actor else reviewed_by end,
   tier_1k_at=case when p_kind='tier_1k' then p_now else tier_1k_at end,tier_10k_at=case when p_kind='tier_10k' then p_now else tier_10k_at end where id=p_id returning to_jsonb(creator_submissions.*) into s;
 else
  update public.social_submissions set status=case when p_decision='reject' then 'rejected' else 'approved' end,points=pts,reviewed_at=p_now,reviewed_by=p_actor where id=p_id returning to_jsonb(social_submissions.*) into s;
 end if;
 return jsonb_build_object('submission',s,'reward',reward);
end $$;
revoke all on function public.mkty_review(text,bigint,text,text,bigint,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_review(text,bigint,text,text,bigint,integer,text,text,timestamptz) to service_role;
