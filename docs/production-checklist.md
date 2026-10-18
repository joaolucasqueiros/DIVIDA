# Checklist de produção

- [ ] Aplicar a migração em projeto Supabase de teste e confirmar bucket privado.
- [ ] Entrar por magic link e OTP; verificar redirect, persistência de sessão, logout e sessão expirada.
- [ ] Usar dois usuários reais: não enxergar ou alterar registros/documentos do outro, inclusive por UUID conhecido.
- [ ] Cadastrar dívida de R$ 1.000; pagar R$ 250; repetir com a mesma chave; conferir saldo R$ 750. Pagar restante; conferir quitação; estornar e conferir histórico.
- [ ] Fazer duas tentativas simultâneas de pagamento/retirada; assegurar bloqueio de saldo negativo ou pagamento excessivo.
- [ ] Confirmar que pagamentos e depósitos no Cofre não alteram saldo bancário já informado/sincronizado.
- [ ] Importar CSV/XLSX/JSON, ajustar mapeamento e repetir; conferir duplicidades e rollback de lote inválido.
- [ ] Cadastrar ganhos com custos e conferir lucro/hora e médias de 7/30 dias. Evitar lançamento duplicado em transações.
- [ ] Editar data, despesas e meta da mudança; conferir projeção recalculada, reserva real e premissas separadas.
- [ ] Conferir limites de orçamento, metas alcançadas e registros preservados após o prazo.
- [ ] Configurar e autorizar Pluggy; comparar BRL/tipo de conta com o banco, testar falha, cron e desconexão.
- [ ] Configurar OAuth Google; testar state inválido/expirado, sincronização repetida sem duplicatas e revogação.
- [ ] Revisar UI móvel, teclado, zoom 200%, contraste, redução de movimento e tema escuro.
- [ ] Instalar PWA em HTTPS; testar reconexão sem cache financeiro offline.
- [ ] Conferir exportações CSV, JSON e PDF com registros reais e volumes paginados.
- [ ] Testar exclusão de conta incluindo Storage e vínculos de integrações; revogar as integrações antes da exclusão.
- [ ] Definir backups, retenção de auditoria, monitoramento, SMTP, rate limits e políticas de privacidade antes de abrir a terceiros.

## Limites e validação externa

Login por e-mail, sincronização entre dispositivos, Storage privado, Pluggy e Google Calendar dependem de projeto/credenciais e devem ser testados com serviços reais. Os testes de interface usam dados isolados e interceptam a API; os testes financeiros e de RLS usam PostgreSQL local com emulação dos contratos Supabase.

Recorrências são projeções: cada ocorrência é confirmada manualmente e a confirmação repetida é idempotente. O simulador de quitação usa taxas mensais informadas, horizonte de até 600 meses e nenhuma garantia de renda. Renegociações são edições auditadas da dívida, não uma assinatura de novo contrato. A conciliação entre fontes de dados requer revisão pelo usuário: o sistema não presume que duas operações parecidas são o mesmo pagamento.

Google Calendar tem sincronização unidirecional explícita; eventos de lembretes concluídos não são apagados automaticamente. Alertas são calculados ao atualizar/abrir o aplicativo, com preferências e marcos persistidos; não há push em segundo plano. Anexos não passam por varredura antivírus. Antes de excluir a conta, revogue as integrações externas.
