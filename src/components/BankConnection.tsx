import { bankErrorMessage } from "../../shared/bank-errors";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Building2, Link2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { api } from "../api";
const BankWidget = lazy(() => import("./BankWidget"));
type Connection = {
  id: string;
  name: string;
  status?: string;
  last_sync?: string;
  provider_updated_at?: string;
  provider_status?: string;
  consent_expires_at?: string;
  error?: string;
};
type Status = {
  configured: boolean;
  allowed: boolean;
  missing?: string[];
  migrationRequired?: boolean;
  message: string;
};
type ConnectSession = {
  connectToken: string;
  connectorIds: number[];
  updateItem?: string;
};
function date(value?: string) {
  return value
    ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Ainda não disponível";
}
export function BankConnection({
  connections,
  onChanged,
}: {
  connections: Connection[];
  onChanged: () => Promise<void>;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [token, setToken] = useState<ConnectSession | null>(null);
  const lock = useRef(false);
  async function refresh() {
    setError("");
    try {
      setStatus(await api("bank/status"));
    } catch {
      setStatus(null);
      setError(
        "Não foi possível verificar a integração bancária. Tente novamente.",
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
      await onChanged();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function connect(connectionId?: string) {
    void run(async () => {
      const session = await api(
        "bank/connect-token",
        "POST",
        connectionId ? { connectionId } : {},
      );
      setToken(session);
    });
  }
  function sync(connectionId?: string) {
    void run(async () => {
      const r = await api(
        "bank/sync",
        "POST",
        connectionId ? { connectionId } : {},
      );
      setNotice(r.message);
      await onChanged();
    });
  }
  function disconnect(c: Connection) {
    if (
      !confirm(
        `Revogar a conexão com ${c.name}? O histórico será preservado; esse saldo deixará de entrar nos totais atuais.`,
      )
    )
      return;
    void run(async () => {
      const r = await api("bank/disconnect", "POST", { connectionId: c.id });
      setNotice(r.message);
      await onChanged();
    });
  }
  const active = connections.filter((c) => (c.status || "active") === "active");
  return (
    <section
      className="panel bank-connect"
      aria-labelledby="bank-connect-title"
    >
      <div className="section-title">
        <div>
          <h2 id="bank-connect-title">
            <Building2 size={18} />
            Conectar meu banco
          </h2>
          <p className="muted">
            Open Finance • somente leitura • autorização no seu banco
          </p>
        </div>
        <span className="badge">
          <ShieldCheck size={12} />
          Pluggy
        </span>
      </div>
      <p>
        Conecte uma conta de pessoa física para consultar saldos em reais.
        Escolha Santander ou outra instituição disponível no provedor e autorize
        o compartilhamento no ambiente do banco.
      </p>
      <div className="info">
        O Clareza não recebe sua senha bancária, não faz pagamentos nem
        transferências. A disponibilidade do banco e os custos dependem do seu
        plano Pluggy. Cartões e limites de crédito não entram no saldo.
      </div>
      {!status && (
        <p className="muted">Verificando disponibilidade da integração…</p>
      )}
      {status && !status.configured && (
        <div className="warning">
          <b>Conexão bancária ainda não ativada</b>
          <p>{status.message} O cadastro manual continua funcionando.</p>
          <details>
            <summary>Como ativar a conexão</summary>
            <p>
              No Supabase, aplique a migração 006_bank_connect.sql. No
              Cloudflare, configure as credenciais de servidor conforme o guia
              do projeto.
            </p>
            {!!status.missing?.length && (
              <p>Configuração pendente: {status.missing.join(", ")}.</p>
            )}
            <a
              href="https://github.com/joaolucasqueiros/DIVIDA/blob/main/docs/bank-connection.md"
              target="_blank"
              rel="noreferrer"
            >
              Abrir guia passo a passo
            </a>
          </details>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <div className="toolbar">
        <button
          className="primary"
          disabled={busy || !!token || !status?.configured}
          onClick={() => connect()}
        >
          <Link2 size={16} />
          {busy ? "Aguarde…" : "Conectar banco"}
        </button>
        <button
          className="small"
          disabled={busy || !status?.configured || !active.length}
          onClick={() => sync()}
        >
          <RefreshCw size={15} />
          Consultar saldos
        </button>
        <button className="small" disabled={busy} onClick={refresh}>
          Verificar configuração
        </button>
      </div>
      <div className="bank-connections">
        {connections.map((c) => (
          <article className="bank-connection" key={c.id}>
            <div className="bank-connection-heading">
              <b>{c.name}</b>
              <span className="badge">
                {c.status === "disconnected"
                  ? "Desconectada"
                  : c.status === "disconnecting"
                    ? "Revogação pendente"
                    : "Autorização cadastrada"}
              </span>
            </div>
            <dl>
              <div>
                <dt>Última consulta no Clareza</dt>
                <dd>{date(c.last_sync)}</dd>
              </div>
              <div>
                <dt>Atualização no provedor</dt>
                <dd>{date(c.provider_updated_at)}</dd>
              </div>
              <div>
                <dt>Estado no banco</dt>
                <dd>{c.provider_status || "Aguardando retorno"}</dd>
              </div>
              {c.consent_expires_at && (
                <div>
                  <dt>Validade do consentimento</dt>
                  <dd>{date(c.consent_expires_at)}</dd>
                </div>
              )}
            </dl>
            {c.error && <p className="warning">{c.error}</p>}
            {c.status !== "disconnected" && (
              <div className="toolbar">
                {c.status !== "disconnecting" && (
                  <>
                    <button
                      className="small"
                      disabled={busy || !status?.configured}
                      onClick={() => sync(c.id)}
                    >
                      Consultar saldos
                    </button>
                    <button
                      className="small"
                      disabled={busy || !status?.configured}
                      onClick={() => connect(c.id)}
                    >
                      Renovar autorização
                    </button>
                  </>
                )}
                <button
                  className="small danger"
                  disabled={busy || !status?.configured}
                  onClick={() => disconnect(c)}
                >
                  <Unplug size={14} />
                  {c.status === "disconnecting"
                    ? "Tentar revogar novamente"
                    : "Desconectar"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!connections.length && (
        <p className="muted">
          Nenhuma conexão autorizada ainda. Você pode cadastrar uma conta e
          informar o saldo manualmente.
        </p>
      )}
      {token && (
        <Suspense fallback={<p role="status">Abrindo autorização segura…</p>}>
          <BankWidget
            session={token}
            onSuccess={(itemId) => {
              setToken(null);
              void run(async () => {
                const r = await api("bank/connections", "POST", {
                  itemId,
                });
                setNotice(r.message);
                await onChanged();
              });
            }}
            onClose={() => setToken(null)}
            onError={(error) => {
              setToken(null);
              setError(bankErrorMessage(error));
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
