# Conectar um banco por Open Finance

O Clareza usa o widget oficial Pluggy Connect. A integração consulta saldos de contas de pessoa física, no Brasil, em reais. Apenas conectores marcados pelo provedor como Open Finance e fora do sandbox são apresentados. Santander pode ser escolhido se estiver disponível no seu plano/conector. A contratação e eventuais custos são do Pluggy; não há garantia de acesso gratuito.

## 1. Atualize o banco de dados

No Supabase, abra **SQL Editor → New query**. Copie o conteúdo de [006_bank_connect.sql](../supabase/migrations/006_bank_connect.sql) e execute uma vez. Quem já aplicou as migrações 001 a 005 não deve repeti-las.

Esta migração adiciona estado da conexão, validade do consentimento, associação entre contas e conexão e operações atômicas de snapshot/desconexão. Registros existentes são preservados.

## 2. Cadastre as credenciais de servidor no Cloudflare

No painel Pluggy, crie um aplicativo e obtenha Client ID e Client Secret com acesso a Open Finance e ao produto de contas/saldos. Verifique a documentação e o plano do provedor antes de conectar uma conta real.

No Cloudflare, abra **Workers & Pages → seu Worker → Configurações → Variáveis e segredos em tempo de execução → Produção**.

| Nome exato                  | De onde copiar                                                                                            | Tipo no Cloudflare |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------ |
| `PLUGGY_CLIENT_ID`          | Aplicativo no painel Pluggy                                                                               | Secret             |
| `PLUGGY_CLIENT_SECRET`      | Mesmo aplicativo Pluggy                                                                                   | Secret             |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys: chave secreta de servidor, `sb_secret_…` ou a chave legada `service_role` | Secret             |
| `OWNER_USER_ID`             | Supabase → Authentication → Users: UID/UUID do seu usuário do Clareza                                     | Text               |

Não use o e-mail em `OWNER_USER_ID`. Não use a chave pública do Supabase no campo da chave de servidor. Não cole valores em arquivos versionados, capturas de tela ou no chat. Estas credenciais não têm prefixo `VITE_` e nunca devem ser adicionadas à compilação do frontend.

Mantenha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `APP_URL` já configurados. `APP_URL` é a origem pública do Clareza, sem barra final, e não o painel Supabase. O `keep_vars: true` continua preservando as variáveis do painel nos deploys. Se usar `wrangler secret put`, informe cada valor diretamente na entrada segura do CLI.

`PLUGGY_ITEM_IDS` não é mais necessário: o servidor registra os itens autorizados no banco e usa somente conexões ativas. As conexões já persistidas continuam consultáveis; conectores antigos que não sejam Open Finance precisam ser conectados novamente pelo fluxo novo.

## 3. Autorize pelo aplicativo

1. Entre no Clareza e abra **Contas e saldos**.
2. Clique **Verificar configuração**. Se faltar a migração ou uma variável, a tela informa a pendência sem revelar valores.
3. Clique **Conectar banco**.
4. No widget oficial Pluggy, escolha a instituição (por exemplo, Santander PF) e siga a autorização no ambiente do banco.
5. Revise o consentimento solicitado antes de aprovar. O Clareza solicita o produto de contas/saldos; não solicita pagamentos ou transferências.
6. Ao retornar, o backend valida no Pluggy se o item pertence ao usuário autenticado (`clientUserId`) antes de registrá-lo. O ID vindo do navegador sozinho não autoriza acesso.
7. Se o banco ainda estiver processando os dados, a conexão permanece cadastrada. Use **Consultar saldos** novamente após a conclusão.

A senha bancária nunca passa pelo backend ou formulários do Clareza. Não há campo de senha bancária no aplicativo. O widget e a autorização bancária são fornecidos por terceiros.

## 4. Atualizações e histórico

- A consulta manual e o cron diário às **12:00 UTC / 09:00 em São Paulo** consultam os últimos dados disponíveis no Pluggy. A frequência de coleta real do banco depende do provedor, do conector e do plano; o aplicativo não promete uma nova extração a cada clique.
- A tela separa a última consulta no Clareza da data de atualização informada pelo provedor.
- Somente contas `BANK`, com moeda `BRL` e saldo numérico válido, entram nos totais. Cartões, limites de crédito, moedas estrangeiras e saldo ausente não são convertidos em dinheiro disponível.
- Cada consulta completa grava contas e histórico diário em uma transação no banco. Consultas repetidas atualizam o registro daquele dia, sem duplicá-lo.
- Erros, coleta em andamento e consentimento expirado preservam os últimos valores; a tela mostra o problema e a data do dado. Não são inventados saldos novos.
- Pagamentos manuais, dívidas e depósitos no Cofre não são conciliados ou debitados automaticamente. A integração não conclui pagamentos por inferência e não importa transações bancárias neste fluxo.

## 5. Renovar ou desconectar

**Renovar autorização** abre o widget para um item ativo que pertence ao proprietário. **Desconectar** retira imediatamente o saldo da conexão dos totais e solicita a exclusão do item no Pluggy. Isso interrompe novas consultas pelo Clareza. Confira também a gestão de consentimentos no seu banco se quiser revogar o compartilhamento diretamente na instituição.

Histórico de saldos, contas e auditoria permanecem no Supabase. Contas desconectadas são exibidas apenas como histórico. Se o provedor falhar durante a desconexão, a tela mostra **Revogação pendente**; o saldo continua excluído e o botão permite tentar a revogação de novo. O cron ignora itens pendentes ou desconectados. Uma consulta atrasada não pode reativar uma conta revogada.

## Segurança e escopo

O primeiro fluxo é restrito ao `OWNER_USER_ID`. Usuários adicionais continuam isolados por RLS e não podem conectar, renovar ou consultar as conexões do proprietário. Tokens do widget são temporários e ficam apenas em memória no navegador; Client Secret e chave de servidor Supabase ficam apenas no Worker. Até dez conexões ativas são permitidas. A remoção da conta deve ser precedida da desconexão de cada banco e da revogação Google.

## O que foi testado

Validação local: build TypeScript/Vite, 29 testes de regras/API e 10 testes de navegador passaram. Um teste abre o SDK oficial em um iframe com a página do provedor simulada; outro simula a conclusão do consentimento para validar o envio do item ao backend. Esses testes não representam uma autorização bancária real.

Foram adicionados testes com respostas simuladas do Pluggy para autorização por proprietário, vínculo do item, seleção de conectores, exclusão de cartões/moedas estrangeiras, token do widget, coleta pendente e repetição de desconexão. PostgreSQL real verifica snapshot atômico/idempotente, exclusão de saldos revogados, preservação de histórico, bloqueio de chamadas diretas às funções internas e impossibilidade de uma consulta atrasada reativar o saldo.

Uma conexão bancária real só estará validada após configurar as credenciais, autorizar uma instituição e comparar os valores retornados com o banco. Nenhuma conexão Santander/Pluggy real foi feita durante estes testes.
