import { describe, expect, it } from "vitest";
import {
  cents,
  daysBetween,
  netEarnings,
  payoff,
  savings,
} from "../shared/finance";
import { schemas } from "../shared/schema";
describe("regras financeiras em centavos", () => {
  it("interpreta BRL sem erro de ponto flutuante", () => {
    expect(cents("R$ 1.234,56")).toBe(123456);
    expect(cents("0,29")).toBe(29);
    expect(cents("1.25")).toBe(125);
    expect(() => cents("1,234")).toThrow();
    expect(() => cents("")).toThrow();
  });
  it("usa lucro líquido, incluindo manutenção estimada", () => {
    expect(
      netEarnings({
        gross: 30000,
        fuel: 8000,
        food: 2000,
        maintenance: 1500,
        other: 500,
        hours: 8,
      }),
    ).toEqual({ net: 18000, hourly: 2250 });
    expect(netEarnings({ gross: 100, fuel: 200, hours: 0 })).toEqual({
      net: -100,
      hourly: null,
    });
  });
  it("reserva real permanece distinta da projeção", () => {
    const r = savings(
      {
        date: "2026-12-17",
        target: 1000000,
        reserved: 100000,
        dailyNet: 20000,
        workDays: 5,
        obligations: 150000,
        moving: 400000,
        contingency: 10,
        dailyVariable: 2000,
      },
      "2026-10-18",
    );
    expect(r.days).toBe(60);
    expect(r.remaining).toBe(900000);
    expect(r.daily).toBe(15000);
    expect(r.projected).toBe(710000);
    expect(r.progress).toBe(10);
  });
  it("a meta mínima inclui mudança, imprevistos e compromissos", () => {
    const r = savings(
      {
        date: "2026-10-25",
        target: 1,
        reserved: 100,
        dailyNet: 0,
        workDays: 0,
        obligations: 200,
        moving: 1000,
        contingency: 10,
        dailyVariable: 0,
      },
      "2026-10-18",
    );
    expect(r.target).toBe(1300);
    expect(r.netPerWorkday).toBeNull();
    expect(r.projected).toBe(-100);
  });
  it("não divide por zero após a mudança", () => {
    const r = savings(
      {
        date: "2026-10-17",
        target: 100,
        reserved: 200,
        dailyNet: 100,
        workDays: 7,
        obligations: 0,
        moving: 0,
        contingency: 0,
        dailyVariable: 0,
      },
      "2026-10-18",
    );
    expect(r.days).toBe(0);
    expect(r.daily).toBe(0);
    expect(r.progress).toBe(100);
  });
  it("não altera dívidas e limita pagamentos ao orçamento e saldo", () => {
    const debts = [
      { id: "a", amount: 10000, paid: 2000, interest_rate: 2 },
      { id: "b", amount: 5000, paid: 0, interest_rate: 8 },
    ];
    expect(payoff(debts, 6000, "snowball").map((x) => x.payment)).toEqual([
      5000, 1000,
    ]);
    expect(payoff(debts, 20000, "avalanche").map((x) => x.payment)).toEqual([
      5000, 8000,
    ]);
    expect(debts[0].paid).toBe(2000);
  });
  it("conta dias de calendário sem horário de verão", () =>
    expect(daysBetween("2026-10-18", "2026-10-19")).toBe(1));
  it("valida datas reais e rejeita valores financeiros inválidos", () => {
    expect(
      schemas.debts.safeParse({
        name: "A",
        creditor: "B",
        amount: -1,
        due_date: "2026-10-01",
      }).success,
    ).toBe(false);
    expect(
      schemas.debts.safeParse({
        name: "A",
        creditor: "B",
        amount: 100,
        due_date: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      schemas.daily_work_earnings.safeParse({
        date: "2026-10-18",
        gross: 10,
        hours: 25,
      }).success,
    ).toBe(false);
  });
});
import { dailyAllowance, payoffSchedule } from "../shared/finance";
describe("disponibilidade e quitação projetada", () => {
  it("nunca usa renda projetada como dinheiro disponível", () => {
    expect(dailyAllowance(0, 0, 0, 10000, 0)).toBe(0);
    expect(dailyAllowance(10000, 8000, 1000, 5000, 0)).toBe(1000);
    expect(dailyAllowance(10000, 0, 0, 1000, 1500)).toBe(0);
  });
  it("simula juros por mês e identifica orçamento insuficiente", () => {
    expect(
      payoffSchedule(
        [{ id: "a", amount: 100000, paid: 0, interest_rate: 0 }],
        25000,
        "snowball",
      ).months,
    ).toBe(4);
    expect(
      payoffSchedule(
        [{ id: "a", amount: 100000, paid: 0, interest_rate: 10 }],
        1000,
        "avalanche",
      ).months,
    ).toBeNull();
    expect(
      payoffSchedule(
        [{ id: "a", amount: 100000, paid: 0, interest_rate: 1 }],
        101000,
        "snowball",
      ).months,
    ).toBe(1);
  });
});
import { plannedOccurrences } from "../shared/finance";
describe("recorrências planejadas", () => {
  it("projeta meses curtos sem duplicar ocorrência realizada", () => {
    const rows = [
      {
        id: "a",
        name: "Conta",
        date: "2026-01-31",
        status: "planned",
        recurrence: "monthly",
        amount: 100,
      },
      {
        id: "b",
        recurrence_parent_id: "a",
        date: "2026-02-28",
        status: "realized",
        amount: 100,
      },
    ];
    expect(
      plannedOccurrences(rows, "2026-01-01", "2026-04-30").map((r) => r.date),
    ).toEqual(["2026-01-31", "2026-03-31", "2026-04-30"]);
  });
});
import { earningsAverage } from "../shared/finance";
it("agrupa turnos do mesmo dia antes de calcular lucro médio diário", () => {
  expect(
    earningsAverage([
      { date: "2026-10-18", gross: 10000 },
      { date: "2026-10-18", gross: 20000 },
      { date: "2026-10-19", gross: 10000 },
    ]),
  ).toEqual({ days: 2, total: 40000, average: 20000 });
});
describe("entrada monetária com vírgula e ponto", () => {
  it("aceita separadores decimais e agrupamentos sem alterar centavos", () => {
    for (const input of [
      "1234,56",
      "1234.56",
      "1.234,56",
      "1,234.56",
      "R$ 1.234,56",
    ])
      expect(cents(input)).toBe(123456);
    expect(cents("1.000")).toBe(100000);
    expect(cents("1.000.000")).toBe(100000000);
    expect(cents("-1.234,56")).toBe(-123456);
  });
  it("recusa agrupamentos incorretos e precisão excessiva", () => {
    for (const input of ["1.2.3", "1.23,45", "1,23.45", "12,345", "10,0001"])
      expect(() => cents(input)).toThrow();
  });
});
