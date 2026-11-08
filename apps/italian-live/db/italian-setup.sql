create schema if not exists italian;
create table italian.learning_progress (
user_id uuid primary key references auth.users(id) on delete cascade,
docs jsonb not null check(jsonb_typeof(docs)='object' and docs->'meta'->>'v'='1' and jsonb_typeof(docs->'meta'->'settings')='object' and jsonb_typeof(docs->'custom'->'items')='object' and octet_length(docs::text)<=2000000),
revision bigint not null default 1 check(revision>0),updated_at timestamptz not null default now());
alter table italian.learning_progress enable row level security;
revoke all on schema italian from public,anon;
grant usage on schema italian to authenticated;
grant select,insert,update,delete on italian.learning_progress to authenticated;
create policy own_progress on italian.learning_progress to authenticated using ((select auth.uid())=user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)) with check ((select auth.uid())=user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create function public.get_italian_progress() returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce((select jsonb_build_object('docs',docs,'revision',revision) from italian.learning_progress where user_id=(select auth.uid())),jsonb_build_object('docs',null,'revision',0));
$$;
create function public.save_italian_progress(new_docs jsonb,expected_revision bigint) returns bigint language plpgsql security invoker set search_path='' as $$
declare subject uuid:=auth.uid(); next_revision bigint;
begin
if subject is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required' using errcode='42501'; end if;
if expected_revision is null or expected_revision<0 or jsonb_typeof(new_docs) is distinct from 'object' or new_docs->'meta'->>'v' is distinct from '1' or jsonb_typeof(new_docs->'meta'->'settings') is distinct from 'object' or jsonb_typeof(new_docs->'custom'->'items') is distinct from 'object' or octet_length(new_docs::text)>2000000 then raise exception 'invalid_progress' using errcode='22023'; end if;
if expected_revision=0 then insert into italian.learning_progress(user_id,docs,revision) values(subject,new_docs,1) on conflict(user_id) do nothing returning revision into next_revision;
else update italian.learning_progress set docs=new_docs,revision=revision+1,updated_at=now() where user_id=subject and revision=expected_revision returning revision into next_revision; end if;
if next_revision is null then raise exception 'progress_conflict'; end if;return next_revision;end;$$;
revoke all on function public.get_italian_progress() from public,anon;
revoke all on function public.save_italian_progress(jsonb,bigint) from public,anon;
grant execute on function public.get_italian_progress(),public.save_italian_progress(jsonb,bigint) to authenticated;
-- ChatGPT identity is verified by the Sites server. Its server-only credential is scoped to Italian.
create table italian.site_bridge_config (singleton boolean primary key default true check(singleton), secret_hash text not null);
insert into italian.site_bridge_config values(true,'a3c29a47b2d26bf550678ffb3ee0ad2bcbbebecb17d29a4bf743a1e3ea1f9898');
alter table italian.site_bridge_config enable row level security;
revoke all on italian.site_bridge_config from public,anon,authenticated;
create table italian.site_progress(user_id text primary key check(length(user_id) between 1 and 200),docs jsonb not null,revision bigint not null check(revision>0),updated_at timestamptz not null default now());
alter table italian.site_progress enable row level security;
revoke all on italian.site_progress from public,anon,authenticated;
create function italian.site_progress_gateway(bridge_key text,subject text,new_docs jsonb default null,expected_revision bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare next_revision bigint; result jsonb;
begin
if length(bridge_key) is distinct from 64 or not exists(select 1 from italian.site_bridge_config where secret_hash=encode(extensions.digest(bridge_key,'sha256'),'hex')) then raise exception 'authentication_required' using errcode='42501';end if;
if subject is null or length(subject) not between 1 and 200 then raise exception 'invalid_subject';end if;
if new_docs is null then select jsonb_build_object('docs',docs,'revision',revision) into result from italian.site_progress where user_id=subject;return coalesce(result,jsonb_build_object('docs',null,'revision',0));end if;
if expected_revision is null or expected_revision<0 or jsonb_typeof(new_docs) is distinct from 'object' or new_docs->'meta'->>'v' is distinct from '1' or jsonb_typeof(new_docs->'meta'->'settings') is distinct from 'object' or jsonb_typeof(new_docs->'custom'->'items') is distinct from 'object' or octet_length(new_docs::text)>2000000 then raise exception 'invalid_progress';end if;
if expected_revision=0 then insert into italian.site_progress(user_id,docs,revision) values(subject,new_docs,1) on conflict(user_id) do nothing returning revision into next_revision;
else update italian.site_progress set docs=new_docs,revision=revision+1,updated_at=now() where user_id=subject and revision=expected_revision returning revision into next_revision;end if;
if next_revision is null then raise exception 'progress_conflict';end if;return jsonb_build_object('revision',next_revision);end;$$;
revoke all on function italian.site_progress_gateway(text,text,jsonb,bigint) from public;
grant usage on schema italian to anon;
grant execute on function italian.site_progress_gateway(text,text,jsonb,bigint) to anon,authenticated;
create function public.italian_site_progress(bridge_key text,subject text,new_docs jsonb default null,expected_revision bigint default null) returns jsonb language sql security invoker set search_path='' as $$select italian.site_progress_gateway(bridge_key,subject,new_docs,expected_revision);$$;
revoke all on function public.italian_site_progress(text,text,jsonb,bigint) from public;
grant execute on function public.italian_site_progress(text,text,jsonb,bigint) to anon,authenticated;
notify pgrst,'reload schema';
