\set ON_ERROR_STOP on
begin;
insert into auth.users values('00000000-0000-4000-8000-000000000011');
select register_bank_connection('00000000-0000-4000-8000-000000000011','item-bank-test','Banco teste','UPDATED',null) as connection_id \gset
select apply_bank_snapshot('00000000-0000-4000-8000-000000000011',:'connection_id','[{"provider_id":"provider-test-account","name":"Conta BRL","currency":"BRL","balance":12345}]',now());
select apply_bank_snapshot('00000000-0000-4000-8000-000000000011',:'connection_id','[{"provider_id":"provider-test-account","name":"Conta BRL","currency":"BRL","balance":54321}]',now());
do $$begin
 if(select count(*) from bank_accounts where provider_id='provider-test-account')<>1 then raise exception 'duplicate synced account';end if;
 if(select count(*) from bank_balance_history where user_id='00000000-0000-4000-8000-000000000011')<>1 then raise exception 'duplicate daily balance';end if;
end$$;
select begin_bank_disconnect('00000000-0000-4000-8000-000000000011',:'connection_id');
do $$declare c uuid;begin
 select id into c from bank_connections where provider_item_id='item-bank-test';
 if exists(select 1 from bank_accounts where connection_id=c and included_in_balance) then raise exception 'revoked balance included';end if;
 begin perform apply_bank_snapshot('00000000-0000-4000-8000-000000000011',c,'[]',now());raise exception 'late sync accepted';exception when others then if sqlerrm='late sync accepted' then raise;end if;end;
 begin perform register_bank_connection('00000000-0000-4000-8000-000000000011','item-bank-test','Banco','UPDATED',null);raise exception 'consent revived';exception when others then if sqlerrm='consent revived' then raise;end if;end;
 if(select count(*) from bank_balance_history where user_id='00000000-0000-4000-8000-000000000011')<>1 then raise exception 'lost bank history';end if;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
do $$begin
 begin perform register_bank_connection(auth.uid(),'arbitrary-item','Bad','UPDATED',null);raise exception 'client can register arbitrary item';exception when insufficient_privilege then null;end;
 begin perform apply_bank_snapshot(auth.uid(),gen_random_uuid(),'[]',now());raise exception 'client can write bank balance';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000012';
do $$begin if exists(select 1 from bank_connections) then raise exception 'connection data leak';end if;end$$;
rollback;
\echo 'PASS: consent registration, snapshot idempotency, revocation, late sync, history retention and bank RPC permissions'
