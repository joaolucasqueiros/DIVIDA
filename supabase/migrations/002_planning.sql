begin;
alter table financial_goals add column savings_goal_id uuid;
alter table financial_goals add foreign key(user_id,savings_goal_id) references savings_goals(user_id,id);
alter table profiles add column display_name text not null default '';
alter table user_settings add column alerts_enabled boolean not null default true;
create function public.refresh_savings_alerts() returns integer language plpgsql security definer set search_path=public as $$
declare g savings_goals; reserve bigint; milestone integer; n integer:=0; day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if exists(select 1 from user_settings where user_id=auth.uid() and not alerts_enabled) then return 0;end if;
 for g in select * from savings_goals where user_id=auth.uid() loop
  select g.initial_reserved+coalesce((select sum(amount) from savings_contributions where goal_id=g.id and user_id=auth.uid()),0)-coalesce((select sum(amount) from savings_withdrawals where goal_id=g.id and user_id=auth.uid()),0) into reserve;
  foreach milestone in array array[25,50,75,100] loop
   if reserve*100>=g.amount*milestone then
    insert into savings_alerts(user_id,goal_id,name,date) values(auth.uid(),g.id,'Você atingiu '||milestone||'% da meta',day) on conflict do nothing;n:=n+1;
   end if;
  end loop;
  if g.due_date-day in (0,7,15,30) then
   insert into savings_alerts(user_id,goal_id,name,date) values(auth.uid(),g.id,'Faltam '||(g.due_date-day)||' dias para a mudança',day) on conflict do nothing;n:=n+1;
  end if;
  if exists(select 1 from debts where user_id=auth.uid() and paid<amount+fees and due_date<=least(day+3,g.due_date) and status<>'archived') then
   insert into savings_alerts(user_id,goal_id,name,date) values(auth.uid(),g.id,'Existem dívidas vencidas ou vencendo em até 3 dias',day) on conflict do nothing;n:=n+1;
  end if;
 end loop;return n;
end $$;
revoke all on function refresh_savings_alerts from public;
grant execute on function refresh_savings_alerts to authenticated;
commit;
