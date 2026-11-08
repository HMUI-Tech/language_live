create schema analytics;
create table analytics.site_keys(site text primary key check(site in ('deutsch-live','italian-live')),key_hash text not null);
insert into analytics.site_keys values ('deutsch-live','6c3008d16f61b4941fddbe5d23841e66b260172eb936c8d7246e4dc4e318df2d'),('italian-live','c707188c074772f5e74b280b7bbe6bac1d9bd6a97033117c8851f4b3efb71e96');
create table analytics.daily_counts(day date not null,site text not null references analytics.site_keys(site),event text not null check(event in ('page_open','learning_started','cards_open','talk_open','articles_open','english_open')),hits bigint not null default 1 check(hits>0),primary key(day,site,event));
alter table analytics.site_keys enable row level security;
alter table analytics.daily_counts enable row level security;
revoke all on schema analytics from public;
grant usage on schema analytics to anon,authenticated;
revoke all on all tables in schema analytics from public,anon,authenticated;
create policy deny_direct_clients on analytics.site_keys to anon,authenticated using(false) with check(false);
create policy deny_direct_clients on analytics.daily_counts to anon,authenticated using(false) with check(false);
-- These two narrow server gateways deliberately accept a server-only credential:
-- anonymous browser events never carry it; no visitor identity or IP enters the tables.
create function analytics.record(site_name text,server_key text,event_name text) returns void language plpgsql security definer set search_path='' as $$
declare today_berlin date:=(now() at time zone 'Europe/Berlin')::date;
begin
if length(server_key) is distinct from 64 or not exists(select 1 from analytics.site_keys where site=site_name and key_hash=encode(extensions.digest(server_key,'sha256'),'hex')) then raise exception 'not_authorized' using errcode='42501';end if;
if event_name not in ('page_open','learning_started','cards_open','talk_open','articles_open','english_open') or event_name is null then raise exception 'invalid_event' using errcode='22023';end if;
insert into analytics.daily_counts(day,site,event) values(today_berlin,site_name,event_name) on conflict(day,site,event) do update set hits=analytics.daily_counts.hits+1;
delete from analytics.daily_counts where day<today_berlin-179;
end;$$;
create function analytics.summary(site_name text,server_key text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
if length(server_key) is distinct from 64 or not exists(select 1 from analytics.site_keys where site=site_name and key_hash=encode(extensions.digest(server_key,'sha256'),'hex')) then raise exception 'not_authorized' using errcode='42501';end if;
return jsonb_build_object('timezone','Europe/Berlin','retentionDays',180,'today',(now() at time zone 'Europe/Berlin')::date,'rows',coalesce((select jsonb_agg(jsonb_build_object('day',day,'site',site,'event',event,'hits',hits) order by day desc,site,event) from analytics.daily_counts where day>=(now() at time zone 'Europe/Berlin')::date-179),'[]'::jsonb));
end;$$;
revoke all on function analytics.record(text,text,text),analytics.summary(text,text) from public;
grant execute on function analytics.record(text,text,text),analytics.summary(text,text) to anon,authenticated;
create function public.record_language_usage(site_name text,server_key text,event_name text) returns void language sql security invoker set search_path='' as $$select analytics.record(site_name,server_key,event_name);$$;
create function public.language_usage_summary(site_name text,server_key text) returns jsonb language sql security invoker set search_path='' as $$select analytics.summary(site_name,server_key);$$;
revoke all on function public.record_language_usage(text,text,text),public.language_usage_summary(text,text) from public;
grant execute on function public.record_language_usage(text,text,text),public.language_usage_summary(text,text) to anon,authenticated;
notify pgrst,'reload schema';
