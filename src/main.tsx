import { BalanceArc } from "./components/BalanceArc";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Wallet,
  ListChecks,
  ArrowLeftRight,
  Landmark,
  Target,
  NotebookPen,
  ChartNoAxesCombined,
  FileDown,
  Settings,
  Sprout,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Sun,
  Moon,
  Upload,
  Download,
  Check,
  RotateCcw,
  Pencil,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { Session } from "@supabase/supabase-js";
import { api, allRows, supabase } from "./api";
import { forms, labels } from "./forms";
import {
  cents,
  daysBetween,
  earningsAverage,
  dailyAllowance,
  money,
  netEarnings,
  payoff,
  payoffSchedule,
  plannedOccurrences,
  savings,
  sum,
  today,
} from "../shared/finance";
import Papa from "papaparse";

import "./style.css";
type Row = Record<string, any>;
const navigation = [
  ["overview", "Visão geral", LayoutDashboard],
  ["debts", "Minhas dívidas", Wallet],
  ["payments", "Lista de pagamentos", ListChecks],
  ["transactions", "Receitas e despesas", ArrowLeftRight],
  ["accounts", "Contas e saldos", Landmark],
  ["savings", "Modo Economia", Sprout],
  ["planning", "Planejamento", Target],
  ["notes", "Anotações e agenda", NotebookPen],
  ["history", "Histórico e evolução", ChartNoAxesCombined],
  ["reports", "Relatórios", FileDown],
  ["settings", "Configurações", Settings],
] as const;
const tables = [
  "debts",
  "debt_installments",
  "debt_payments",
  "payment_plans",
  "transactions",
  "bank_accounts",
  "bank_balance_history",
  "financial_goals",
  "budgets",
  "notes",
  "reminders",
  "savings_goals",
  "savings_contributions",
  "savings_withdrawals",
  "savings_budgets",
  "daily_work_earnings",
  "moving_expenses",
  "savings_scenarios",
  "bank_connections",
  "audit_logs",
  "user_settings",
  "profiles",
  "savings_alerts",
];
function App() {
  const actionLock = useRef(false);
  const [collapsed, setCollapsed] = useState(false),
    [desiredSaving, setDesiredSaving] = useState("100");
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(false),
    [email, setEmail] = useState(""),
    [otp, setOtp] = useState(""),
    [sent, setSent] = useState(false);
  const [page, setPage] = useState("overview"),
    [data, setData] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(
      localStorage.getItem("clareza-theme") === "dark",
    );
  const [modal, setModal] = useState<{
      table: string;
      row?: Row;
      extra?: Row;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [period, setPeriod] = useState("30"),
    [start, setStart] = useState(today().slice(0, 7) + "-01"),
    [end, setEnd] = useState(today()),
    [search, setSearch] = useState(""),
    [selectedGoal, setSelectedGoal] = useState("");
  const [calendarDate, setCalendarDate] = useState(today()),
    [calendarView, setCalendarView] = useState("month"),
    [historyAccount, setHistoryAccount] = useState("");
  const [method, setMethod] = useState("snowball"),
    [payBudget, setPayBudget] = useState("500"),
    [decision, setDecision] = useState("expense"),
    [decisionAmount, setDecisionAmount] = useState("150");
  const [importKind, setImportKind] = useState("debts");
  const [importRows, setImportRows] = useState<Row[]>([]),
    [columns, setColumns] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [filename, setFilename] = useState(""),
    [importOpen, setImportOpen] = useState(false);
  const get = (t: string) => data[t] || [];
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then((r) => {
      setSession(r.data.session);
      setAuthReady(true);
    });
    const { data: s } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
      if (!s) setData({});
    });
    return () => s.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("clareza-theme", String(dark ? "dark" : "light"));
  }, [dark]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      await api("alerts/refresh", "POST");
      const results = await Promise.all(
        tables.map(async (t) => [t, await allRows(t)] as const),
      );
      const loaded = Object.fromEntries(results);
      setData(loaded);
      if (loaded.user_settings?.[0])
        setDark(loaded.user_settings[0].theme === "dark");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (session) void load();
  }, [session?.user.id]);
  const message = (e: unknown) =>
    e instanceof Error ? e.message : "Não foi possível concluir.";
  async function action(
    fn: () => Promise<unknown>,
    success = "Salvo com sucesso.",
  ) {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
      await load();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function toggleTheme() {
    const value = !dark;
    setDark(value);
    const settings = get("user_settings")[0];
    if (session)
      await action(() =>
        api(
          `data/user_settings${settings ? `/${settings.id}` : ""}`,
          settings ? "PATCH" : "POST",
          {
            name: "Preferências",
            theme: value ? "dark" : "light",
            timezone: "America/Sao_Paulo",
            alerts_enabled: settings?.alerts_enabled ?? true,
          },
        ),
      );
  }
  const rangeStart =
      period === "custom"
        ? start
        : new Date(
            Date.parse(today() + "T12:00:00Z") -
              (Number(period) - 1) * 86400000,
          )
            .toISOString()
            .slice(0, 10),
    rangeEnd = period === "custom" ? end : today();
  const inRange = (r: Row) => {
    const date = r.date || r.due_date || r.created_at?.slice(0, 10);
    return date >= rangeStart && date <= rangeEnd;
  };
  const debts = get("debts").map<Row>((d) => ({
      ...d,
      original_amount: d.amount,
      amount: d.amount + (d.fees || 0),
    })),
    payments = get("debt_payments"),
    tx = get("transactions"),
    work = get("daily_work_earnings"),
    accounts = get("bank_accounts");
  const actual = tx.filter((r) => r.status === "realized"),
    periodTx = actual.filter(inRange),
    periodWork = work.filter(inRange),
    periodPay = payments.filter(inRange);
  const income =
      sum(periodTx.filter((r) => r.kind === "income")) +
      periodWork.reduce((s, r) => s + netEarnings(r as any).net, 0),
    expenses = sum(periodTx.filter((r) => r.kind === "expense")),
    paid = sum(periodPay);
  const totalDebt = debts.reduce((s, d) => s + d.amount - d.paid, 0),
    overdue = debts.filter(
      (d) =>
        d.due_date < today() && d.paid < d.amount && d.status !== "archived",
    );
  const goal =
    get("savings_goals").find((g) => g.id === selectedGoal) ||
    get("savings_goals")[0];
  const contributions = get("savings_contributions").filter(
      (r) => r.goal_id === goal?.id,
    ),
    withdrawals = get("savings_withdrawals").filter(
      (r) => r.goal_id === goal?.id,
    ),
    moving = get("moving_expenses").filter((r) => r.goal_id === goal?.id);
  const reserved =
    (goal?.initial_reserved || 0) + sum(contributions) - sum(withdrawals);
  const plannedExpenses = plannedOccurrences(
    tx,
    today(),
    goal?.due_date || today(),
  ).filter((t) => t.kind === "expense");
  // Debt principal is included once, independent of payment plans; plans only schedule that principal.
  const obligations =
    debts
      .filter((d) => d.due_date <= goal?.due_date && d.status !== "archived")
      .reduce((s, d) => s + d.amount - d.paid, 0) + sum(plannedExpenses);
  const recentWork = work.filter(
    (r) =>
      daysBetween(r.date, today()) >= 0 && daysBetween(r.date, today()) < 30,
  );
  const meanNet = recentWork.length
    ? earningsAverage(recentWork).average
    : goal?.daily_income || 0;
  const movingTotal = moving
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + (r.actual ?? r.amount), 0);
  const calc = goal
    ? savings({
        date: goal.due_date,
        target: goal.amount,
        reserved,
        dailyNet: meanNet,
        workDays: goal.work_days,
        obligations,
        moving: movingTotal,
        contingency: Number(goal.contingency),
        dailyVariable: goal.daily_variable,
      })
    : null;
  function open(table: string, row?: Row, extra?: Row) {
    setModal({ table, row, extra });
    setNotice("");
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const form = new FormData(event.currentTarget);
    const body: Row = { ...modal.extra };
    try {
      for (const f of forms[modal.table]) {
        const v = String(form.get(f.key) || "");
        if (!v && !f.required) {
          body[f.key] =
            f.key === "actual" ||
            f.key === "contract_date" ||
            f.type === "debt" ||
            f.type === "account"
              ? null
              : undefined;
          continue;
        }
        body[f.key] =
          f.type === "money" ? cents(v) : f.type === "number" ? Number(v) : v;
      }
      if (modal.row?.done !== undefined) body.done = modal.row.done;
      const ok = await action(() =>
        api(
          `data/${modal.table}${modal.row ? `/${modal.row.id}` : ""}`,
          modal.row ? "PATCH" : "POST",
          body,
        ),
      );
      if (ok) setModal(null);
    } catch (e) {
      setError(message(e));
    }
  }
  async function pay(debt: Row, plan?: Row) {
    const v = prompt(
      "Valor do pagamento (R$)",
      ((plan?.amount || debt.amount - debt.paid) / 100)
        .toFixed(2)
        .replace(".", ","),
    );
    if (!v) return;
    try {
      const amount = cents(v);
      if (amount <= 0) throw Error("Informe um valor positivo.");
      const intent = `clareza-payment:${session!.user.id}:${debt.id}:${plan?.id || ""}:${today()}:${amount}`;
      const key = localStorage.getItem(intent) || crypto.randomUUID();
      localStorage.setItem(intent, key);
      const saved = await action(
        () =>
          api("payment", "POST", {
            debt_id: debt.id,
            amount,
            date: today(),
            key,
            plan: plan?.id || null,
          }),
        "Pagamento registrado. Saldo bancário preservado.",
      );
      if (saved) localStorage.removeItem(intent);
    } catch (e) {
      setError(message(e));
    }
  }
  async function reverse(p: Row) {
    if (!confirm(`Estornar ${money(p.amount)}? O histórico será preservado.`))
      return;
    await action(
      () =>
        api("payment", "POST", {
          debt_id: p.debt_id,
          amount: -p.amount,
          date: today(),
          key: crypto.randomUUID(),
          reversal: p.id,
        }),
      "Estorno registrado.",
    );
  }
  function exportCSV(rows: Row[], name: string) {
    download(
      Papa.unparse(rows, { escapeFormulae: true }),
      "text/csv;charset=utf-8",
      `${name}.csv`,
    );
  }
  function download(content: string, type: string, name: string) {
    const u = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  async function readFile(file: File, kind = "debts") {
    try {
      if (file.size > 2_000_000) throw Error("Use arquivos com até 2 MB.");
      let rows: Row[] = [];
      if (file.name.endsWith(".json")) {
        rows = JSON.parse(await file.text());
      } else if (file.name.endsWith(".xlsx")) {
        const { default: readXlsxFile } = await import("read-excel-file");
        const raw = await readXlsxFile(file);
        const head = raw.shift()?.map(String) || [];
        rows = raw.map((r) =>
          Object.fromEntries(
            head.map((h, i) => [
              h,
              r[i] instanceof Date
                ? (r[i] as Date).toISOString().slice(0, 10)
                : r[i],
            ]),
          ),
        );
      } else {
        const parsed = Papa.parse<Row>(await file.text(), {
          header: true,
          skipEmptyLines: true,
        });
        if (parsed.errors.length) throw Error(parsed.errors[0].message);
        rows = parsed.data;
      }
      if (
        !Array.isArray(rows) ||
        !rows.length ||
        rows.length > 1000 ||
        rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))
      )
        throw Error("Forneça entre 1 e 1.000 linhas válidas.");
      const cols = Object.keys(rows[0]);
      setImportKind(kind);
      setColumns(cols);
      setImportRows(rows);
      setFilename(file.name);
      setMapping(
        Object.fromEntries(
          (kind === "debts"
            ? [
                "name",
                "creditor",
                "amount",
                "due_date",
                "category",
                "installments",
              ]
            : ["name", "amount", "date", "kind", "category"]
          ).map((k) => [k, cols.includes(k) ? k : ""]),
        ),
      );
      setImportOpen(true);
    } catch (e) {
      setError(message(e));
    }
  }
  function mappedRows() {
    return importRows.map((r, i) => {
      const get = (k: string) => r[mapping[k]];
      const amount = cents(String(get("amount") ?? ""));
      const due = String(get("due_date") || "");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        !get("name") ||
        !get("creditor") ||
        amount <= 0
      )
        throw Error(
          `Linha ${i + 1}: confira nome, credor, valor positivo e data AAAA-MM-DD.`,
        );
      return {
        name: String(get("name")),
        creditor: String(get("creditor")),
        amount,
        due_date: due,
        category: String(get("category") || "Outras"),
        installments: Number(get("installments") || 1),
      };
    });
  }
  async function doImport() {
    try {
      const rows =
        importKind === "debts"
          ? mappedRows()
          : importRows.map((r, i) => {
              const val = (k: string) => r[mapping[k]];
              const kind = String(val("kind")).toLowerCase();
              if (!["income", "expense", "receita", "despesa"].includes(kind))
                throw Error(
                  `Linha ${i + 1}: tipo deve ser income/receita ou expense/despesa.`,
                );
              return {
                name: String(val("name") || ""),
                amount: cents(String(val("amount") || "")),
                date: String(val("date") || ""),
                kind: ["income", "receita"].includes(kind)
                  ? "income"
                  : "expense",
                category: String(val("category") || "Outras"),
                status: "realized",
                classification: "essential",
              };
            });
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(rows)),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      await action(async () => {
        const result = await api(
          importKind === "debts" ? "import" : "import/statement",
          "POST",
          importKind === "debts"
            ? { name: filename, fingerprint: hash, rows }
            : { rows },
        );
        setImportOpen(false);
        alert(
          `${result.imported} registros importados. Duplicidades foram ignoradas.`,
        );
      });
    } catch (e) {
      setError(message(e));
    }
  }
  function Stat({
    title,
    value,
    foot,
    tone = "",
  }: {
    title: string;
    value: string;
    foot?: string;
    tone?: string;
  }) {
    return (
      <article className={`stat ${tone}`}>
        <span>{title}</span>
        <strong>{value}</strong>
        {foot && <small>{foot}</small>}
      </article>
    );
  }
  function Empty({
    text = "Nenhum registro por aqui ainda.",
    table,
  }: {
    text?: string;
    table?: string;
  }) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <Sprout size={25} />
        </div>
        <h3>{text}</h3>
        <p>
          Comece com seus dados reais. Cada registro deixa seu planejamento mais
          claro.
        </p>
        {table && (
          <button className="primary" onClick={() => open(table)}>
            <Plus size={16} />
            Adicionar primeiro registro
          </button>
        )}
      </div>
    );
  }
  function Section({
    title,
    children,
    action: act,
  }: {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
  }) {
    return (
      <section className="panel">
        <div className="section-title">
          <h2>{title}</h2>
          {act}
        </div>
        {children}
      </section>
    );
  }
  function Rows({
    table,
    rows = get(table),
    title,
  }: {
    table: string;
    rows?: Row[];
    title: string;
  }) {
    const [limit, setLimit] = useState(20);
    const filtered = rows.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <Section
        title={title}
        action={
          forms[table] && (
            <button
              className="small"
              onClick={() =>
                open(
                  table,
                  undefined,
                  table === "financial_goals" && page === "savings"
                    ? { savings_goal_id: goal?.id }
                    : table.startsWith("savings_") ||
                        table === "moving_expenses"
                      ? { goal_id: goal?.id }
                      : undefined,
                )
              }
              disabled={
                ((table.startsWith("savings_") && table !== "savings_goals") ||
                  table === "moving_expenses") &&
                !goal
              }
            >
              <Plus size={15} />
              Adicionar
            </button>
          )
        }
      >
        {!filtered.length ? (
          <Empty />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Data / situação</th>
                    <th>Valor</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>
                          {r.name ||
                            r.purpose ||
                            r.reason ||
                            r.notes ||
                            debts.find((d) => d.id === r.debt_id)?.name ||
                            r.table_name ||
                            "Registro"}
                        </b>
                        <small>
                          {r.creditor ||
                            r.category ||
                            r.description ||
                            r.operation ||
                            r.institution ||
                            ""}
                        </small>
                        {table === "audit_logs" && (
                          <details>
                            <summary>Ver alterações</summary>
                            <pre>
                              {JSON.stringify(
                                { antes: r.before_data, depois: r.after_data },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td>
                        <span>
                          {r.date || r.due_date || r.created_at?.slice(0, 10)}
                        </span>
                        <small>
                          {(table === "debts"
                            ? r.paid >= r.amount
                              ? "Quitada"
                              : r.status === "archived"
                                ? "Arquivada"
                                : r.status === "negotiating"
                                  ? "Em negociação"
                                  : r.due_date < today()
                                    ? "Vencida"
                                    : daysBetween(today(), r.due_date) <= 3
                                      ? "Próxima do vencimento"
                                      : labels[r.status]
                            : labels[r.classification]) ||
                            labels[r.status] ||
                            r.source ||
                            ""}
                        </small>
                      </td>
                      <td className={r.kind === "income" ? "positive" : ""}>
                        {money(r.amount ?? r.balance ?? r.gross ?? 0)}
                        {r.gross !== undefined && (
                          <small>
                            Líquido {money(netEarnings(r as any).net)}
                          </small>
                        )}
                        {table === "debts" && (
                          <small>
                            Original {money(r.original_amount ?? r.amount)} •
                            encargos {money(r.fees || 0)} • restante{" "}
                            {money(r.amount - r.paid)}
                          </small>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {forms[table] &&
                            ![
                              "savings_contributions",
                              "savings_withdrawals",
                            ].includes(table) &&
                            r.source !== "pluggy" && (
                              <button
                                title="Editar"
                                className="icon"
                                onClick={() =>
                                  open(
                                    table,
                                    r,
                                    r.goal_id
                                      ? { goal_id: r.goal_id }
                                      : undefined,
                                  )
                                }
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          {table === "debts" && r.paid < r.amount && (
                            <button
                              className="small"
                              disabled={busy}
                              onClick={() => pay(r)}
                            >
                              Pagar
                            </button>
                          )}
                          {table === "payment_plans" &&
                            r.status === "pending" && (
                              <button
                                className="small"
                                onClick={() =>
                                  pay(
                                    debts.find((d) => d.id === r.debt_id)!,
                                    r,
                                  )
                                }
                              >
                                Registrar pagamento
                              </button>
                            )}
                          {table === "debt_payments" &&
                            r.amount > 0 &&
                            !payments.some((p) => p.reversal_of === r.id) && (
                              <button
                                title="Estornar"
                                className="icon"
                                disabled={busy}
                                onClick={() => reverse(r)}
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          {table === "reminders" && (
                            <button
                              className="icon"
                              title="Alternar conclusão"
                              onClick={() =>
                                action(() =>
                                  api(`data/reminders/${r.id}`, "PATCH", {
                                    ...Object.fromEntries(
                                      forms.reminders.map((f) => [
                                        f.key,
                                        r[f.key],
                                      ]),
                                    ),
                                    done: !r.done,
                                  }),
                                )
                              }
                            >
                              <Check size={16} />
                              {r.done ? "Concluído" : ""}
                            </button>
                          )}
                          {table === "debts" && (
                            <label className="icon" title="Anexar documento">
                              <Upload size={15} />
                              <input
                                type="file"
                                hidden
                                accept="application/pdf,image/png,image/jpeg"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file)
                                    void action(async () => {
                                      const path = `${session!.user.id}/${r.id}-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
                                      const result = await supabase!.storage
                                        .from("documents")
                                        .upload(path, file);
                                      if (result.error) throw result.error;
                                    }, "Documento anexado. Acesse em Configurações.");
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > limit && (
              <button className="small" onClick={() => setLimit(limit + 20)}>
                Carregar mais ({filtered.length - limit})
              </button>
            )}
          </>
        )}
      </Section>
    );
  }
  const chartDays = Array.from(
    new Set([
      ...periodTx.map((r) => r.date),
      ...periodWork.map((r) => r.date),
      ...periodPay.map((r) => r.date),
    ]),
  ).sort();
  const flowChart = chartDays.map((date) => ({
    date,
    Receitas:
      (sum(periodTx.filter((t) => t.date === date && t.kind === "income")) +
        periodWork
          .filter((t) => t.date === date)
          .reduce((s, r) => s + netEarnings(r as any).net, 0)) /
      100,
    Despesas:
      (sum(periodTx.filter((t) => t.date === date && t.kind === "expense")) +
        sum(periodPay.filter((t) => t.date === date))) /
      100,
  }));
  function Chart({
    rows,
    keys = ["Reserva"],
    area = true,
  }: {
    rows: Row[];
    keys?: string[];
    area?: boolean;
  }) {
    return rows.length ? (
      <div className="chart">
        <ResponsiveContainer width="100%" height={250}>
          {area ? (
            <AreaChart data={rows}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#25866c" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#25866c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(x) => String(x).slice(5).replace("-", "/")}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(v) => money(Number(v) * 100)} />
              {keys.map((k, i) => (
                <Area
                  key={k}
                  dataKey={k}
                  stroke={i ? "#e3a258" : "#25866c"}
                  fill="url(#fill)"
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={rows}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v) => money(Number(v) * 100)} />
              <Legend />
              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  fill={i ? "#e3a258" : "#25866c"}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    ) : (
      <Empty text="Seu gráfico começa com o primeiro registro." />
    );
  }
  if (!authReady)
    return (
      <div className="auth">
        <p>Carregando sessão…</p>
      </div>
    );
  if (!session)
    return (
      <div className="auth">
        <div className="auth-art">
          <div className="logo">
            <span>c</span>clareza<span className="dot">.</span>
          </div>
          <h1>
            Seu dinheiro.
            <br />
            Seus planos.
            <br />
            <em>Mais clareza.</em>
          </h1>
          <p>Organize o presente e abra espaço para o que vem depois.</p>
          <div className="art-rings" />
          <small>
            <ShieldCheck size={16} />
            Seus dados, sempre privados.
          </small>
        </div>
        <div className="auth-form">
          <span className="eyebrow">BEM-VINDO AO CLAREZA</span>
          <h2>Um novo olhar para suas finanças</h2>
          <p>Entre com seu e-mail. Sem senhas para memorizar.</p>
          {!supabase ? (
            <div className="warning">
              <b>Conecte seu Supabase para começar.</b>
              <p>
                Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em
                .env.local, as variáveis do Worker em .dev.vars e aplique a
                migração SQL. Consulte o README.
              </p>
              <p>Nenhum saldo ou lançamento fictício será mostrado.</p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  if (sent) {
                    const r = await supabase!.auth.verifyOtp({
                      email,
                      token: otp,
                      type: "email",
                    });
                    if (r.error) throw r.error;
                  } else {
                    const r = await supabase!.auth.signInWithOtp({
                      email,
                      options: { emailRedirectTo: location.origin },
                    });
                    if (r.error) throw r.error;
                    setSent(true);
                    setNotice("Confira o link ou código enviado por e-mail.");
                  }
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="voce@exemplo.com"
                />
              </label>
              {sent && (
                <label>
                  Código recebido
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                </label>
              )}
              <button className="primary" disabled={busy}>
                {sent ? "Validar código" : "Receber acesso por e-mail"}
                <ArrowUpRight size={18} />
              </button>
              {sent && (
                <button
                  type="button"
                  className="link"
                  onClick={() => setSent(false)}
                >
                  Enviar novo acesso / alterar e-mail
                </button>
              )}
            </form>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="success">
              {notice}
            </p>
          )}
          <small>
            <ShieldCheck size={14} />
            Conexão segura • Acesso pessoal e protegido
          </small>
        </div>
      </div>
    );
  return (
    <div className={collapsed ? "app sidebar-collapsed" : "app"}>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="logo">
          <span>c</span>clareza<span className="dot">.</span>
        </div>
        <div className="workspace">
          <span className="avatar">
            {session.user.email?.[0].toUpperCase()}
          </span>
          <div>
            <b>Meu espaço financeiro</b>
            <small>Um passo de cada vez</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <p className="nav-label">SEU DIA A DIA</p>
        <nav>
          {navigation.map(([id, title, Icon]) => (
            <button
              key={id}
              aria-label={title}
              title={title}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setPage(id);
                setMobile(false);
                setSearch("");
              }}
            >
              <Icon size={18} />
              <span className="nav-text">{title}</span>
              {id === "savings" && <span className="new">NOVO</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip">
            <Sprout size={20} />
            <b>Pequenos passos, grandes planos.</b>
            <p>Cuidar do seu dinheiro é cuidar do seu futuro.</p>
          </div>
          <button className="nav-item" onClick={() => supabase!.auth.signOut()}>
            <LogOut size={17} />
            <span className="nav-text">Sair da conta</span>
          </button>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <main>
        <header className="topbar">
          <div>
            <button
              className="icon mobile-only"
              onClick={() => setMobile(!mobile)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>
            <button
              className="icon desktop-only"
              aria-label="Recolher ou expandir menu"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={18} />
            </button>
            <span>Pessoal</span>
            <ChevronRight size={14} />
            <b>{navigation.find((n) => n[0] === page)?.[1]}</b>
          </div>
          <div>
            <span className="secure">
              <span />
              Conexão protegida
            </span>
            <button
              className="icon"
              aria-label="Alternar tema"
              onClick={toggleTheme}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="avatar" title={session.user.email}>
              {session.user.email?.[0].toUpperCase()}
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-title">
            <div>
              <span className="eyebrow">SUAS FINANÇAS, COM DIREÇÃO</span>
              <h1>
                {page === "overview"
                  ? "Tudo mais claro, a partir de agora."
                  : navigation.find((n) => n[0] === page)?.[1]}
              </h1>
              <p>
                {page === "savings"
                  ? "Seu próximo endereço começa com um plano."
                  : "Acompanhe seus números e faça espaço para seus planos."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() =>
                open(
                  page === "debts"
                    ? "debts"
                    : page === "savings"
                      ? "daily_work_earnings"
                      : "transactions",
                )
              }
            >
              <Plus size={17} />
              Novo registro
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="link" onClick={load}>
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              {notice}
            </div>
          )}
          <div className="toolbar">
            <div className="periods">
              {[
                ["7", "7 dias"],
                ["30", "30 dias"],
                ["90", "90 dias"],
                ["365", "12 meses"],
                ["custom", "Personalizado"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  className={period === v ? "selected" : ""}
                  onClick={() => setPeriod(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <>
                <input
                  aria-label="Início do período"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
                <input
                  aria-label="Fim do período"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </>
            )}
            <button className="small" disabled={loading} onClick={load}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              {loading ? "Atualizando" : "Atualizar"}
            </button>
          </div>
          {loading && !Object.keys(data).length ? (
            <div className="empty">Carregando seus registros…</div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="stats four">
                    <Stat
                      title="Saldo bancário sincronizado"
                      value={money(
                        sum(
                          accounts.filter((a) => a.source === "pluggy"),
                          "balance",
                        ),
                      )}
                      foot="BRL • sem limites de crédito"
                    />
                    <Stat
                      title="Saldo informado manualmente"
                      value={money(
                        sum(
                          accounts.filter((a) => a.source === "manual"),
                          "balance",
                        ),
                      )}
                      foot="Separado do saldo sincronizado"
                    />
                    <Stat
                      title="Dívidas em aberto"
                      value={money(totalDebt)}
                      foot={`${overdue.length} pendências vencidas`}
                      tone={overdue.length ? "warn" : ""}
                    />
                    <Stat
                      title="Resultado do período"
                      value={money(income - expenses - paid)}
                      foot="Receita líquida − despesas − pagamentos"
                      tone="green"
                    />
                  </div>
                  <BalanceArc
                    accounts={accounts as { source: string; balance: number }[]}
                    debt={totalDebt}
                    unavailable={!!error || loading}
                  />
                  <div className="two-col">
                    <Section
                      title="Seu dinheiro em movimento"
                      action={
                        <span className="badge">
                          {rangeStart} a {rangeEnd}
                        </span>
                      }
                    >
                      <div className="chart-summary">
                        <div>
                          <small>Receitas líquidas</small>
                          <strong className="positive">{money(income)}</strong>
                        </div>
                        <div>
                          <small>Despesas e pagamentos</small>
                          <strong>{money(expenses + paid)}</strong>
                        </div>
                      </div>
                      <Chart rows={flowChart} keys={["Receitas", "Despesas"]} />
                    </Section>
                    <Section title="Próximos passos">
                      <div className="insight">
                        <span className="insight-icon">
                          <Target />
                        </span>
                        <h3>O próximo passo cabe no seu dia.</h3>
                        <p>
                          {overdue.length
                            ? `Você tem ${money(overdue.reduce((s, d) => s + d.amount - d.paid, 0))} em dívidas vencidas. Revise prioridades preservando moradia, alimentação e contas essenciais.`
                            : "Mantenha receitas, despesas e vencimentos em dia para construir uma visão confiável."}
                        </p>
                        <button
                          className="small"
                          onClick={() => setPage("payments")}
                        >
                          Organizar pagamentos
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <div className="quick">
                        <button
                          onClick={() =>
                            open("transactions", undefined, { kind: "income" })
                          }
                        >
                          <ArrowDownLeft size={18} />
                          Registrar receita
                        </button>
                        <button
                          onClick={() =>
                            open("transactions", undefined, { kind: "expense" })
                          }
                        >
                          <ArrowUpRight size={18} />
                          Registrar gasto
                        </button>
                      </div>
                    </Section>
                  </div>
                  <div className="stats four">
                    <Stat title="Pago no período" value={money(paid)} />
                    <Stat
                      title="Dívidas quitadas"
                      value={money(
                        sum(debts.filter((d) => d.paid === d.amount)),
                      )}
                    />
                    <Stat
                      title="Progresso das dívidas"
                      value={`${sum(debts) ? Math.round((sum(debts, "paid") / sum(debts)) * 100) : 0}%`}
                    />
                    <Stat
                      title="Vencendo em 7 dias"
                      value={money(
                        sum(
                          get("payment_plans").filter(
                            (p) =>
                              p.status === "pending" &&
                              daysBetween(today(), p.due_date) >= 0 &&
                              daysBetween(today(), p.due_date) <= 7,
                          ),
                        ),
                      )}
                    />
                  </div>
                  <div className="moving-banner">
                    <div>
                      <span className="eyebrow">
                        UM PLANO PARA SEU PRÓXIMO CAPÍTULO
                      </span>
                      <h2>Projeto Mudança</h2>
                      <p>
                        {calc
                          ? `${calc.days} dias para transformar sua reserva em um novo começo.`
                          : "Crie sua meta e acompanhe cada conquista até a mudança."}
                      </p>
                    </div>
                    <button
                      className="small"
                      onClick={() => setPage("savings")}
                    >
                      Abrir Modo Economia
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <Rows
                    table="payment_plans"
                    title="Pagamentos planejados"
                    rows={get("payment_plans").filter(
                      (p) => p.status === "pending",
                    )}
                  />
                </>
              )}
              {page === "debts" && (
                <>
                  <div className="stats four">
                    <Stat title="Em aberto" value={money(totalDebt)} />
                    <Stat
                      title="Vencidas"
                      value={money(
                        overdue.reduce((s, d) => s + d.amount - d.paid, 0),
                      )}
                      tone="warn"
                    />
                    <Stat title="Já pago" value={money(sum(debts, "paid"))} />
                    <Stat
                      title="Quitadas"
                      value={String(
                        debts.filter((d) => d.paid === d.amount).length,
                      )}
                    />
                  </div>
                  <div className="toolbar">
                    <label className="search">
                      <Search size={16} />
                      <input
                        placeholder="Buscar dívida, credor ou categoria"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label className="small">
                      <Upload size={15} />
                      Importar CSV, XLSX ou JSON
                      <input
                        type="file"
                        hidden
                        accept=".csv,.xlsx,.json"
                        onChange={(e) =>
                          e.target.files?.[0] && readFile(e.target.files[0])
                        }
                      />
                    </label>
                    <button
                      className="small"
                      onClick={() =>
                        download(
                          "name;creditor;amount;due_date;category;installments\nExemplo;Credor;1000,00;2026-12-10;Outras;1",
                          "text/csv",
                          "modelo-dividas.csv",
                        )
                      }
                    >
                      <Download size={15} />
                      Modelo
                    </button>
                  </div>
                  <Rows table="debts" title="Suas dívidas" rows={debts} />
                  <Rows table="debt_installments" title="Parcelas" />
                  <Rows
                    table="debt_payments"
                    title="Histórico de pagamentos e estornos"
                  />
                </>
              )}
              {page === "payments" && (
                <>
                  <div className="info">
                    Pagamentos confirmados reduzem a dívida, sem descontar
                    novamente do saldo bancário. Estornos preservam o histórico.
                  </div>
                  <Rows
                    table="payment_plans"
                    title="Planejamento de pagamentos"
                  />
                  <Rows table="debt_payments" title="Pagamentos e estornos" />
                </>
              )}
              {page === "transactions" && (
                <>
                  <div className="toolbar">
                    <label className="small">
                      <Upload size={15} />
                      Importar extrato CSV, XLSX ou JSON
                      <input
                        type="file"
                        hidden
                        accept=".csv,.xlsx,.json"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          readFile(e.target.files[0], "statement")
                        }
                      />
                    </label>
                    <button
                      className="small"
                      onClick={() =>
                        download(
                          "name;amount;date;kind;category\nMercado;150,00;2026-10-18;expense;Alimentação",
                          "text/csv",
                          "modelo-extrato.csv",
                        )
                      }
                    >
                      Modelo de extrato
                    </button>
                  </div>
                  <div className="info">
                    Registre ganhos de trabalho no Modo Economia ou aqui, uma
                    única vez. Os custos operacionais já são descontados no
                    lucro líquido. Lançamentos planejados não compõem o saldo
                    realizado. Recorrências são modelos mensais e exigem
                    confirmação de cada ocorrência.
                  </div>
                  <div className="stats four">
                    <Stat
                      title="Receitas líquidas do período"
                      value={money(income)}
                      tone="green"
                    />
                    <Stat title="Despesas do período" value={money(expenses)} />
                    <Stat title="Pagamentos de dívidas" value={money(paid)} />
                    <Stat
                      title="Resultado realizado"
                      value={money(income - expenses - paid)}
                    />
                  </div>
                  <Rows table="transactions" title="Receitas e despesas" />
                  <Section title="Previsões e recorrências">
                    <p className="muted">
                      Previsões não são saldo disponível. Confirme apenas
                      ocorrências já realizadas; repetir a confirmação não
                      duplica o lançamento.
                    </p>
                    {plannedOccurrences(tx, rangeStart, rangeEnd).map((r) => (
                      <div className="list-item" key={`${r.id}-${r.date}`}>
                        <div>
                          <b>{r.name}</b>
                          <small>
                            {r.date} • {labels[r.kind]}
                          </small>
                        </div>
                        <b>{money(r.amount)}</b>
                        <button
                          className="small"
                          disabled={r.date > today() || busy}
                          onClick={() =>
                            action(() =>
                              api("transactions/realize", "POST", {
                                id: r.id,
                                date: r.date,
                              }),
                            )
                          }
                        >
                          Confirmar realizado
                        </button>
                      </div>
                    ))}
                  </Section>
                </>
              )}
              {page === "accounts" && (
                <>
                  <div className="info">
                    Informe apenas contas ainda não conectadas. Uma reserva no
                    Cofre não é uma conta adicional. Saldos de origens
                    diferentes não são somados automaticamente.
                  </div>
                  <div className="toolbar">
                    <button
                      className="small"
                      disabled={busy}
                      onClick={() => action(() => api("bank/sync", "POST"))}
                    >
                      <RefreshCw size={15} />
                      Sincronizar Pluggy
                    </button>
                  </div>
                  <Rows table="bank_accounts" title="Contas e saldos" />
                  <Rows
                    table="bank_balance_history"
                    title="Histórico diário de saldo"
                  />
                  <Section title="Conexões bancárias">
                    {get("bank_connections").map((c) => (
                      <div className="list-item" key={c.id}>
                        <div>
                          <b>{c.name}</b>
                          <p>
                            Última sincronização:{" "}
                            {c.last_sync || "Ainda não realizada"} {c.error}
                          </p>
                        </div>
                        <button
                          className="small"
                          onClick={() =>
                            confirm(
                              "Revogar o consentimento bancário? Remova também este item das variáveis do Worker.",
                            ) &&
                            action(() =>
                              api("bank/disconnect", "POST", {
                                item: c.provider_item_id,
                              }),
                            )
                          }
                        >
                          Desconectar
                        </button>
                      </div>
                    ))}
                    {!get("bank_connections").length && (
                      <p className="muted">
                        Nenhuma conexão autorizada. A atualização manual está
                        disponível.
                      </p>
                    )}
                  </Section>
                </>
              )}
              {page === "savings" && (
                <>
                  {!goal ? (
                    <Empty
                      text="Dê um nome ao seu próximo capítulo."
                      table="savings_goals"
                    />
                  ) : (
                    <>
                      <div className="toolbar">
                        <select
                          aria-label="Projeto de economia"
                          value={goal.id}
                          onChange={(e) => setSelectedGoal(e.target.value)}
                        >
                          {get("savings_goals").map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="small"
                          onClick={() => open("savings_goals", goal)}
                        >
                          <Pencil size={14} />
                          Ajustar meta
                        </button>
                        <button
                          className="small"
                          onClick={() => open("savings_goals")}
                        >
                          Novo projeto
                        </button>
                      </div>
                      <div className="goal-hero">
                        <div>
                          <span className="eyebrow">PROJETO MUDANÇA</span>
                          <h2>{goal.name}</h2>
                          <p>
                            {calc!.days > 0
                              ? `${calc!.days} dias para a mudança • ${goal.due_date}`
                              : "Data da mudança alcançada • seus registros continuam aqui"}
                          </p>
                          <strong>
                            {money(reserved)}
                            <span> de {money(calc!.target)}</span>
                          </strong>
                          <div className="progress">
                            <span style={{ width: `${calc!.progress}%` }} />
                          </div>
                          <small>
                            {calc!.progress.toFixed(1)}% da meta • dinheiro
                            efetivamente reservado
                          </small>
                        </div>
                        <div className="goal-leaf">
                          <Sprout size={88} strokeWidth={1} />
                        </div>
                      </div>
                      <div className="stats four">
                        <Stat
                          title="Ainda falta juntar"
                          value={money(calc!.remaining)}
                        />
                        <Stat
                          title="Economia por dia"
                          value={money(calc!.daily)}
                          foot={`${money(calc!.weekly)} por semana`}
                        />
                        <Stat
                          title="Lucro líquido por dia de trabalho"
                          value={
                            calc!.netPerWorkday === null
                              ? "Sem dias previstos"
                              : money(calc!.netPerWorkday)
                          }
                          foot="Meta com compromissos e despesas variáveis"
                        />
                        <Stat
                          title="Pode gastar hoje"
                          value={money(
                            dailyAllowance(
                              sum(
                                accounts.filter(
                                  (a) =>
                                    a.source ===
                                    (accounts.some((x) => x.source === "pluggy")
                                      ? "pluggy"
                                      : "manual"),
                                ),
                                "balance",
                              ),
                              get("savings_goals").reduce(
                                (s, g) =>
                                  s +
                                  g.initial_reserved +
                                  sum(
                                    get("savings_contributions").filter(
                                      (r) => r.goal_id === g.id,
                                    ),
                                  ) -
                                  sum(
                                    get("savings_withdrawals").filter(
                                      (r) => r.goal_id === g.id,
                                    ),
                                  ),
                                0,
                              ),
                              obligations,
                              goal.daily_variable,
                              sum(
                                actual.filter(
                                  (t) =>
                                    t.date === today() && t.kind === "expense",
                                ),
                              ),
                            ),
                          )}
                          foot="Limitado ao saldo informado, após reservas e compromissos"
                        />
                      </div>
                      <div className="quick horizontal">
                        <button onClick={() => open("daily_work_earnings")}>
                          <ArrowDownLeft size={18} />
                          Registrar ganho
                        </button>
                        <button
                          onClick={() =>
                            open("transactions", undefined, { kind: "expense" })
                          }
                        >
                          <ArrowUpRight size={18} />
                          Registrar gasto
                        </button>
                        <button
                          onClick={() =>
                            open("savings_contributions", undefined, {
                              goal_id: goal.id,
                            })
                          }
                        >
                          <Plus size={18} />
                          Guardar dinheiro
                        </button>
                        <button
                          onClick={() =>
                            open("savings_withdrawals", undefined, {
                              goal_id: goal.id,
                            })
                          }
                        >
                          Registrar retirada
                        </button>
                      </div>
                      <div className="two-col">
                        <Section title="Evolução do Cofre">
                          <Chart
                            rows={Array.from(
                              new Set([
                                goal.created_at.slice(0, 10),
                                ...contributions.map((r) => r.date),
                                ...withdrawals.map((r) => r.date),
                              ]),
                            )
                              .sort()
                              .map((date) => ({
                                date,
                                Reserva:
                                  (goal.initial_reserved +
                                    sum(
                                      contributions.filter(
                                        (r) => r.date <= date,
                                      ),
                                    ) -
                                    sum(
                                      withdrawals.filter((r) => r.date <= date),
                                    )) /
                                  100,
                              }))}
                          />
                        </Section>
                        <Section title="Seu ritmo, seu futuro">
                          <div className="projection">
                            <span className="badge">
                              PROJEÇÃO • NÃO É SALDO DISPONÍVEL
                            </span>
                            <h3>
                              Se continuar neste ritmo, você chegará à data da
                              mudança com
                            </h3>
                            <strong>{money(calc!.projected)}</strong>
                            <p>
                              Lucro médio {money(meanNet)} × {calc!.workdays}{" "}
                              dias de trabalho, menos {money(obligations)} de
                              compromissos e{" "}
                              {money(goal.daily_variable * calc!.days)} de
                              despesas variáveis, mais a reserva atual. Custos
                              da mudança compõem a meta, ainda não são deduzidos
                              desta projeção.
                            </p>
                          </div>
                        </Section>
                      </div>
                      <div className="stats four">
                        <Stat
                          title="Reservado neste mês (líquido)"
                          value={money(
                            sum(
                              contributions.filter((r) =>
                                r.date.startsWith(today().slice(0, 7)),
                              ),
                            ) -
                              sum(
                                withdrawals.filter((r) =>
                                  r.date.startsWith(today().slice(0, 7)),
                                ),
                              ),
                          )}
                        />
                        <Stat
                          title="Essenciais e dívidas previstos"
                          value={money(obligations)}
                        />
                        <Stat
                          title="Gastos evitáveis no período"
                          value={money(
                            sum(
                              periodTx.filter(
                                (t) =>
                                  t.kind === "expense" &&
                                  [
                                    "reducible",
                                    "deferrable",
                                    "dispensable",
                                  ].includes(t.classification),
                              ),
                            ),
                          )}
                        />
                        <Stat
                          title="Custos da mudança + margem"
                          value={money(
                            Math.round(
                              movingTotal * (1 + goal.contingency / 100),
                            ),
                          )}
                        />
                      </div>
                      <Section title="Cenários para a mudança">
                        <p className="muted">
                          Estimativas condicionais; nenhuma receita é garantida.
                          Média real dos últimos 30 dias de trabalho ou
                          estimativa informada, quando não há histórico.
                        </p>
                        <div className="stats three">
                          {[
                            {
                              name: "Conservador",
                              income_factor: 0.8,
                              expense_factor: 1.15,
                              work_days: Math.max(0, goal.work_days - 1),
                            },
                            {
                              name: "Realista",
                              income_factor: 1,
                              expense_factor: 1,
                              work_days: goal.work_days,
                            },
                            {
                              name: "Agressivo",
                              income_factor: 1.1,
                              expense_factor: 0.85,
                              work_days: Math.min(7, goal.work_days + 1),
                            },
                            ...get("savings_scenarios").filter(
                              (r) => r.goal_id === goal.id,
                            ),
                          ].map((s, i) => (
                            <Stat
                              key={i}
                              title={s.name}
                              value={money(
                                savings({
                                  date: goal.due_date,
                                  target: calc!.target,
                                  reserved,
                                  dailyNet: Math.round(
                                    meanNet * s.income_factor,
                                  ),
                                  workDays: s.work_days,
                                  obligations,
                                  moving: movingTotal,
                                  contingency: goal.contingency,
                                  dailyVariable: Math.round(
                                    goal.daily_variable * s.expense_factor,
                                  ),
                                }).projected,
                              )}
                              foot={`${s.work_days} dias/semana • receita × ${s.income_factor} • variáveis × ${s.expense_factor}`}
                            />
                          ))}
                        </div>
                        <button
                          className="small"
                          onClick={() =>
                            open("savings_scenarios", undefined, {
                              goal_id: goal.id,
                            })
                          }
                        >
                          Salvar cenário personalizado
                        </button>
                      </Section>
                      <Section title="Simulador de decisões">
                        <div className="toolbar">
                          <select
                            aria-label="Decisão"
                            value={decision}
                            onChange={(e) => setDecision(e.target.value)}
                          >
                            <option value="expense">
                              Gasto extra hoje (R$)
                            </option>
                            <option value="extra">
                              Ganho líquido extra (R$)
                            </option>
                            <option value="cut">
                              Redução diária de gastos (R$)
                            </option>
                            <option value="work">Dias extras por semana</option>
                          </select>
                          <input
                            aria-label="Valor da simulação"
                            inputMode="decimal"
                            value={decisionAmount}
                            onChange={(e) => setDecisionAmount(e.target.value)}
                          />
                        </div>
                        {(() => {
                          let n = 0;
                          try {
                            n =
                              decision === "work"
                                ? Math.min(
                                    7 - goal.work_days,
                                    Math.max(
                                      0,
                                      Math.floor(Number(decisionAmount)),
                                    ),
                                  )
                                : Math.max(0, cents(decisionAmount));
                          } catch {
                            return <p>Informe um valor válido.</p>;
                          }
                          const delta =
                            decision === "expense"
                              ? -n
                              : decision === "extra"
                                ? n
                                : decision === "cut"
                                  ? Math.min(n, goal.daily_variable) *
                                    calc!.days
                                  : meanNet * Math.floor(calc!.days / 7) * n;
                          return (
                            <p>
                              Impacto estimado: <b>{money(delta)}</b>. Nova
                              projeção: <b>{money(calc!.projected + delta)}</b>.{" "}
                              {decision === "expense" && calc!.daily > 0
                                ? `Equivale a ${Math.ceil(n / calc!.daily)} dias da meta de economia.`
                                : ""}{" "}
                              {decision === "work"
                                ? "Semanas completas × dias extras × lucro médio."
                                : "Mantém as demais premissas do cenário realista."}
                            </p>
                          );
                        })()}
                      </Section>
                      <Section title="Alertas e resumo diário">
                        {get("user_settings")[0]?.alerts_enabled !== false &&
                          get("savings_alerts")
                            .filter(
                              (a) =>
                                a.goal_id === goal.id && a.date === today(),
                            )
                            .map((a) => (
                              <p className="info" key={a.id}>
                                {a.name}
                              </p>
                            ))}
                        <div className="info">
                          Hoje:{" "}
                          {money(
                            work
                              .filter((r) => r.date === today())
                              .reduce(
                                (s, r) => s + netEarnings(r as any).net,
                                0,
                              ),
                          )}{" "}
                          líquidos de trabalho,{" "}
                          {money(
                            sum(
                              actual.filter(
                                (t) =>
                                  t.date === today() && t.kind === "expense",
                              ),
                            ),
                          )}{" "}
                          em despesas pessoais e{" "}
                          {money(
                            sum(
                              contributions.filter((r) => r.date === today()),
                            ),
                          )}{" "}
                          reservados. Meta: {money(calc!.daily)}.
                        </div>
                        {calc!.days <= 30 && (
                          <p className="warning">
                            Faltam {calc!.days} dias para a mudança.
                          </p>
                        )}
                        {[25, 50, 75, 100]
                          .filter((p) => calc!.progress >= p)
                          .map((p) => (
                            <p className="success" key={p}>
                              Você atingiu {p}% da meta.
                            </p>
                          ))}
                        {get("savings_budgets")
                          .filter((b) => b.goal_id === goal.id)
                          .map((b) => {
                            const spent = sum(
                              actual.filter(
                                (t) =>
                                  t.kind === "expense" &&
                                  t.classification === b.classification &&
                                  daysBetween(t.date, today()) >= 0 &&
                                  daysBetween(t.date, today()) <
                                    (b.period === "daily" ? 1 : 7),
                              ),
                            );
                            return (
                              <p
                                key={b.id}
                                className={
                                  spent >= b.amount * 0.8 ? "warning" : "info"
                                }
                              >
                                {b.name}: {money(b.amount - spent)} restantes no
                                limite {labels[b.period].toLowerCase()}. Nenhuma
                                despesa será bloqueada.
                              </p>
                            );
                          })}
                        {overdue.length > 0 && (
                          <p className="warning">
                            Há contas vencidas. Preserve despesas essenciais ao
                            revisar seu plano.
                          </p>
                        )}
                        {sum(
                          contributions.filter(
                            (r) =>
                              daysBetween(r.date, today()) < 7 &&
                              daysBetween(r.date, today()) >= 0,
                          ),
                        ) -
                          sum(
                            withdrawals.filter(
                              (r) =>
                                daysBetween(r.date, today()) < 7 &&
                                daysBetween(r.date, today()) >= 0,
                            ),
                          ) <
                          sum(
                            contributions.filter(
                              (r) =>
                                daysBetween(r.date, today()) >= 7 &&
                                daysBetween(r.date, today()) < 14,
                            ),
                          ) -
                            sum(
                              withdrawals.filter(
                                (r) =>
                                  daysBetween(r.date, today()) >= 7 &&
                                  daysBetween(r.date, today()) < 14,
                              ),
                            ) && (
                          <p className="warning">
                            Sua economia líquida caiu em relação à semana
                            anterior.
                          </p>
                        )}
                      </Section>
                      <Rows
                        table="financial_goals"
                        rows={get("financial_goals").filter(
                          (r) => r.savings_goal_id === goal.id,
                        )}
                        title="Metas intermediárias do Cofre"
                      />
                      <button
                        className="small"
                        onClick={() =>
                          open("financial_goals", undefined, {
                            savings_goal_id: goal.id,
                          })
                        }
                      >
                        Criar meta intermediária
                      </button>
                      <Rows
                        table="savings_budgets"
                        rows={get("savings_budgets").filter(
                          (r) => r.goal_id === goal.id,
                        )}
                        title="Orçamento de sobrevivência"
                      />
                      <Rows
                        table="moving_expenses"
                        rows={moving}
                        title="Custos da mudança"
                      />
                      <Rows
                        table="savings_contributions"
                        rows={contributions}
                        title="Cofre • depósitos contábeis"
                      />
                      <Rows
                        table="savings_withdrawals"
                        rows={withdrawals}
                        title="Cofre • retiradas"
                      />
                    </>
                  )}
                  <Section title="Quanto preciso faturar?">
                    <label>
                      Quero economizar por dia (R$)
                      <input
                        inputMode="decimal"
                        value={desiredSaving}
                        onChange={(e) => setDesiredSaving(e.target.value)}
                      />
                    </label>
                    {(() => {
                      if (!recentWork.length)
                        return (
                          <p className="muted">
                            Registre custos de trabalho para calcular o
                            faturamento bruto necessário com uma base real.
                          </p>
                        );
                      let desired = 0;
                      try {
                        desired = cents(desiredSaving);
                      } catch {
                        return <p>Informe um valor válido.</p>;
                      }
                      const costs =
                        recentWork.reduce(
                          (s, r) =>
                            s + r.fuel + r.food + r.maintenance + r.other,
                          0,
                        ) / earningsAverage(recentWork).days;
                      const personal = goal?.daily_variable || 0;
                      return (
                        <p className="info">
                          Faturamento necessário:{" "}
                          {money(
                            Math.max(0, desired) + Math.round(costs) + personal,
                          )}{" "}
                          = economia desejada + {money(Math.round(costs))} de
                          custos operacionais médios + {money(personal)} de
                          despesas variáveis pessoais. Compromissos fixos devem
                          ser provisionados à parte. Estimativa, sem receita
                          garantida.
                        </p>
                      );
                    })()}
                  </Section>
                  <Section title="Seu trabalho em números">
                    <div className="stats four">
                      {[7, 30].map((days) => {
                        const r = work.filter(
                          (r) =>
                            daysBetween(r.date, today()) >= 0 &&
                            daysBetween(r.date, today()) < days,
                        );
                        return (
                          <Stat
                            key={days}
                            title={`Lucro médio • últimos ${days} dias`}
                            value={money(earningsAverage(r).average)}
                            foot={`${earningsAverage(r).days} dias com trabalho registrado`}
                          />
                        );
                      })}
                      <Stat
                        title="Lucro por hora no período"
                        value={
                          sum(periodWork, "hours")
                            ? money(
                                Math.round(
                                  periodWork.reduce(
                                    (s, r) => s + netEarnings(r as any).net,
                                    0,
                                  ) / sum(periodWork, "hours"),
                                ),
                              )
                            : "Sem horas registradas"
                        }
                      />
                      <Stat
                        title="Dias de trabalho para a meta"
                        value={
                          calc && meanNet > 0
                            ? String(Math.ceil(calc.remaining / meanNet))
                            : "Sem estimativa"
                        }
                        foot="Antes de novos compromissos"
                      />
                    </div>
                    <p className="muted">
                      Os custos operacionais são descontados aqui uma vez. A
                      reserva só aumenta quando você registra um depósito no
                      Cofre.
                    </p>
                  </Section>
                  <Rows
                    table="daily_work_earnings"
                    title="Ganhos e custos de trabalho"
                  />
                </>
              )}
              {page === "planning" && (
                <>
                  <Rows table="financial_goals" title="Metas financeiras" />
                  <Rows table="budgets" title="Orçamentos por categoria" />
                  <Section title="Consumo dos orçamentos">
                    {get("budgets").map((b) => {
                      const spent = sum(
                        actual.filter(
                          (t) =>
                            t.kind === "expense" &&
                            t.category === b.category &&
                            t.date.slice(0, 7) === b.month.slice(0, 7),
                        ),
                      );
                      return (
                        <div
                          key={b.id}
                          className={
                            spent >= b.amount * 0.8 ? "warning" : "info"
                          }
                        >
                          {b.name}: {money(spent)} utilizados de{" "}
                          {money(b.amount)}; {money(b.amount - spent)}{" "}
                          restantes.
                        </div>
                      );
                    })}
                  </Section>
                  <Section title="Simulador de quitação">
                    <div className="toolbar">
                      <label>
                        Disponível por mês (R$)
                        <input
                          value={payBudget}
                          onChange={(e) => setPayBudget(e.target.value)}
                          inputMode="decimal"
                        />
                      </label>
                      <label>
                        Estratégia
                        <select
                          value={method}
                          onChange={(e) => setMethod(e.target.value)}
                        >
                          <option value="snowball">
                            Bola de neve • menor saldo
                          </option>
                          <option value="avalanche">
                            Avalanche • maior taxa de juros
                          </option>
                          <option value="manual">Prioridade manual</option>
                        </select>
                      </label>
                    </div>
                    <p className="muted">
                      Distribuição imediata e estimativa mensal com juros
                      informados. Preserve seu orçamento essencial.
                    </p>
                    {(() => {
                      try {
                        const budget = Math.max(0, cents(payBudget));
                        const projection = payoffSchedule(
                          debts as any,
                          budget,
                          method,
                        );
                        return (
                          <>
                            <p className="info">
                              Prazo estimado:{" "}
                              {projection.months === null
                                ? "orçamento insuficiente ou mais de 600 meses"
                                : `${projection.months} meses`}
                              . Juros estimados:{" "}
                              {money(projection.totalInterest)}. Taxas mensais
                              informadas, sem multas ou novas dívidas; valores
                              não garantidos.
                            </p>
                            {payoff(debts as any, budget, method).map((d) => (
                              <div className="list-item" key={d.id}>
                                <span>
                                  {debts.find((x) => x.id === d.id)?.name}
                                </span>
                                <b>
                                  {money(d.payment)}{" "}
                                  <small>restante {money(d.balance)}</small>
                                </b>
                              </div>
                            ))}
                          </>
                        );
                      } catch {
                        return <p>Informe um valor válido.</p>;
                      }
                    })()}
                  </Section>
                </>
              )}
              {page === "notes" && (
                <>
                  <div className="toolbar">
                    <button
                      className="small"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          const r = await api("calendar/connect", "POST");
                          location.assign(r.url);
                        })
                      }
                    >
                      Conectar Google Calendar
                    </button>
                    <button
                      className="small"
                      disabled={busy}
                      onClick={() => action(() => api("calendar/sync", "POST"))}
                    >
                      Sincronizar lembretes
                    </button>
                  </div>
                  <Section title="Calendário financeiro">
                    <div className="toolbar">
                      <input
                        aria-label="Data do calendário"
                        type="date"
                        value={calendarDate}
                        onChange={(e) => setCalendarDate(e.target.value)}
                      />
                      <select
                        aria-label="Visualização do calendário"
                        value={calendarView}
                        onChange={(e) => setCalendarView(e.target.value)}
                      >
                        <option value="month">Mensal</option>
                        <option value="week">Semanal</option>
                      </select>
                    </div>
                    <div className="calendar">
                      {Array.from(
                        {
                          length:
                            calendarView === "week"
                              ? 7
                              : new Date(
                                  Number(calendarDate.slice(0, 4)),
                                  Number(calendarDate.slice(5, 7)),
                                  0,
                                ).getDate(),
                        },
                        (_, i) => {
                          const day =
                            calendarView === "week"
                              ? new Date(
                                  Date.parse(calendarDate + "T12:00:00Z") +
                                    i * 86400000,
                                )
                                  .toISOString()
                                  .slice(0, 10)
                              : `${calendarDate.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`;
                          return (
                            <div
                              key={day}
                              className={
                                day === today()
                                  ? "calendar-day current"
                                  : "calendar-day"
                              }
                            >
                              <b>
                                {day.slice(8)}{" "}
                                <small>
                                  {new Date(
                                    day + "T12:00:00Z",
                                  ).toLocaleDateString("pt-BR", {
                                    weekday: "short",
                                    timeZone: "America/Sao_Paulo",
                                  })}
                                </small>
                              </b>
                              {get("reminders")
                                .filter((r) => r.due_date === day && !r.done)
                                .map((r) => (
                                  <span key={r.id}>
                                    {r.time} {r.name}
                                  </span>
                                ))}
                              {debts
                                .filter(
                                  (d) =>
                                    d.due_date === day && d.paid < d.amount,
                                )
                                .map((d) => (
                                  <span className="debt-event" key={d.id}>
                                    {d.name} • {money(d.amount - d.paid)}
                                  </span>
                                ))}
                              {get("payment_plans")
                                .filter(
                                  (p) =>
                                    p.due_date === day &&
                                    p.status === "pending",
                                )
                                .map((p) => (
                                  <span key={p.id}>
                                    Pagamento • {money(p.amount)}
                                  </span>
                                ))}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </Section>
                  <Rows table="notes" title="Suas anotações" />
                  <Rows table="reminders" title="Agenda e lembretes" />
                </>
              )}
              {page === "history" && (
                <>
                  <Section title="Receitas, despesas e pagamentos">
                    <Chart
                      rows={flowChart}
                      keys={["Receitas", "Despesas"]}
                      area={false}
                    />
                  </Section>
                  <Section title="Evolução do saldo bancário">
                    <select
                      aria-label="Conta do histórico"
                      value={historyAccount || accounts[0]?.id || ""}
                      onChange={(e) => setHistoryAccount(e.target.value)}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} • {a.institution}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const rows = get("bank_balance_history")
                        .filter(
                          (r) =>
                            r.account_id ===
                            (historyAccount || accounts[0]?.id),
                        )
                        .filter(inRange)
                        .sort((a, b) => a.date.localeCompare(b.date));
                      const balances = rows.map((r) => r.balance);
                      return rows.length ? (
                        <div className="stats four">
                          <Stat
                            title="Variação no período"
                            value={money(
                              rows[rows.length - 1].balance - rows[0].balance,
                            )}
                          />
                          <Stat
                            title="Maior saldo"
                            value={money(Math.max(...balances))}
                          />
                          <Stat
                            title="Menor saldo"
                            value={money(Math.min(...balances))}
                          />
                          <Stat
                            title="Último saldo registrado"
                            value={money(rows[rows.length - 1].balance)}
                          />
                        </div>
                      ) : null;
                    })()}
                    <Chart
                      rows={get("bank_balance_history")
                        .filter(
                          (r) =>
                            r.account_id ===
                            (historyAccount || accounts[0]?.id),
                        )
                        .filter(inRange)
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((r) => ({ date: r.date, Saldo: r.balance / 100 }))}
                      keys={["Saldo"]}
                    />
                  </Section>
                  <Section title="Redução do endividamento">
                    <Chart
                      rows={Array.from(
                        new Set([
                          rangeStart,
                          ...periodPay.map((p) => p.date),
                          rangeEnd,
                        ]),
                      )
                        .sort()
                        .map((date) => ({
                          date,
                          "Saldo devedor":
                            Math.max(
                              0,
                              debts
                                .filter(
                                  (d) => d.created_at.slice(0, 10) <= date,
                                )
                                .reduce((s, d) => s + d.amount, 0) -
                                sum(payments.filter((p) => p.date <= date)),
                            ) / 100,
                        }))}
                      keys={["Saldo devedor"]}
                    />
                    <p className="muted">
                      Principal cadastrado até cada data menos pagamentos
                      líquidos. Edições posteriores do valor original podem
                      alterar a série.
                    </p>
                  </Section>
                  <Section title="Dívidas por categoria">
                    {Array.from(new Set(debts.map((d) => d.category))).map(
                      (category) => (
                        <div className="list-item" key={category}>
                          <span>{category}</span>
                          <b>
                            {money(
                              debts
                                .filter((d) => d.category === category)
                                .reduce((s, d) => s + d.amount - d.paid, 0),
                            )}
                          </b>
                        </div>
                      ),
                    )}
                  </Section>
                  <Rows table="audit_logs" title="Histórico auditável" />
                </>
              )}
              {page === "reports" && (
                <>
                  <Section title="Relatórios do período">
                    <p className="muted">
                      Dados persistidos • {rangeStart} até {rangeEnd}. Use a
                      impressão do navegador para salvar PDF.
                    </p>
                    <div className="quick horizontal">
                      <button onClick={() => exportCSV(debts, "dividas")}>
                        Dívidas • CSV
                      </button>
                      <button
                        onClick={() =>
                          exportCSV(payments.filter(inRange), "pagamentos")
                        }
                      >
                        Pagamentos • CSV
                      </button>
                      <button
                        onClick={() =>
                          exportCSV(tx.filter(inRange), "transacoes")
                        }
                      >
                        Receitas e despesas • CSV
                      </button>
                      <button
                        onClick={() =>
                          exportCSV(
                            get("bank_balance_history").filter(inRange),
                            "saldos",
                          )
                        }
                      >
                        Saldos • CSV
                      </button>
                      <button onClick={() => window.print()}>
                        Salvar PDF / imprimir
                      </button>
                    </div>
                    <div className="stats four">
                      <Stat title="Receitas líquidas" value={money(income)} />
                      <Stat
                        title="Despesas e pagamentos"
                        value={money(expenses + paid)}
                      />
                      <Stat
                        title="Dívidas em aberto"
                        value={money(totalDebt)}
                      />
                      <Stat
                        title="Dívidas vencidas"
                        value={money(
                          overdue.reduce((s, d) => s + d.amount - d.paid, 0),
                        )}
                      />
                    </div>
                  </Section>
                  <Rows
                    table="debts"
                    title="Situação das dívidas"
                    rows={debts}
                  />
                </>
              )}
              {page === "settings" && (
                <>
                  <Section title="Perfil e preferências">
                    <p>{session.user.email}</p>
                    <button
                      className="small"
                      onClick={() =>
                        open("profiles", get("profiles")[0], {
                          email: session.user.email,
                        })
                      }
                    >
                      Editar perfil
                    </button>
                    <p>Moeda: BRL • Fuso: America/Sao_Paulo</p>
                    <button className="small" onClick={toggleTheme}>
                      {dark ? "Usar modo claro" : "Usar modo escuro"}
                    </button>
                  </Section>
                  <Section title="Preferências de alertas">
                    <button
                      className="small"
                      onClick={() => {
                        const saved = get("user_settings")[0];
                        void action(() =>
                          api(
                            `data/user_settings${saved ? `/${saved.id}` : ""}`,
                            saved ? "PATCH" : "POST",
                            {
                              name: "Preferências",
                              theme: dark ? "dark" : "light",
                              timezone: "America/Sao_Paulo",
                              alerts_enabled: saved?.alerts_enabled === false,
                            },
                          ),
                        );
                      }}
                    >
                      {get("user_settings")[0]?.alerts_enabled === false
                        ? "Ativar alertas"
                        : "Desativar alertas"}
                    </button>
                  </Section>
                  <Section title="Dados e privacidade">
                    <div className="quick horizontal">
                      <button
                        onClick={() =>
                          action(async () => {
                            const out: Record<string, any> = {};
                            for (const t of [
                              ...tables,
                              "calendar_events",
                              "import_jobs",
                              "import_rows",
                              "savings_alerts",
                            ])
                              out[t] = await allRows(t);
                            download(
                              JSON.stringify(out, null, 2),
                              "application/json",
                              "clareza-dados.json",
                            );
                          }, "Exportação concluída.")
                        }
                      >
                        Exportar todos os dados (JSON)
                      </button>
                      <button
                        onClick={() =>
                          action(() => api("calendar/disconnect", "POST"))
                        }
                      >
                        Revogar Google Calendar
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (
                            prompt(
                              "Digite EXCLUIR para excluir sua conta e todos os registros.",
                            ) === "EXCLUIR"
                          )
                            void action(async () => {
                              await api("account", "DELETE", {
                                confirmation: "EXCLUIR",
                              });
                              await supabase!.auth.signOut();
                            });
                        }}
                      >
                        Excluir conta e dados
                      </button>
                    </div>
                  </Section>
                  <Section title="Documentos privados">
                    <button
                      className="small"
                      onClick={() =>
                        action(async () => {
                          const r = await supabase!.storage
                            .from("documents")
                            .list(session.user.id, { limit: 1000 });
                          if (r.error) throw r.error;
                          for (const file of r.data || []) {
                            const signed = await supabase!.storage
                              .from("documents")
                              .createSignedUrl(
                                `${session.user.id}/${file.name}`,
                                60,
                              );
                            if (signed.error) throw signed.error;
                            const a = document.createElement("a");
                            a.href = signed.data.signedUrl;
                            a.target = "_blank";
                            a.rel = "noopener";
                            a.textContent = file.name;
                            document
                              .getElementById("documents")!
                              .append(a, document.createElement("br"));
                          }
                        }, "Lista de documentos carregada.")
                      }
                    >
                      Listar documentos
                    </button>
                    <div id="documents" />
                  </Section>
                  <Section title="Estado das integrações">
                    <p>
                      Supabase: sessão autenticada. Banco de dados:{" "}
                      {error
                        ? "consulte o erro acima"
                        : "última leitura concluída"}
                      .
                    </p>
                    <p>
                      Pluggy e Google Calendar: exigem configuração do Worker e
                      autorização externa. Uma integração só está validada após
                      sincronização bem-sucedida.
                    </p>
                    <p className="muted">
                      PWA disponível pelo menu de instalação do navegador. Dados
                      financeiros não são armazenados no cache offline.
                    </p>
                  </Section>
                </>
              )}
            </>
          )}
          <footer>
            Clareza <span>Menos ruído. Mais direção.</span>
            <span>
              Seus dados são só seus <ShieldCheck size={13} />
            </span>
          </footer>
        </div>
      </main>
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar dados"
          >
            <div className="section-title">
              <h2>{modal.row ? "Editar registro" : "Novo registro"}</h2>
              <button
                className="icon"
                onClick={() => setModal(null)}
                aria-label="Fechar"
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                {forms[modal.table].map((f) => {
                  const initial =
                    modal.extra?.[f.key] ??
                    (modal.table === "debts" && f.key === "amount"
                      ? modal.row?.original_amount
                      : modal.row?.[f.key]) ??
                    f.default ??
                    (f.type === "date" && f.required ? today() : "");
                  const value =
                    f.type === "money" && initial !== ""
                      ? String(Number(initial) / 100).replace(".", ",")
                      : String(initial ?? "");
                  return (
                    <label key={f.key}>
                      {f.label}
                      {["select", "debt", "account"].includes(f.type || "") ? (
                        <select
                          name={f.key}
                          required={f.required}
                          defaultValue={value}
                        >
                          {f.type !== "select" && (
                            <option value="">Selecione</option>
                          )}
                          {f.type === "debt"
                            ? debts.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))
                            : f.type === "account"
                              ? accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))
                              : f.options?.map((o) => (
                                  <option key={o} value={o}>
                                    {labels[o] || o}
                                  </option>
                                ))}
                        </select>
                      ) : (
                        <input
                          autoFocus={f === forms[modal.table][0]}
                          name={f.key}
                          required={f.required}
                          type={f.type === "money" ? "text" : f.type || "text"}
                          inputMode={f.type === "money" ? "decimal" : undefined}
                          defaultValue={value}
                          step={f.type === "number" ? "any" : undefined}
                          maxLength={f.type === "text" ? 200 : undefined}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {modal.table === "daily_work_earnings" && (
                <p className="info">
                  O lucro líquido é a receita bruta menos todos os custos
                  operacionais. Registre separadamente o valor efetivamente
                  guardado.
                </p>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="small"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Salvando…" : "Salvar registro"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {importOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Importar registros"
          >
            <div className="section-title">
              <h2>
                {importKind === "debts"
                  ? "Importar dívidas"
                  : "Importar extrato"}
              </h2>
              <button
                className="icon"
                onClick={() => setImportOpen(false)}
                aria-label="Fechar"
              >
                <X />
              </button>
            </div>
            <p>
              {filename} • {importRows.length} linhas. Valores em reais; datas
              AAAA-MM-DD. Duplicidades serão ignoradas.
            </p>
            <div className="form-grid">
              {(importKind === "debts"
                ? [
                    "name",
                    "creditor",
                    "amount",
                    "due_date",
                    "category",
                    "installments",
                  ]
                : ["name", "amount", "date", "kind", "category"]
              ).map((k) => (
                <label key={k}>
                  {
                    {
                      name: "Nome",
                      creditor: "Credor",
                      amount: "Valor em reais",
                      due_date: "Vencimento",
                      category: "Categoria",
                      installments: "Parcelas",
                      date: "Data",
                      kind: "Tipo (income/expense)",
                    }[k]
                  }
                  <select
                    value={mapping[k]}
                    onChange={(e) =>
                      setMapping({ ...mapping, [k]: e.target.value })
                    }
                  >
                    <option value="">Selecionar coluna</option>
                    {columns.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <h3>Prévia das primeiras 5 linhas</h3>
            <div className="table-wrap">
              <table>
                <tbody>
                  {importRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {(importKind === "debts"
                        ? ["name", "creditor", "amount", "due_date"]
                        : ["name", "amount", "date", "kind"]
                      ).map((k) => (
                        <td key={k}>{String(r[mapping[k]] ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={busy} onClick={doImport}>
              Validar e confirmar importação
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker.register("/sw.js");
