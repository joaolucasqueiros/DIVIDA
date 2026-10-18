begin;
create function public.reject_future_realized() returns trigger language plpgsql as $$
begin
 if new.date>(now() at time zone 'America/Sao_Paulo')::date then
  if tg_table_name='transactions' then
   if new.status='realized' then raise exception 'Future transactions must be planned';end if;
  else raise exception 'Work earnings must already have occurred';end if;
 end if;return new;
end$$;
create trigger realized_date_guard before insert or update on transactions for each row execute function reject_future_realized();
create trigger work_date_guard before insert or update on daily_work_earnings for each row execute function reject_future_realized();
commit;
