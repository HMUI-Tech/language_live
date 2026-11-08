create schema german;
revoke all on schema german from public, anon;
grant usage on schema german to authenticated;
create table german.learning_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 docs jsonb not null check (
   jsonb_typeof(docs)='object'
   and docs->'meta'->>'v'='1'
   and jsonb_typeof(docs->'meta'->'settings')='object'
   and jsonb_typeof(docs->'custom'->'items')='object'
   and octet_length(docs::text)<=2000000
 ),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table german.learning_progress enable row level security;
revoke all on german.learning_progress from public,anon,authenticated;
grant select,insert,update on german.learning_progress to authenticated;
create policy read_own on german.learning_progress for select to authenticated
 using ((select auth.uid())=user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy insert_own on german.learning_progress for insert to authenticated
 with check ((select auth.uid())=user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy update_own on german.learning_progress for update to authenticated
 using ((select auth.uid())=user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false))
 with check ((select auth.uid())=user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create function public.get_german_progress() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(
  (select jsonb_build_object('docs',docs,'revision',revision)
   from german.learning_progress where user_id=(select auth.uid())),
  jsonb_build_object('docs',null,'revision',0)
 );
$$;
create function public.save_german_progress(new_docs jsonb,expected_revision bigint) returns bigint
language plpgsql security invoker set search_path='' as $$
declare subject uuid:=auth.uid(); next_revision bigint;
begin
 if subject is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'authentication_required' using errcode='42501';
 end if;
 if expected_revision is null or expected_revision<0
  or jsonb_typeof(new_docs) is distinct from 'object'
  or new_docs->'meta'->>'v' is distinct from '1'
  or jsonb_typeof(new_docs->'meta'->'settings') is distinct from 'object'
  or jsonb_typeof(new_docs->'custom'->'items') is distinct from 'object'
  or octet_length(new_docs::text)>2000000 then
  raise exception 'invalid_progress' using errcode='22023';
 end if;
 if expected_revision=0 then
  insert into german.learning_progress(user_id,docs,revision)
   values(subject,new_docs,1) on conflict(user_id) do nothing
   returning revision into next_revision;
 else
  update german.learning_progress set docs=new_docs,revision=revision+1,updated_at=now()
   where user_id=subject and revision=expected_revision
   returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'progress_conflict'; end if;
 return next_revision;
end;
$$;
revoke all on function public.get_german_progress() from public,anon;
revoke all on function public.save_german_progress(jsonb,bigint) from public,anon;
grant execute on function public.get_german_progress() to authenticated;
grant execute on function public.save_german_progress(jsonb,bigint) to authenticated;
