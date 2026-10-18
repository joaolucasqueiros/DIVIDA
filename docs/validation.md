# Validação local — 18/10/2026

- Instalação reproduzida com `npm ci`, Node 24.19.0 e lockfile.
- `npm run build`: TypeScript do frontend/Worker e bundle de produção passaram.
- `npm test`: 16 testes passaram (12 financeiros e 4 do contrato HTTP do Worker).
- `npm run test:e2e`: 3 testes passaram no Chromium, com sessões e dados interceptados exclusivamente nos testes.
- `npm run test:db`: cinco migrações aplicadas em PostgreSQL 17 efêmero. Asserções passaram para pagamento parcial, repetição da chave, estorno, planos de pagamento, RLS, referências entre usuários, imutabilidade do Cofre, limite de retirada, snapshot diário, importação de dívidas/extratos, recorrências e alertas.
- Concorrência: duas sessões tentaram pagar R$ 750 de uma dívida de R$ 1.000. Uma foi aceita e a outra recusada; saldo pago permaneceu R$ 750.
- `npm audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade informada nas dependências de produção.
- `wrangler deploy --dry-run`: pacote do Worker gerado, sem publicação.
- Vite e Worker iniciados; saúde direta e via proxy retornou `ok:true, configured:false`. API privada retornou 503 informando configuração ausente. A interface exibiu a orientação para conectar Supabase, sem dados fictícios.

## Pendente por dependência externa

O usuário informou que ainda não possui projeto Supabase. Portanto, não foram validados login por e-mail real, entrega SMTP, Storage Supabase real, sincronização entre dispositivos, Pluggy/Santander ou Google Calendar. Os testes PostgreSQL emulam auth.uid()/Storage para verificar migrações e isolamento; não substituem esses testes externos. Não houve deploy da aplicação nem publicação do ambiente nesta tarefa.

O rascunho do ambiente contém install_script, start_skill, requisitos de configuração pública do Supabase e domínios de Google/Pluggy. O hostname específico do Supabase deve ser adicionado quando o projeto existir. Consulte README.md e production-checklist.md para concluir a ativação.
