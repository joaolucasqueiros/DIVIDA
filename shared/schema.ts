import { z } from "zod";
const amount = z.number().int().min(0).max(900000000000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida",
  );
const text = z.string().trim().min(1).max(200);
const optionalText = z.string().max(2000).optional();
const id = z.string().uuid();
export const schemas = {
  profiles: z.object({
    name: text,
    display_name: text,
    email: z.string().email(),
  }),
  debts: z.object({
    name: text,
    creditor: text,
    fees: amount.default(0),
    contract_date: date.nullable().optional(),
    amount: amount.positive(),
    due_date: date,
    category: text.default("Outras"),
    description: optionalText,
    interest_rate: z.number().min(0).max(1000).default(0),
    priority: z.number().int().min(1).max(5).default(3),
    status: z
      .enum(["active", "negotiating", "installment", "archived"])
      .default("active"),
    installments: z.number().int().min(1).max(600).default(1),
    notes: optionalText,
  }),
  debt_installments: z.object({
    debt_id: id,
    amount: amount.positive(),
    due_date: date,
    number: z.number().int().positive(),
  }),
  payment_plans: z.object({
    debt_id: id,
    amount: amount.positive(),
    due_date: date,
    priority: z.number().int().min(1).max(5).default(3),
    notes: optionalText,
    status: z.enum(["pending", "cancelled"]).default("pending"),
  }),
  transactions: z.object({
    name: text,
    amount: amount.positive(),
    kind: z.enum(["income", "expense"]),
    category: text,
    date,
    status: z.enum(["realized", "planned"]).default("realized"),
    recurrence: z.enum(["none", "monthly"]).default("none"),
    classification: z
      .enum([
        "essential",
        "mandatory",
        "reducible",
        "deferrable",
        "dispensable",
      ])
      .default("essential"),
    source: z.literal("manual").default("manual"),
  }),
  bank_accounts: z.object({
    name: text,
    institution: text,
    balance: z.number().int().min(-900000000000).max(900000000000),
    currency: z.literal("BRL").default("BRL"),
    source: z.literal("manual").default("manual"),
  }),
  financial_goals: z.object({
    savings_goal_id: id.nullable().optional(),
    name: text,
    amount: amount.positive(),
    saved: amount.default(0),
    due_date: date,
  }),
  budgets: z.object({
    name: text,
    category: text,
    amount: amount.positive(),
    month: date,
  }),
  notes: z.object({
    name: text,
    description: optionalText,
    debt_id: id.nullable().optional(),
  }),
  reminders: z.object({
    name: text,
    due_date: date,
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .default("09:00"),
    recurrence: z.enum(["none", "monthly", "weekly"]).default("none"),
    done: z.boolean().default(false),
    debt_id: id.nullable().optional(),
  }),
  savings_goals: z.object({
    name: text,
    due_date: date,
    amount: amount.positive(),
    initial_reserved: amount.default(0),
    daily_income: amount.default(0),
    work_days: z.number().int().min(0).max(7).default(5),
    daily_variable: amount.default(0),
    contingency: z.number().min(0).max(100).default(10),
  }),
  savings_contributions: z.object({
    goal_id: id,
    amount: amount.positive(),
    date,
    purpose: text,
    account_id: id.nullable().optional(),
  }),
  savings_withdrawals: z.object({
    goal_id: id,
    amount: amount.positive(),
    date,
    reason: text,
    purpose: text,
  }),
  savings_budgets: z.object({
    goal_id: id,
    name: text,
    amount: amount.positive(),
    period: z.enum(["daily", "weekly"]),
    classification: z.enum([
      "essential",
      "mandatory",
      "reducible",
      "deferrable",
      "dispensable",
    ]),
  }),
  daily_work_earnings: z.object({
    date,
    gross: amount,
    fuel: amount.default(0),
    food: amount.default(0),
    maintenance: amount.default(0),
    other: amount.default(0),
    hours: z.number().positive().max(24),
  }),
  moving_expenses: z.object({
    goal_id: id,
    name: text,
    amount,
    actual: amount.nullable().default(null),
    priority: z.number().int().min(1).max(5).default(3),
    due_date: date,
    status: z.enum(["pending", "paid"]).default("pending"),
  }),
  savings_scenarios: z.object({
    goal_id: id,
    name: text,
    income_factor: z.number().min(0).max(3),
    expense_factor: z.number().min(0).max(3),
    work_days: z.number().int().min(0).max(7),
  }),
  user_settings: z.object({
    alerts_enabled: z.boolean().default(true),
    name: text,
    theme: z.enum(["light", "dark"]).default("light"),
    timezone: z.literal("America/Sao_Paulo").default("America/Sao_Paulo"),
  }),
};
export type Table = keyof typeof schemas;
