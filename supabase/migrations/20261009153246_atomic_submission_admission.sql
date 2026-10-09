-- Atomic creator/social admission. Additive: no existing submission or reward is changed.
-- PostgREST's default READ COMMITTED isolation gives each statement after the player
-- lock a fresh snapshot. Do not configure these writers with REPEATABLE READ.
-- Keep the insert guard during mixed-version rollout: older handlers still POST rows.

create or replace function public.mkty_submission_admission_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare locked timestamptz;
begin
 -- Fail closed rather than allow a stale transaction snapshot to bypass the counts.
 if current_setting('transaction_isolation') not in ('read committed','read uncommitted') then
  raise exception 'submission admission requires read committed' using errcode='25000';
 end if;
 -- Stable even when this player has no submissions yet. NO KEY UPDATE also
 -- coordinates final balance locks/reviews, without conflicting with FK key reads.
 select balance_locked_at into locked from public.players where telegram_id=new.telegram_id for no key update;
 if not found then raise exception 'player'; end if;
 if locked is not null then raise exception 'locked'; end if;
 if new.created_at is null or not isfinite(new.created_at) then raise exception 'submission'; end if;
 if tg_table_name='creator_submissions' then
  -- Rejections still consume the inclusive rolling seven-day creator window.
  if exists(select 1 from public.creator_submissions where telegram_id=new.telegram_id and created_at>=new.created_at-interval '168 hours') then
   raise exception 'weekly';
  end if;
 else
  -- UTC day comes from trusted server admission time, never a separately supplied day.
  new.day=(new.created_at at time zone 'UTC')::date;
  if (select count(*) from public.social_submissions where telegram_id=new.telegram_id and status='pending')>=3 then
   raise exception 'pending_limit';
  end if;
  if new.kind='follow' and exists(select 1 from public.social_submissions where telegram_id=new.telegram_id and platform=new.platform and kind='follow' and status<>'rejected') then
   raise exception 'already';
  end if;
  if new.kind='daily' and exists(select 1 from public.social_submissions where telegram_id=new.telegram_id and platform=new.platform and kind='daily' and day=new.day and status<>'rejected') then
   raise exception 'daily_limit';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.mkty_submission_admission_guard() from public,anon,authenticated;
grant execute on function public.mkty_submission_admission_guard() to service_role;

create trigger mkty_creator_admission before insert on public.creator_submissions
for each row execute function public.mkty_submission_admission_guard();
create trigger mkty_social_admission before insert on public.social_submissions
for each row execute function public.mkty_submission_admission_guard();

-- Canonical URL/proof validation, ownership attestation, hashtag and admin allowlists
-- stay in the authenticated server. These RPCs are service-role-only, never public APIs.
create or replace function public.mkty_creator_submit(p_id bigint,p_platform text,p_url text,p_url_norm text,p_caption text,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.creator_submissions; locked timestamptz;
begin
 select balance_locked_at into locked from public.players where telegram_id=p_id for no key update;
 if not found then return jsonb_build_object('error','player'); end if;
 if locked is not null then return jsonb_build_object('error','locked'); end if;
 -- Lost replies can be retried, even after review or expiry of the weekly window.
 -- Never return another player's row, modify the original, or create a new review.
 select * into s from public.creator_submissions where url_norm=p_url_norm;
 if found then
  if s.telegram_id=p_id and s.platform=p_platform then
   return jsonb_build_object('submission',to_jsonb(s),'duplicate',true);
  end if;
  return jsonb_build_object('error','duplicate_url');
 end if;
 begin
  insert into public.creator_submissions(telegram_id,platform,url,url_norm,caption,status,created_at)
  values(p_id,p_platform,p_url,p_url_norm,p_caption,'pending',p_now) returning * into s;
 exception
  when unique_violation then return jsonb_build_object('error','duplicate_url');
  when raise_exception then
   if sqlerrm in ('weekly','locked','player','submission') then return jsonb_build_object('error',sqlerrm); end if;
   raise;
 end;
 return jsonb_build_object('submission',to_jsonb(s),'duplicate',false);
end $$;
revoke all on function public.mkty_creator_submit(bigint,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_creator_submit(bigint,text,text,text,text,timestamptz) to service_role;

create or replace function public.mkty_social_submit(p_id bigint,p_platform text,p_kind text,p_proof text,p_proof_norm text,p_code text,p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.social_submissions; locked timestamptz;
begin
 select balance_locked_at into locked from public.players where telegram_id=p_id for no key update;
 if not found then return jsonb_build_object('error','player'); end if;
 if locked is not null then return jsonb_build_object('error','locked'); end if;
 select * into s from public.social_submissions where proof_norm=p_proof_norm;
 if found then
  if s.telegram_id=p_id and s.platform=p_platform and s.kind=p_kind then
   return jsonb_build_object('submission',to_jsonb(s),'duplicate',true);
  end if;
  return jsonb_build_object('error','duplicate_proof');
 end if;
 begin
  insert into public.social_submissions(telegram_id,platform,kind,proof,proof_norm,code,day,status,created_at)
  values(p_id,p_platform,p_kind,p_proof,p_proof_norm,p_code,(p_now at time zone 'UTC')::date,'pending',p_now) returning * into s;
 exception
  when unique_violation then return jsonb_build_object('error','duplicate_proof');
  when raise_exception then
   if sqlerrm in ('pending_limit','already','daily_limit','locked','player','submission') then return jsonb_build_object('error',sqlerrm); end if;
   raise;
 end;
 return jsonb_build_object('submission',to_jsonb(s),'duplicate',false);
end $$;
revoke all on function public.mkty_social_submit(bigint,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.mkty_social_submit(bigint,text,text,text,text,text,timestamptz) to service_role;
