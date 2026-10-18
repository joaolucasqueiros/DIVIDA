export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export function cents(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw Error("Valor inválido");
    return Math.round(input * 100);
  }
  let normalized = input
    .trim()
    .replace(/R\$\s?/, "")
    .replace(/\s/g, "");
  if (normalized.includes(","))
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
    throw Error("Use um valor monetário válido, com até duas casas decimais.");
  const value = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(value)) throw Error("Valor fora do limite");
  return value;
}
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
export function savings(
  input: {
    date: string;
    target: number;
    reserved: number;
    dailyNet: number;
    workDays: number;
    obligations: number;
    moving: number;
    contingency: number;
    dailyVariable: number;
  },
  now = today(),
) {
  const days = Math.max(0, daysBetween(now, input.date));
  const minimum =
    Math.round(input.moving * (1 + input.contingency / 100)) +
    input.obligations;
  const target = Math.max(input.target, minimum);
  const remaining = Math.max(0, target - input.reserved);
  const workdays =
    Math.floor(days / 7) * input.workDays + Math.min(days % 7, input.workDays);
  const projected =
    input.reserved +
    Math.round(input.dailyNet * workdays) -
    input.obligations -
    input.dailyVariable * days;
  const daily = days > 0 ? Math.ceil(remaining / days) : remaining;
  return {
    days,
    target,
    minimum,
    remaining,
    daily,
    weekly: Math.min(remaining, daily * 7),
    workdays,
    netPerWorkday:
      workdays > 0
        ? Math.ceil(
            (remaining + input.obligations + input.dailyVariable * days) /
              workdays,
          )
        : null,
    projected,
    progress:
      target > 0
        ? Math.min(100, Math.max(0, (input.reserved / target) * 100))
        : 0,
  };
}
export function netEarnings(e: {
  gross: number;
  fuel?: number;
  food?: number;
  maintenance?: number;
  other?: number;
  hours?: number;
}) {
  const net =
    e.gross -
    (e.fuel || 0) -
    (e.food || 0) -
    (e.maintenance || 0) -
    (e.other || 0);
  return {
    net,
    hourly: e.hours && e.hours > 0 ? Math.round(net / e.hours) : null,
  };
}
export function payoff(
  debts: {
    id: string;
    amount: number;
    paid: number;
    interest_rate?: number;
    priority?: number;
  }[],
  budget: number,
  method: string,
) {
  let remaining = budget;
  return [...debts]
    .filter((d) => d.amount > d.paid)
    .sort((a, b) =>
      method === "avalanche"
        ? (b.interest_rate || 0) - (a.interest_rate || 0)
        : method === "manual"
          ? (b.priority || 0) - (a.priority || 0)
          : a.amount - a.paid - (b.amount - b.paid),
    )
    .map((d) => {
      const payment = Math.max(0, Math.min(remaining, d.amount - d.paid));
      remaining -= payment;
      return { ...d, payment, balance: d.amount - d.paid - payment };
    });
}
export const sum = (rows: Record<string, any>[], field = "amount") =>
  rows.reduce((s, r) => s + Number(r[field] || 0), 0);
export function dailyAllowance(
  balance: number,
  reserved: number,
  commitments: number,
  dailyLimit: number,
  spent: number,
) {
  return Math.max(
    0,
    Math.min(balance - reserved - commitments, dailyLimit - spent),
  );
}
export function payoffSchedule(
  debts: {
    id: string;
    amount: number;
    paid: number;
    interest_rate?: number;
    priority?: number;
  }[],
  monthly: number,
  method: string,
  extra = 0,
) {
  let balances = debts
    .filter((d) => d.amount > d.paid)
    .map((d) => ({ ...d, amount: d.amount - d.paid, paid: 0 }));
  let totalInterest = 0;
  const schedule: {
    month: number;
    paid: number;
    interest: number;
    remaining: number;
  }[] = [];
  for (
    let month = 1;
    month <= 600 && balances.some((d) => d.amount > 0);
    month++
  ) {
    const interest = balances.reduce((s, d) => {
      const interest = Math.round((d.amount * (d.interest_rate || 0)) / 100);
      d.amount += interest;
      return s + interest;
    }, 0);
    totalInterest += interest;
    const budget = monthly + (month === 1 ? extra : 0);
    const allocation = payoff(balances, budget, method);
    balances = allocation.map((d) => ({ ...d, amount: d.balance, paid: 0 }));
    const paid = allocation.reduce((s, d) => s + d.payment, 0);
    const remaining = balances.reduce((s, d) => s + d.amount, 0);
    schedule.push({ month, paid, interest, remaining });
    if (paid <= interest && remaining > 0 && month > 1)
      return { schedule, totalInterest, months: null };
  }
  return {
    schedule,
    totalInterest,
    months: balances.some((d) => d.amount > 0) ? null : schedule.length,
  };
}
export function plannedOccurrences(
  rows: Record<string, any>[],
  start: string,
  end: string,
) {
  const result: Record<string, any>[] = [];
  for (const row of rows.filter((r) => r.status === "planned")) {
    const anchor = Number(row.date.slice(8, 10));
    let date = row.date;
    for (let i = 0; i < 1200 && date <= end; i++) {
      if (
        date >= start &&
        !rows.some(
          (r) =>
            r.status === "realized" &&
            r.recurrence_parent_id === row.id &&
            r.date === date,
        )
      )
        result.push({ ...row, date, template_id: row.id });
      if (row.recurrence !== "monthly") break;
      const base = new Date(`${row.date.slice(0, 7)}-01T12:00:00Z`);
      base.setUTCMonth(base.getUTCMonth() + i + 1);
      const last = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
      ).getUTCDate();
      date = `${base.toISOString().slice(0, 7)}-${String(Math.min(anchor, last)).padStart(2, "0")}`;
    }
  }
  return result;
}
export function earningsAverage(rows: Record<string, any>[]) {
  const days = new Set(rows.map((r) => r.date)).size;
  const total = rows.reduce((s, r) => s + netEarnings(r as any).net, 0);
  return { days, total, average: days ? Math.round(total / days) : 0 };
}
