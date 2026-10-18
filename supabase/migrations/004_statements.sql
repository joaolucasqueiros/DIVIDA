begin;
create table transaction_import_rows(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,created_at timestamptz not null default now(),fingerprint text not null,transaction_id uuid not null,unique(user_id,fingerprint),foreign key(user_id,transaction_id) references transactions(user_id,id));
alter table transaction_import_rows enable row level security;
create policy own_read on transaction_import_rows for select to authenticated using(user_id=auth.uid());
create index on transaction_import_rows(user_id,created_at desc);
create function public.import_statement(p_rows jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare row jsonb; row_hash text; tid uuid; n integer:=0;
begin
 if auth.uid() is null or jsonb_array_length(p_rows)>1000 then raise exception 'Invalid import';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 for row in select * from jsonb_array_elements(p_rows) loop
  row_hash:=md5(lower(trim(row->>'name'))||'|'||(row->>'amount')||'|'||(row->>'date')||'|'||(row->>'kind'));
  if exists(select 1 from transaction_import_rows where user_id=auth.uid() and fingerprint=row_hash) then continue;end if;
  insert into transactions(user_id,name,amount,kind,category,date,status,source,classification)
  values(auth.uid(),row->>'name',(row->>'amount')::bigint,row->>'kind',coalesce(row->>'category','Outras'),(row->>'date')::date,'realized','statement',coalesce(row->>'classification','essential')) returning id into tid;
  insert into transaction_import_rows(user_id,fingerprint,transaction_id) values(auth.uid(),row_hash,tid);n:=n+1;
 end loop;return n;
end$$;
revoke all on function import_statement from public;
grant execute on function import_statement to authenticated;
commit;
