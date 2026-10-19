import { useState } from "react";
import { money } from "../../shared/finance";

type Account = { source: string; balance: number };
/** Compare one explicitly selected balance source with unpaid debt, in cents. */
export function BalanceArc({
  accounts,
  debt,
  unavailable = false,
}: {
  accounts: Account[];
  debt: number;
  unavailable?: boolean;
}) {
  const [selected, setSelected] = useState("");
  const sources = ["pluggy", "manual"].filter((source) =>
    accounts.some((a) => a.source === source),
  );
  const source = sources.includes(selected) ? selected : sources[0] || "manual";
  const hasBalance = accounts.some((a) => a.source === source);
  const balance = accounts
    .filter((a) => a.source === source)
    .reduce((total, a) => total + a.balance, 0);
  const known = hasBalance && !unavailable;
  const coverage = known
    ? debt > 0
      ? (Math.max(0, balance) / debt) * 100
      : balance >= 0
        ? 100
        : 0
    : 0;
  const progress = Math.min(100, coverage);
  const difference = balance - debt;
  const label = unavailable
    ? "Dados indisponíveis"
    : !hasBalance
      ? "Informe seu saldo"
      : debt === 0
        ? balance < 0
          ? "Saldo negativo"
          : "Sem dívidas em aberto"
        : difference < 0
          ? "Falta para cobrir as dívidas"
          : "Saldo após cobrir as dívidas";
  const description = known
    ? `${coverage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de cobertura. Saldo ${money(balance)}; dívidas ${money(debt)}.`
    : "Cadastre um saldo atual para comparar com suas dívidas.";
  return (
    <section className="panel balance-panel" aria-labelledby="balance-title">
      <div className="section-title">
        <div>
          <h2 id="balance-title">Equilíbrio entre saldo e dívidas</h2>
          <p className="muted">
            Uma visão do seu saldo atual diante de tudo o que falta pagar.
          </p>
        </div>
        {sources.length > 1 && (
          <label className="balance-source">
            Saldo usado
            <select
              aria-label="Origem do saldo no círculo"
              value={source}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="pluggy">Bancário sincronizado</option>
              <option value="manual">Informado manualmente</option>
            </select>
          </label>
        )}
      </div>
      <div className="balance-layout">
        <div className="balance-gauge">
          <svg viewBox="0 0 320 320" role="img" aria-label={description}>
            <circle
              cx="160"
              cy="160"
              r="126"
              fill="none"
              stroke={known && debt > 0 ? "#e2c6a7" : "var(--border)"}
              strokeWidth="20"
              strokeLinecap="round"
            />
            <circle
              className="balance-arc"
              cx="160"
              cy="160"
              r="126"
              transform="rotate(-90 160 160)"
              pathLength="100"
              fill="none"
              stroke="var(--green)"
              strokeWidth="20"
              strokeLinecap={progress > 0 ? "round" : "butt"}
              strokeDasharray={`${progress} 100`}
            />
            <text
              x="160"
              y="158"
              textAnchor="middle"
              className="balance-percent"
            >
              {known ? `${Math.round(coverage)}%` : "—"}
            </text>
            <text
              x="160"
              y="184"
              textAnchor="middle"
              className="balance-caption"
            >
              {known ? "das dívidas cobertas" : "aguardando saldo"}
            </text>
          </svg>
        </div>
        <div className="balance-details">
          <div className="balance-values">
            <div>
              <span>
                <i className="balance-dot cash" />
                Saldo {source === "pluggy" ? "sincronizado" : "manual"}
              </span>
              <strong>{known ? money(balance) : "Não informado"}</strong>
            </div>
            <div>
              <span>
                <i className="balance-dot debt" />
                Dívidas em aberto
              </span>
              <strong>{unavailable ? "Indisponível" : money(debt)}</strong>
            </div>
          </div>
          <div
            className={`balance-result ${known && difference < 0 ? "shortfall" : ""}`}
          >
            <span>{label}</span>
            <strong>{known ? money(Math.abs(difference)) : "—"}</strong>
          </div>
          <p className="muted">
            {known && debt > 0
              ? `${money(Math.min(Math.max(0, balance), debt))} de ${money(debt)} cobertos pelo saldo selecionado. `
              : ""}
            Comparação atual, independente do período selecionado. O Cofre já
            faz parte das contas; projeções e receitas futuras não entram aqui.
            Saldos manuais e sincronizados são comparados separadamente.
          </p>
          {known && debt === 0 && (
            <p className="muted">
              Sem dívidas em aberto: o círculo fica completo quando há saldo
              informado não negativo.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
