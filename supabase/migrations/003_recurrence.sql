begin;
alter table profiles add unique(user_id);
alter table transactions add column recurrence_parent_id uuid;
alter table transactions add foreign key(user_id,recurrence_parent_id) references transactions(user_id,id);
create unique index transaction_occurrence on transactions(user_id,recurrence_parent_id,date) where recurrence_parent_id is not null;
create function public.realize_transaction(p_id uuid,p_date date) returns uuid language plpgsql security definer set search_path=public as $$
declare t transactions; result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into t from transactions where id=p_id and user_id=auth.uid() and status='planned' for update;
 if not found or p_date<t.date or p_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Invalid planned occurrence';end if;
 if t.recurrence='none' and p_date<>t.date then raise exception 'Date mismatch';end if;
 select id into result from transactions where user_id=auth.uid() and recurrence_parent_id=p_id and date=p_date;
 if found then return result;end if;
 insert into transactions(user_id,name,amount,kind,category,date,status,recurrence,classification,source,recurrence_parent_id)
 values(auth.uid(),t.name,t.amount,t.kind,t.category,p_date,'realized','none',t.classification,'manual',t.id) returning id into result;return result;
end$$;
revoke all on function realize_transaction from public;
grant execute on function realize_transaction to authenticated;
commit;
