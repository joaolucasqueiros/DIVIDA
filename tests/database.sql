\set ON_ERROR_STOP on
set timezone='America/Sao_Paulo';
begin;
insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into debts(id,name,creditor,amount,due_date) values('10000000-0000-4000-8000-000000000001','Dívida A','Credor',100000,current_date);
select record_payment('10000000-0000-4000-8000-000000000001',25000,current_date,'20000000-0000-4000-8000-000000000001');
select record_payment('10000000-0000-4000-8000-000000000001',25000,current_date,'20000000-0000-4000-8000-000000000001');
do $$begin
 if (select paid from debts where id='10000000-0000-4000-8000-000000000001')<>25000 then raise exception 'idempotency failed'; end if;
 if (select count(*) from debt_payments)<>1 then raise exception 'duplicate payment'; end if;
 begin perform record_payment('10000000-0000-4000-8000-000000000001',90000,current_date,gen_random_uuid());raise exception 'overpayment accepted';exception when others then if sqlerrm='overpayment accepted' then raise; end if; end;
 begin update debts set paid=0;raise exception 'direct paid mutation accepted';exception when others then if sqlerrm='direct paid mutation accepted' then raise; end if; end;
 delete from debt_payments;
 if(select count(*) from debt_payments)<>1 then raise exception 'immutable payment deleted';end if;
end$$;
select record_payment('10000000-0000-4000-8000-000000000001',-25000,current_date,'20000000-0000-4000-8000-000000000002','Estorno',(select id from debt_payments limit 1));
do $$begin if (select paid from debts limit 1)<>0 or (select count(*) from debt_payments)<>2 then raise exception 'reversal failed'; end if;end$$;
insert into bank_accounts(id,name,institution,balance) values('30000000-0000-4000-8000-000000000001','Manual','Banco',50000);
update bank_accounts set balance=60000 where id='30000000-0000-4000-8000-000000000001';
do $$begin if(select count(*) from bank_balance_history)<>1 or (select balance from bank_balance_history limit 1)<>60000 then raise exception 'daily snapshot failed';end if;end$$;
insert into savings_goals(id,name,due_date,amount,initial_reserved) values('40000000-0000-4000-8000-000000000001','Mudança',current_date+60,500000,10000);
insert into savings_contributions(goal_id,amount,date,purpose,account_id) values('40000000-0000-4000-8000-000000000001',20000,current_date,'Frete','30000000-0000-4000-8000-000000000001');
insert into savings_withdrawals(goal_id,amount,date,reason,purpose) values('40000000-0000-4000-8000-000000000001',5000,current_date,'Ajuste','Frete');
do $$begin
 if(select balance from bank_accounts limit 1)<>60000 then raise exception 'reserve changed bank';end if;
 begin insert into savings_withdrawals(goal_id,amount,date,reason,purpose) values('40000000-0000-4000-8000-000000000001',26000,current_date,'Inválido','Frete');raise exception 'reserve overdraft accepted';exception when others then if sqlerrm='reserve overdraft accepted' then raise;end if;end;
 begin update savings_contributions set amount=1;raise exception 'reserve mutation accepted';exception when others then if sqlerrm='reserve mutation accepted' then raise;end if;end;
end$$;
select import_debts('test','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','[{"name":"Importada","creditor":"Credor","amount":12345,"due_date":"2026-12-01"}]');
select import_debts('test2','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','[{"name":"Importada","creditor":"Credor","amount":12345,"due_date":"2026-12-01"}]');
do $$begin if(select count(*) from debts where name='Importada')<>1 then raise exception 'import duplication';end if;end$$;

insert into payment_plans(id,debt_id,amount,due_date) values('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',50000,current_date);
select record_payment('10000000-0000-4000-8000-000000000001',20000,current_date,'60000000-0000-4000-8000-000000000001','Parcial',null,'50000000-0000-4000-8000-000000000001');
do $$begin if(select amount from payment_plans limit 1)<>30000 then raise exception 'partial plan failed';end if;end$$;
select record_payment('10000000-0000-4000-8000-000000000001',-20000,current_date,'60000000-0000-4000-8000-000000000002','Estorno parcial',(select id from debt_payments where idempotency_key='60000000-0000-4000-8000-000000000001'));
do $$begin if(select amount from payment_plans limit 1)<>50000 then raise exception 'plan reversal failed';end if;end$$;
insert into transactions(id,name,amount,kind,category,date,status,recurrence) values('70000000-0000-4000-8000-000000000001','Recorrente',1000,'expense','Contas',current_date,'planned','monthly');
select realize_transaction('70000000-0000-4000-8000-000000000001',current_date);
select realize_transaction('70000000-0000-4000-8000-000000000001',current_date);
do $$begin if(select count(*) from transactions where recurrence_parent_id='70000000-0000-4000-8000-000000000001')<>1 then raise exception 'recurrence duplicated';end if;end$$;
select import_statement('[{"name":"Extrato","amount":1200,"kind":"expense","category":"Mercado","date":"2026-10-18"}]');
select import_statement('[{"name":"Extrato","amount":1200,"kind":"expense","category":"Mercado","date":"2026-10-18"}]');
do $$begin if(select count(*) from transactions where name='Extrato')<>1 then raise exception 'statement duplicated';end if;end$$;
select refresh_savings_alerts();
select refresh_savings_alerts();
do $$begin if(select count(*) from savings_alerts where name='Existem dívidas vencidas ou vencendo em até 3 dias')<>1 then raise exception 'alerts duplication';end if;end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
 if(select count(*) from debts)<>0 or (select count(*) from audit_logs)<>0 then raise exception 'RLS data leakage';end if;
 begin perform record_payment('10000000-0000-4000-8000-000000000001',100,current_date,gen_random_uuid());raise exception 'cross user payment allowed';exception when others then if sqlerrm='cross user payment allowed' then raise;end if;end;
 begin insert into payment_plans(debt_id,amount,due_date) values('10000000-0000-4000-8000-000000000001',100,current_date);raise exception 'cross user FK allowed';exception when foreign_key_violation then null;end;
end$$;
rollback;
\echo 'PASS: payment, idempotency, reversal, RLS, cross-user FK, reserve, audit, bank snapshot and import assertions'
