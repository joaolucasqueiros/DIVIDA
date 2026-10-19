-- Bank credentials stay in Worker secrets. Only consent metadata is persisted.
begin;
alter table bank_connections add column status text not null default 'active' check(status in ('active','disconnecting','disconnected'));
alter table bank_connections add column provider_status text;
alter table bank_connections add column consent_expires_at timestamptz;
alter table bank_connections add column provider_updated_at timestamptz;
alter table bank_connections add column disconnected_at timestamptz;
alter table bank_accounts add column connection_id uuid;
alter table bank_accounts add foreign key(user_id,connection_id) references bank_connections(user_id,id);
alter table bank_accounts add column included_in_balance boolean not null default true;
create index on bank_connections(user_id,status);
create index on bank_accounts(user_id,connection_id);
create trigger bank_connection_audit after insert or update on bank_connections for each row execute function record_audit();

-- A widget success callback can be retried, but cannot revive a disconnecting item.
create function public.register_bank_connection(p_user uuid,p_item text,p_name text,p_status text,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path=public as $$
declare c bank_connections; result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,1));
 select * into c from bank_connections where user_id=p_user and provider_item_id=p_item for update;
 if found then
  if c.status<>'active' then raise exception 'Connection was revoked';end if;
  update bank_connections set name=p_name,provider_status=p_status,consent_expires_at=p_expires,error=null where id=c.id;
  return c.id;
 end if;
 if (select count(*) from bank_connections where user_id=p_user and status='active')>=10 then raise exception 'Maximum active connections reached';end if;
 insert into bank_connections(user_id,name,provider_item_id,status,provider_status,consent_expires_at)
 values(p_user,p_name,p_item,'active',p_status,p_expires) returning id into result;
 return result;
end$$;
revoke all on function register_bank_connection from public,anon,authenticated;
grant execute on function register_bank_connection to service_role;

-- Serialize account snapshots with disconnect. A late sync cannot reactivate a revoked balance.
create function public.apply_bank_snapshot(p_user uuid,p_connection uuid,p_accounts jsonb,p_provider_updated timestamptz) returns integer
language plpgsql security definer set search_path=public as $$
declare c bank_connections; a jsonb; saved_account_id uuid; n integer:=0;
begin
 select * into c from bank_connections where user_id=p_user and id=p_connection for update;
 if not found or c.status<>'active' then raise exception 'Connection is not active';end if;
 if jsonb_typeof(p_accounts)<>'array' or jsonb_array_length(p_accounts)>500 then raise exception 'Invalid snapshot';end if;
 update bank_accounts set included_in_balance=false where user_id=p_user and connection_id=c.id;
 for a in select * from jsonb_array_elements(p_accounts) loop
  if (a->>'currency')<>'BRL' or abs((a->>'balance')::bigint)>900000000000 then raise exception 'Invalid bank balance';end if;
  insert into bank_accounts(user_id,provider_id,name,institution,balance,currency,source,last_sync,connection_id,included_in_balance)
  values(p_user,a->>'provider_id',a->>'name',c.name,(a->>'balance')::bigint,'BRL','pluggy',now(),c.id,true)
  on conflict(user_id,provider_id) do update set name=excluded.name,institution=excluded.institution,balance=excluded.balance,last_sync=excluded.last_sync,connection_id=excluded.connection_id,included_in_balance=true
  returning id into saved_account_id;
  insert into bank_balance_history(user_id,account_id,date,balance,source)
  values(p_user,saved_account_id,(now() at time zone 'America/Sao_Paulo')::date,(a->>'balance')::bigint,'pluggy')
  on conflict(user_id,account_id,date) do update set balance=excluded.balance;
  n:=n+1;
 end loop;
 update bank_connections set last_sync=now(),provider_updated_at=p_provider_updated,provider_status='UPDATED',error=null where id=c.id;
 return n;
end$$;

create function public.begin_bank_disconnect(p_user uuid,p_connection uuid) returns text
language plpgsql security definer set search_path=public as $$
declare c bank_connections;
begin
 select * into c from bank_connections where user_id=p_user and id=p_connection for update;
 if not found then raise exception 'Connection not found';end if;
 if c.status<>'disconnected' then
  update bank_connections set status='disconnecting',error=null where id=c.id;
  update bank_accounts set included_in_balance=false where user_id=p_user and connection_id=c.id;
 end if;
 return c.provider_item_id;
end$$;
revoke all on function apply_bank_snapshot from public,anon,authenticated;
revoke all on function begin_bank_disconnect from public,anon,authenticated;
grant execute on function apply_bank_snapshot to service_role;
grant execute on function begin_bank_disconnect to service_role;
commit;
