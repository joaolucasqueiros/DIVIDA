-- Clareza: money stored in integer BRL cents.
begin;
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null default '', email text, unique(user_id,id));
create table public.debts (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, creditor text not null, category text not null default 'Outras', description text, amount bigint not null check(amount>0), fees bigint not null default 0 check(fees>=0), contract_date date, paid bigint not null default 0 check(paid>=0 and paid<=amount+fees), due_date date not null, interest_rate numeric not null default 0 check(interest_rate>=0), priority integer not null default 3 check(priority between 1 and 5), status text not null default 'active', installments integer not null default 1 check(installments>0), notes text, unique(user_id,id));
create table public.debt_installments (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), debt_id uuid not null, number integer not null check(number>0), amount bigint not null check(amount>0), due_date date not null, unique(user_id,debt_id,number), unique(user_id,id));
create table public.debt_payments (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), debt_id uuid not null, amount bigint not null check(amount<>0), date date not null, notes text, idempotency_key uuid not null, reversal_of uuid, plan_id uuid, unique(user_id,idempotency_key), unique(reversal_of), unique(user_id,id));
create table public.payment_plans (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), debt_id uuid not null, amount bigint not null check(amount>0), due_date date not null, priority integer not null default 3, notes text, status text not null default 'pending', unique(user_id,id));
create table public.transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, amount bigint not null check(amount>0), kind text not null check(kind in ('income','expense')), category text not null, date date not null, status text not null check(status in ('realized','planned')), recurrence text not null default 'none', classification text not null default 'essential', source text not null default 'manual', unique(user_id,id));
create table public.categories (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, kind text not null default 'expense', unique(user_id,id));
create table public.bank_connections (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, provider_item_id text not null, last_sync timestamptz, error text, unique(user_id,provider_item_id), unique(user_id,id));
create table public.bank_accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, institution text not null, balance bigint not null default 0, currency text not null default 'BRL' check(currency='BRL'), source text not null default 'manual', provider_id text, last_sync timestamptz, unique(user_id,provider_id), unique(user_id,id));
create table public.bank_balance_history (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), account_id uuid not null, date date not null, balance bigint not null, source text not null, unique(user_id,account_id,date), unique(user_id,id));
create table public.financial_goals (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, amount bigint not null check(amount>0), saved bigint not null default 0 check(saved>=0), due_date date not null, unique(user_id,id));
create table public.budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, category text not null, amount bigint not null check(amount>0), month date not null, unique(user_id,id));
create table public.notes (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, description text, debt_id uuid, unique(user_id,id));
create table public.reminders (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, due_date date not null, time text not null default '09:00', recurrence text not null default 'none', done boolean not null default false, debt_id uuid, unique(user_id,id));
create table public.calendar_events (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), reminder_id uuid not null, google_event_id text not null, unique(user_id,reminder_id), unique(user_id,id));
create table public.import_jobs (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, fingerprint text not null, row_count integer not null, unique(user_id,fingerprint), unique(user_id,id));
create table public.import_rows (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), job_id uuid not null, fingerprint text not null, debt_id uuid not null, unique(user_id,fingerprint), unique(user_id,id));
create table public.audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), table_name text not null, record_id uuid not null, operation text not null, before_data jsonb, after_data jsonb, unique(user_id,id));
create table public.user_settings (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, theme text not null default 'light', timezone text not null default 'America/Sao_Paulo', unique(user_id), unique(user_id,id));
create table public.savings_goals (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), name text not null, due_date date not null, amount bigint not null check(amount>0), initial_reserved bigint not null default 0 check(initial_reserved>=0), daily_income bigint not null default 0 check(daily_income>=0), work_days integer not null default 5 check(work_days between 0 and 7), daily_variable bigint not null default 0 check(daily_variable>=0), contingency numeric not null default 10 check(contingency between 0 and 100), unique(user_id,id));
create table public.savings_contributions (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), goal_id uuid not null, amount bigint not null check(amount>0), date date not null, purpose text not null, account_id uuid, unique(user_id,id));
create table public.savings_withdrawals (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), goal_id uuid not null, amount bigint not null check(amount>0), date date not null, reason text not null, purpose text not null, unique(user_id,id));
create table public.savings_budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), goal_id uuid not null, name text not null, amount bigint not null check(amount>0), period text not null check(period in ('daily','weekly')), classification text not null, unique(user_id,id));
create table public.daily_work_earnings (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), date date not null, gross bigint not null check(gross>=0), fuel bigint not null default 0 check(fuel>=0), food bigint not null default 0 check(food>=0), maintenance bigint not null default 0 check(maintenance>=0), other bigint not null default 0 check(other>=0), hours numeric not null check(hours>0 and hours<=24), unique(user_id,id));
create table public.moving_expenses (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), goal_id uuid not null, name text not null, amount bigint not null check(amount>=0), actual bigint check(actual>=0), priority integer not null default 3, due_date date not null, status text not null default 'pending', unique(user_id,id));
create table public.savings_scenarios (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), goal_id uuid not null, name text not null, income_factor numeric not null check(income_factor between 0 and 3), expense_factor numeric not null check(expense_factor between 0 and 3), work_days integer not null check(work_days between 0 and 7), unique(user_id,id));
create table public.savings_alerts (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, created_at timestamptz not null default now(), goal_id uuid not null, name text not null, date date not null, dismissed boolean not null default false, unique(user_id,goal_id,name,date), unique(user_id,id));
alter table public.debt_installments add foreign key(user_id,debt_id) references public.debts(user_id,id);
alter table public.debt_payments add foreign key(user_id,debt_id) references public.debts(user_id,id);
alter table public.debt_payments add foreign key(user_id,reversal_of) references public.debt_payments(user_id,id);
alter table public.debt_payments add foreign key(user_id,plan_id) references public.payment_plans(user_id,id);
alter table public.payment_plans add foreign key(user_id,debt_id) references public.debts(user_id,id);
alter table public.bank_balance_history add foreign key(user_id,account_id) references public.bank_accounts(user_id,id);
alter table public.notes add foreign key(user_id,debt_id) references public.debts(user_id,id);
alter table public.reminders add foreign key(user_id,debt_id) references public.debts(user_id,id);
alter table public.calendar_events add foreign key(user_id,reminder_id) references public.reminders(user_id,id);
alter table public.import_rows add foreign key(user_id,job_id) references public.import_jobs(user_id,id);
alter table public.import_rows add foreign key(user_id,debt_id) references public.debts(user_id,id);
alter table public.savings_contributions add foreign key(user_id,account_id) references public.bank_accounts(user_id,id);
alter table public.savings_contributions add foreign key(user_id,goal_id) references public.savings_goals(user_id,id);
alter table public.savings_withdrawals add foreign key(user_id,goal_id) references public.savings_goals(user_id,id);
alter table public.savings_budgets add foreign key(user_id,goal_id) references public.savings_goals(user_id,id);
alter table public.moving_expenses add foreign key(user_id,goal_id) references public.savings_goals(user_id,id);
alter table public.savings_scenarios add foreign key(user_id,goal_id) references public.savings_goals(user_id,id);
alter table public.savings_alerts add foreign key(user_id,goal_id) references public.savings_goals(user_id,id);
alter table public.profiles enable row level security;
create index on public.profiles(user_id,created_at desc);
create policy own_read on public.profiles for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.profiles for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.debts enable row level security;
create index on public.debts(user_id,created_at desc);
create policy own_read on public.debts for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.debts for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.debts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.debt_installments enable row level security;
create index on public.debt_installments(user_id,created_at desc);
create policy own_read on public.debt_installments for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.debt_installments for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.debt_installments for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.debt_payments enable row level security;
create index on public.debt_payments(user_id,created_at desc);
create policy own_read on public.debt_payments for select to authenticated using(user_id=auth.uid());
alter table public.payment_plans enable row level security;
create index on public.payment_plans(user_id,created_at desc);
create policy own_read on public.payment_plans for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.payment_plans for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.payment_plans for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.transactions enable row level security;
create index on public.transactions(user_id,created_at desc);
create policy own_read on public.transactions for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.transactions for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.transactions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.categories enable row level security;
create index on public.categories(user_id,created_at desc);
create policy own_read on public.categories for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.categories for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.categories for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.bank_connections enable row level security;
create index on public.bank_connections(user_id,created_at desc);
create policy own_read on public.bank_connections for select to authenticated using(user_id=auth.uid());
alter table public.bank_accounts enable row level security;
create index on public.bank_accounts(user_id,created_at desc);
create policy own_read on public.bank_accounts for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.bank_accounts for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.bank_accounts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.bank_balance_history enable row level security;
create index on public.bank_balance_history(user_id,created_at desc);
create policy own_read on public.bank_balance_history for select to authenticated using(user_id=auth.uid());
alter table public.financial_goals enable row level security;
create index on public.financial_goals(user_id,created_at desc);
create policy own_read on public.financial_goals for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.financial_goals for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.financial_goals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.budgets enable row level security;
create index on public.budgets(user_id,created_at desc);
create policy own_read on public.budgets for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.budgets for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.budgets for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.notes enable row level security;
create index on public.notes(user_id,created_at desc);
create policy own_read on public.notes for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.notes for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.notes for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.reminders enable row level security;
create index on public.reminders(user_id,created_at desc);
create policy own_read on public.reminders for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.reminders for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.reminders for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.calendar_events enable row level security;
create index on public.calendar_events(user_id,created_at desc);
create policy own_read on public.calendar_events for select to authenticated using(user_id=auth.uid());
alter table public.import_jobs enable row level security;
create index on public.import_jobs(user_id,created_at desc);
create policy own_read on public.import_jobs for select to authenticated using(user_id=auth.uid());
alter table public.import_rows enable row level security;
create index on public.import_rows(user_id,created_at desc);
create policy own_read on public.import_rows for select to authenticated using(user_id=auth.uid());
alter table public.audit_logs enable row level security;
create index on public.audit_logs(user_id,created_at desc);
create policy own_read on public.audit_logs for select to authenticated using(user_id=auth.uid());
alter table public.user_settings enable row level security;
create index on public.user_settings(user_id,created_at desc);
create policy own_read on public.user_settings for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.user_settings for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.user_settings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.savings_goals enable row level security;
create index on public.savings_goals(user_id,created_at desc);
create policy own_read on public.savings_goals for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.savings_goals for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.savings_goals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.savings_contributions enable row level security;
create index on public.savings_contributions(user_id,created_at desc);
create policy own_read on public.savings_contributions for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.savings_contributions for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.savings_contributions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.savings_withdrawals enable row level security;
create index on public.savings_withdrawals(user_id,created_at desc);
create policy own_read on public.savings_withdrawals for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.savings_withdrawals for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.savings_withdrawals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.savings_budgets enable row level security;
create index on public.savings_budgets(user_id,created_at desc);
create policy own_read on public.savings_budgets for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.savings_budgets for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.savings_budgets for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.daily_work_earnings enable row level security;
create index on public.daily_work_earnings(user_id,created_at desc);
create policy own_read on public.daily_work_earnings for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.daily_work_earnings for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.daily_work_earnings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.moving_expenses enable row level security;
create index on public.moving_expenses(user_id,created_at desc);
create policy own_read on public.moving_expenses for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.moving_expenses for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.moving_expenses for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.savings_scenarios enable row level security;
create index on public.savings_scenarios(user_id,created_at desc);
create policy own_read on public.savings_scenarios for select to authenticated using(user_id=auth.uid());
create policy own_insert on public.savings_scenarios for insert to authenticated with check(user_id=auth.uid());
create policy own_update on public.savings_scenarios for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.savings_alerts enable row level security;
create index on public.savings_alerts(user_id,created_at desc);
create policy own_read on public.savings_alerts for select to authenticated using(user_id=auth.uid());

-- Internal OAuth secrets are inaccessible to browser roles.
create table public.integration_tokens(user_id uuid primary key references auth.users(id) on delete cascade, ciphertext text not null);
alter table public.integration_tokens enable row level security;
revoke all on public.integration_tokens from anon, authenticated;

create function public.record_audit() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into audit_logs(user_id,table_name,record_id,operation,before_data,after_data)
 values(new.user_id,tg_table_name,new.id,tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create trigger audit after insert or update on debts for each row execute function record_audit();
create trigger audit after insert or update on debt_payments for each row execute function record_audit();
create trigger audit after insert or update on transactions for each row execute function record_audit();
create trigger audit after insert or update on bank_accounts for each row execute function record_audit();
create trigger audit after insert or update on savings_contributions for each row execute function record_audit();
create trigger audit after insert or update on savings_withdrawals for each row execute function record_audit();
create trigger audit after insert or update on daily_work_earnings for each row execute function record_audit();

create function public.protect_debt_balance() returns trigger language plpgsql as $$
begin
 if current_user in ('authenticated','anon') and (new.paid<>old.paid or new.user_id<>old.user_id) then raise exception 'Use record_payment'; end if;
 return new;
end $$;
create trigger balance_guard before update on debts for each row execute function protect_debt_balance();
create function public.reject_debt_paid_insert() returns trigger language plpgsql as $$
begin if new.paid<>0 then raise exception 'Initial paid must be zero'; end if; return new; end $$;
create trigger initial_paid_guard before insert on debts for each row execute function reject_debt_paid_insert();

create function public.record_payment(p_debt_id uuid,p_amount bigint,p_date date,p_key uuid,p_notes text default '',p_reversal uuid default null,p_plan uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare d debts; old_payment debt_payments; result uuid; plan payment_plans;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into d from debts where id=p_debt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Debt not found'; end if;
 select id into result from debt_payments where user_id=auth.uid() and idempotency_key=p_key;
 if found then return result; end if;
 if p_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Future payment not allowed'; end if;
 if p_reversal is not null then
  select * into old_payment from debt_payments where id=p_reversal and user_id=auth.uid() and debt_id=p_debt_id;
  if not found or old_payment.amount<=0 or p_amount<>-old_payment.amount then raise exception 'Invalid reversal'; end if;
 elsif p_amount<=0 then raise exception 'Payment must be positive'; end if;
 if d.paid+p_amount<0 or d.paid+p_amount>d.amount+d.fees then raise exception 'Payment exceeds balance'; end if;
 if p_plan is not null then
  select * into plan from payment_plans where id=p_plan and user_id=auth.uid() and debt_id=p_debt_id for update;
  if not found or plan.status<>'pending' or p_amount>plan.amount then raise exception 'Invalid payment plan'; end if;
  if p_amount=plan.amount then update payment_plans set status='completed' where id=p_plan;
  else update payment_plans set amount=amount-p_amount where id=p_plan; end if;
 end if;
 insert into debt_payments(user_id,debt_id,amount,date,notes,idempotency_key,reversal_of,plan_id)
 values(auth.uid(),p_debt_id,p_amount,p_date,left(p_notes,2000),p_key,p_reversal,p_plan) returning id into result;
 update debts set paid=paid+p_amount where id=p_debt_id;
 if p_reversal is not null and old_payment.plan_id is not null then
  update payment_plans set amount=case when status='completed' then old_payment.amount else amount+old_payment.amount end,status='pending' where id=old_payment.plan_id;
 end if;
 return result;
end $$;
revoke all on function record_payment from public;
grant execute on function record_payment to authenticated;

-- Serialize deposits and withdrawals on the goal. These are earmarks, never bank debits.
create function public.check_reserve() returns trigger language plpgsql security definer set search_path=public as $$
declare balance bigint;
begin
 perform 1 from savings_goals where id=new.goal_id and user_id=new.user_id for update;
 if tg_op='UPDATE' then raise exception 'Reserve entries are immutable; create a correcting entry'; end if;
 if new.date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Future reserve entry not allowed'; end if;
 select initial_reserved + coalesce((select sum(amount) from savings_contributions where goal_id=new.goal_id and user_id=new.user_id),0)
 - coalesce((select sum(amount) from savings_withdrawals where goal_id=new.goal_id and user_id=new.user_id),0) into balance
 from savings_goals where id=new.goal_id and user_id=new.user_id;
 if tg_table_name='savings_withdrawals' and new.amount>balance then raise exception 'Insufficient reserve'; end if;
 return new;
end $$;
create trigger reserve_guard before insert or update on savings_contributions for each row execute function check_reserve();
create trigger reserve_guard before insert or update on savings_withdrawals for each row execute function check_reserve();

create function public.import_debts(p_name text,p_fingerprint text,p_rows jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare job uuid; row jsonb; debt uuid; row_fingerprint text; n integer:=0;
begin
 if auth.uid() is null or jsonb_array_length(p_rows)>1000 then raise exception 'Invalid import'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from import_jobs where user_id=auth.uid() and import_jobs.fingerprint=p_fingerprint) then return 0; end if;
 insert into import_jobs(user_id,name,fingerprint,row_count) values(auth.uid(),p_name,p_fingerprint,0) returning id into job;
 for row in select * from jsonb_array_elements(p_rows) loop
  row_fingerprint:=md5(lower(trim(row->>'name'))||'|'||lower(trim(row->>'creditor'))||'|'||(row->>'amount')||'|'||(row->>'due_date'));
  if exists(select 1 from import_rows where user_id=auth.uid() and import_rows.fingerprint=row_fingerprint) or
     exists(select 1 from debts where user_id=auth.uid() and lower(trim(name))=lower(trim(row->>'name')) and lower(trim(creditor))=lower(trim(row->>'creditor')) and amount=(row->>'amount')::bigint and due_date=(row->>'due_date')::date) then continue; end if;
  insert into debts(user_id,name,creditor,amount,due_date,category,installments)
  values(auth.uid(),row->>'name',row->>'creditor',(row->>'amount')::bigint,(row->>'due_date')::date,coalesce(row->>'category','Outras'),coalesce((row->>'installments')::int,1)) returning id into debt;
  insert into import_rows(user_id,job_id,fingerprint,debt_id) values(auth.uid(),job,row_fingerprint,debt); n:=n+1;
 end loop;
 update import_jobs set row_count=n where id=job; return n;
end $$;
revoke all on function import_debts from public;
grant execute on function import_debts to authenticated;

-- Private documents: first folder is the user's UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy documents_read on storage.objects for select to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy documents_insert on storage.objects for insert to authenticated with check(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy documents_delete on storage.objects for delete to authenticated using(bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text);

create function public.snapshot_manual_balance() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.source='manual' then
 insert into bank_balance_history(user_id,account_id,date,balance,source) values(new.user_id,new.id,(now() at time zone 'America/Sao_Paulo')::date,new.balance,'manual')
 on conflict(user_id,account_id,date) do update set balance=excluded.balance;
 end if; return new;
end $$;
create trigger manual_balance_history after insert or update on bank_accounts for each row execute function snapshot_manual_balance();
create function public.protect_synced_account() returns trigger language plpgsql as $$
begin
 if current_user in ('authenticated','anon') and (new.source<>'manual' or (tg_op='UPDATE' and old.source<>'manual')) then raise exception 'Synced account is read only'; end if; return new;
end $$;
create trigger synced_guard before insert or update on bank_accounts for each row execute function protect_synced_account();
create function public.protect_initial_reserve() returns trigger language plpgsql as $$
begin
 if new.initial_reserved<>old.initial_reserved and (exists(select 1 from savings_contributions where goal_id=old.id) or exists(select 1 from savings_withdrawals where goal_id=old.id)) then raise exception 'Use a reserve entry to correct your balance'; end if; return new;
end $$;
create trigger initial_reserve_guard before update on savings_goals for each row execute function protect_initial_reserve();
commit;
