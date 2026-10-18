#!/usr/bin/env bash
set -euo pipefail
container="$1"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
set timezone='America/Sao_Paulo';
insert into auth.users values('00000000-0000-4000-8000-000000000003');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
insert into debts(id,name,creditor,amount,due_date) values('80000000-0000-4000-8000-000000000001','Concorrente','Credor',100000,current_date);
SQL
request_payment() {
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
set timezone='America/Sao_Paulo';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
select record_payment('80000000-0000-4000-8000-000000000001',75000,current_date,gen_random_uuid());
SQL
}
logdir=$(mktemp -d)
trap 'rm -rf "$logdir"' EXIT
request_payment >"$logdir/one" 2>&1 & first=$!
request_payment >"$logdir/two" 2>&1 & second=$!
first_result=0; second_result=0
wait "$first" || first_result=$?
wait "$second" || second_result=$?
if [ "$first_result" -eq 0 ] && [ "$second_result" -eq 0 ]; then echo 'Both excessive payments succeeded'; exit 1; fi
if [ "$first_result" -ne 0 ] && [ "$second_result" -ne 0 ]; then cat "$logdir/one" "$logdir/two"; exit 1; fi
rg -q 'Payment exceeds balance' "$logdir"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
set timezone='America/Sao_Paulo';
do $$begin if(select paid from debts where id='80000000-0000-4000-8000-000000000001')<>75000 then raise exception 'concurrent balance corrupted';end if;end$$;
SQL
echo 'PASS: two concurrent payments cannot exceed the debt balance'
