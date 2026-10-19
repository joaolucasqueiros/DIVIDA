# Clareza

Aplicação financeira pessoal em React + TypeScript + Vite, Tailwind, Recharts e Lucide; API Cloudflare Worker; Supabase PostgreSQL/Auth/Storage. Interface em português, BRL em centavos e calendário America/Sao_Paulo. Inclui o Projeto Mudança / Modo Economia.

## Desenvolvimento

Requer Node 22.12+ (validado com Node 24), npm e um projeto Supabase. Use o checkout existente; cada tarefa cloud já é isolada, sem necessidade de worktrees.

```sh
cd /workspace/DIVIDA
npm ci --cache /workspace/.npm-cache
# No ambiente cloud, use também:
export XDG_CONFIG_HOME=/workspace/.config
export WRANGLER_SEND_METRICS=false
cp .env.example .env.local
cp .dev.vars.example .dev.vars
# Preencha os arquivos localmente, sem versionar credenciais.
npm run build
npm test
npm run dev:api
# Em outro terminal:
npm run dev
```

`npm run prepare:env` também pode criar os arquivos locais a partir de variáveis injetadas pelo ambiente; não substitui arquivos existentes e não imprime valores.

O frontend Vite encaminha `/api` ao Worker em 8787. O Worker também serve o build estático. Sem Supabase configurado, o aplicativo mostra orientações de configuração, sem dados fictícios. `GET /api/health` informa se URL/chave pública do Supabase foram configuradas (não testa acesso ao banco). A aplicação autenticada precisa das migrações.

### Supabase

1. Crie um projeto. No SQL Editor execute os arquivos de `supabase/migrations/` em ordem numérica, uma única vez cada, ou use o CLI Supabase para aplicar migrações versionadas.
2. Copie Project URL e chave pública/publishable ou anon para `.env.local` e `.dev.vars`. A chave pública pode estar no frontend; **service role e demais segredos nunca podem ter prefixo VITE_**.
3. Ative Email Auth, configure SMTP para entrega confiável e Site URL/Redirect URLs para a origem local e a origem pública. O template de e-mail pode incluir `{{ .Token }}` para OTP, além do magic link padrão.
4. A migração cria todas as tabelas pessoais, políticas RLS, índices, vínculos compostos por usuário e bucket privado `documents` (10 MB, PDF/JPEG/PNG). Supabase gerencia os usuários e sessões.
5. Para excluir conta e executar integrações de servidor, forneça `SUPABASE_SERVICE_ROLE_KEY` apenas ao Worker. Não é necessária para o CRUD pessoal, importação e pagamentos.

O teste local PostgreSQL em Docker emula os contratos de `auth.uid()` e Storage. Ele não substitui um teste de ponta a ponta no Supabase real:

```sh
npm run test:db
```

### Regras financeiras

- Dívidas guardam valor original, encargos incorporados, data de contratação, taxa mensal e prioridade. O saldo é original + encargos − pagamentos. Juros futuros só entram em projeções; não são incorporados ao saldo automaticamente.
- `record_payment` bloqueia a dívida, verifica saldo e proprietário e grava o pagamento e a atualização na mesma transação. A chave UUID impede repetição do mesmo pedido. Estornos são lançamentos negativos ligados ao original; não há edição ou exclusão de pagamentos pelo usuário.
- Pagamentos parciais de planos reduzem seu valor pendente. Estornar reabre o plano. O saldo da conta bancária não é debitado por pagamentos manuais.
- Cofre é uma afetação contábil de dinheiro, não uma conta ou transferência. Depósitos e retiradas são imutáveis; saldo negativo é recusado. Não duplique saldos de uma conta cadastrando-a também como manual.
- Ganhos de trabalho entram pelo **líquido** (bruto − combustível − alimentação − manutenção − outros custos). Não registre novamente a mesma receita ou os mesmos custos em Receitas e despesas. Transferir para o Cofre não cria receita.
- Projeções são condicionais, nunca saldo disponível. O lucro médio usa os últimos 30 dias com registros (fallback: estimativa informada). Custos de mudança pendentes + margem e compromissos determinam a meta mínima. Dívidas são contadas uma vez, independentemente de seus planos de pagamento.
- As despesas variáveis informadas na meta devem excluir contas já cadastradas como compromissos planejados. Gastos da mudança não devem ser cadastrados novamente como despesa planejada: use a lista específica. Não há conciliação automática por semelhança.
- Recorrências são modelos de planejamento, não transações bancárias garantidas. Confirme cada ocorrência manualmente. O simulador distribui o primeiro orçamento e estima meses de quitação com as taxas mensais informadas, incluindo juros compostos e identificando orçamento insuficiente (horizonte máximo de 600 meses).
- Registros persistem após a data da mudança. Não há limpeza automática.

### Importação e relatórios

Minhas dívidas aceita CSV (separador detectado), XLSX e JSON até 2 MB/1.000 linhas. O modelo pode ser baixado na tela. Mapeie nome, credor, valor **em reais**, vencimento `AAAA-MM-DD`, categoria e parcelas. Confira a prévia antes de confirmar. A importação é atômica e deduplica por nome/credor/valor/data e hash do arquivo normalizado. Dados inconsistentes rejeitam o lote inteiro. A tela permite editar o resultado após importar. Documentos ficam no Storage privado; links de consulta expiram em 60 segundos.

Relatórios exportam CSV e permitem salvar PDF pela impressão do navegador. Configurações exporta tabelas pessoais em JSON. Históricos são carregados em páginas de 200 registros pela API e mostrados em lotes de 20; os indicadores percorrem as páginas para evitar somas truncadas.

### Pluggy / Santander PF (leitura)

Prepare uma conta Pluggy e obtenha consentimento pelo fluxo oficial Meu Pluggy/Pluggy, conforme disponibilidade comercial e do conector Santander PF. Este projeto **não coleta senha bancária** nem cria consentimento por conta própria. Não há garantia de plano gratuito nem de suporte do conector para uma conta específica.

No Worker configure `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_ITEM_IDS` (itens consentidos separados por vírgula), `OWNER_USER_ID`, `SUPABASE_SERVICE_ROLE_KEY`. `POST /api/bank/sync` exige sessão do proprietário. Cron: diariamente às 12 UTC (9h em São Paulo). Apenas contas tipo BANK em BRL são consideradas, sem crédito/cartões; histórico diário usa upsert. Remova itens revogados de `PLUGGY_ITEM_IDS` e atualize o segredo para interromper tentativas no cron. Desconectar chama DELETE no item do provedor. O módulo Receitas e despesas também importa extratos CSV/XLSX/JSON (descrição, valor positivo em reais, data, tipo income/expense e categoria). A importação é atômica e idempotente por descrição/valor/data/tipo, sem alterar saldos bancários. Operações legítimas idênticas nesses campos exigem revisão e cadastro manual.

### Google Calendar

Crie um OAuth Client Web no Google Cloud, habilite Calendar API e configure a tela de consentimento/usuários de teste. Redirect URI: `https://SUA-ORIGEM/api/calendar/callback`. Configure `APP_URL` exatamente com a origem pública (sem barra final), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` e `TOKEN_ENCRYPTION_KEY` (32 bytes aleatórios em base64). Crie a chave com `openssl rand -base64 32` e salve diretamente no gerenciador de segredos, sem publicar o resultado.

A conexão usa state criptografado de 10 minutos vinculado ao cookie HttpOnly/SameSite. Tokens de atualização são criptografados AES-GCM em tabela sem acesso de clientes. IDs estáveis de eventos impedem duplicatas em retentativas. Sincronização explícita cria/atualiza lembretes não concluídos; não remove eventos de lembretes concluídos. A desconexão revoga o token. Sem Google, notas e lembretes continuam disponíveis no Supabase.

### Publicação no Cloudflare

O arquivo `wrangler.jsonc` usa `keep_vars: true` para preservar variáveis de execução cadastradas no painel durante os deploys, inclusive quando o comando é `npx wrangler deploy`. Segredos do Worker são mantidos pelo Cloudflare. Variáveis `VITE_` precisam continuar na configuração de **compilação**, pois são incorporadas ao frontend no build; essa opção não substitui a configuração de build. Valores removidos em deploys anteriores precisam ser cadastrados novamente uma vez. Nunca adicione chaves secretas ao repositório.

1. Configure o Supabase e autorizações de produção primeiro.
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente do build, então `npm ci && npm run build`.
3. Autentique o Wrangler pela conta Cloudflare. Registre `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `APP_URL` com `npx wrangler secret put NOME`; registre os demais segredos somente para recursos que usar.
4. Execute `npm run deploy` para publicar Worker + Static Assets. Cron está em `wrangler.jsonc`. Não é necessária hospedagem própria.
5. Revise limites e custos de Supabase, Cloudflare, Pluggy e Google antes de produção. A integração bancária e a Agenda não foram validadas com credenciais reais neste ambiente.

PWA: manifesto + ícone SVG + service worker com fallback offline, sem cache de respostas financeiras ou tokens. Requer HTTPS para instalação e service worker. Inter é carregada pelo Google Fonts com fallback local para fontes do sistema.

## Validação e limites

`npm test` cobre cálculo monetário, lucro líquido, metas, dias e distribuição de pagamentos. `npm run test:db` valida a migração no PostgreSQL real, pagamentos parciais/idempotência/estorno, proteção de saldo, RLS e referências entre usuários, Cofre e importação. `npm run build` verifica TypeScript e gera frontend. O Worker pode ser empacotado com `npx wrangler deploy --dry-run --outdir /tmp/clareza-worker`.

`npm run test:e2e` usa Chromium (`CHROMIUM_PATH` ou `/usr/bin/chromium`) e dados de teste interceptados para conferir a interface; não substitui autenticação real.

Consulte [checklist de produção](docs/production-checklist.md) para validações que exigem serviços reais. Não considere integrações conectadas somente por ter fornecido suas variáveis.
