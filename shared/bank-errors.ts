const messages: Record<string, string> = {
  INVALID_CREDENTIALS:
    "O banco recusou os dados de identificação. Confira os dados no ambiente do banco antes de tentar novamente.",
  INVALID_CREDENTIALS_MFA:
    "O banco recusou a confirmação de segurança. Faça uma nova autorização no aplicativo do banco.",
  ALREADY_LOGGED_IN:
    "O banco informou que já existe uma sessão aberta. Finalize a tentativa anterior antes de iniciar outra.",
  SITE_NOT_AVAILABLE:
    "O serviço do banco está temporariamente indisponível. Aguarde e tente mais tarde.",
  CONNECTION_ERROR:
    "O provedor não conseguiu comunicar-se com o banco. Aguarde antes de tentar novamente.",
  ACCOUNT_LOCKED:
    "O banco informou que o acesso está bloqueado. Verifique a situação no aplicativo oficial do banco.",
  ACCOUNT_CREDENTIALS_RESET:
    "O banco solicitou a atualização dos dados de acesso. Resolva essa pendência no aplicativo oficial do banco.",
  ACCOUNT_NEEDS_ACTION:
    "O banco exige uma ação do titular. Abra o aplicativo oficial do banco e confira as pendências.",
  USER_AUTHORIZATION_PENDING:
    "A autorização ainda está pendente. Confira a solicitação no aplicativo oficial do banco.",
  USER_AUTHORIZATION_NOT_GRANTED:
    "O banco não confirmou o consentimento. Verifique se você concluiu a autorização no aplicativo oficial do banco.",
  USER_NOT_SUPPORTED:
    "O provedor informou que esse usuário ou tipo de conta não é atendido por este conector. Confira a disponibilidade no Pluggy.",
  USER_INPUT_TIMEOUT:
    "O prazo para concluir a autorização terminou. Inicie uma nova conexão e conclua as etapas no banco.",
  UNEXPECTED_ERROR:
    "O provedor informou uma falha inesperada. Consulte o detalhe da tentativa no painel Pluggy.",
  WIDGET_LOAD_FAILED:
    "Não foi possível carregar a janela de autorização. Verifique a conexão e se o navegador bloqueou a janela do provedor.",
};
/** Never display free-text provider messages: they may contain personal data or tokens. */
export function bankErrorMessage(error: unknown): string {
  const e =
    error && typeof error === "object" ? (error as Record<string, any>) : {};
  const item = e.data?.item;
  const candidates = [item?.error?.code, item?.executionStatus, e.code];
  const code = candidates.find(
    (value) => typeof value === "string" && Object.hasOwn(messages, value),
  );
  if (code) return `${messages[code]} Código: ${code}.`;
  const state = item?.status;
  if (state === "WAITING_USER_ACTION" || state === "WAITING_USER_INPUT")
    return "O banco está aguardando sua confirmação. Confira a solicitação no aplicativo oficial do banco e conclua a autorização.";
  return "O Pluggy encerrou a tentativa sem fornecer um código de erro reconhecido ao Clareza. Abra o painel Pluggy e consulte a tentativa mais recente em Itens/Conexões para identificar o motivo. O aviso de aplicação demo, sozinho, não confirma a causa.";
}
