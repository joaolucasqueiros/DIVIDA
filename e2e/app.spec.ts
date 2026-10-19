import { expect, test } from "@playwright/test";
// Explicit test fixtures. No sample data is bundled into the production application.
const goal = {
  id: "40000000-0000-4000-8000-000000000001",
  name: "Minha mudança",
  due_date: "2026-12-17",
  amount: 1000000,
  initial_reserved: 100000,
  daily_income: 20000,
  work_days: 5,
  daily_variable: 2000,
  contingency: 10,
  created_at: "2026-10-18T00:00:00Z",
};
test("login exige e-mail e não apresenta finanças fictícias", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Um novo olhar para suas finanças" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Receber acesso por e-mail" }),
  ).toBeVisible();
  await expect(page.getByText("Saldo bancário sincronizado")).toHaveCount(0);
});
async function authenticated(page: any, fixtures: Record<string, any[]> = {}) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-localhost-auth-token",
      JSON.stringify({
        access_token: "test-session",
        refresh_token: "test-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "teste@example.test",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-10-18T00:00:00Z",
        },
      }),
    );
  });
  await page.route("**/api/alerts/refresh", async (route: any) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/data/**", async (route: any) => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    const rows = fixtures[table!] ?? (table === "savings_goals" ? [goal] : []);
    await route.fulfill({ json: { rows, total: rows.length } });
  });
}
test("navegação, reserva separada e registro de ganhos", async ({ page }) => {
  await authenticated(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tudo mais claro, a partir de agora." }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Modo Economia", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Minha mudança" }),
  ).toBeVisible();
  await expect(
    page.getByText("dinheiro efetivamente reservado", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("PROJEÇÃO • NÃO É SALDO DISPONÍVEL"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar ganho", exact: true })
    .click();
  await page.getByLabel("Receita bruta (R$)").fill("300,00");
  await page.getByLabel("Combustível (R$)").fill("80,00");
  const posted = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      r.url().endsWith("/api/data/daily_work_earnings"),
  );
  await page.getByRole("button", { name: "Salvar registro" }).click();
  const request = await posted;
  expect(request.postDataJSON()).toMatchObject({
    gross: 30000,
    fuel: 8000,
    hours: 8,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/clareza-desktop.png", fullPage: true });
});
test("menu móvel acessível e formulário de dívida", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticated(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page
    .getByRole("button", { name: "Minhas dívidas", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo registro" }).click();
  await expect(page.getByLabel("Nome da dívida")).toBeVisible();
  await expect(page.getByLabel("Vencimento", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/clareza-mobile.png", fullPage: true });
});

test("círculo compara saldo e dívida líquida sem somar origens", async ({
  page,
}) => {
  const debt = {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Dívida teste",
    amount: 100000,
    fees: 10000,
    paid: 30000,
    due_date: "2026-12-01",
    status: "active",
    created_at: "2026-10-18T12:00:00Z",
  };
  await authenticated(page, {
    debts: [debt],
    bank_accounts: [
      { id: "a", name: "Banco", source: "pluggy", balance: 120000 },
      { id: "b", name: "Manual", source: "manual", balance: 40000 },
    ],
  });
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Equilíbrio entre saldo e dívidas",
  });
  await expect(panel.getByRole("img")).toHaveAttribute(
    "aria-label",
    /150% de cobertura/,
  );
  await expect(panel).toContainText("R$ 800,00");
  await panel.getByLabel("Origem do saldo no círculo").selectOption("manual");
  await expect(panel.getByRole("img")).toHaveAttribute(
    "aria-label",
    /50% de cobertura/,
  );
  await expect(panel).toContainText("Falta para cobrir as dívidas");
  debt.paid = 70000;
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(panel.getByRole("img")).toHaveAttribute(
    "aria-label",
    /100% de cobertura/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: "/tmp/clareza-balance-arc.png",
    animations: "disabled",
  });
});
test("círculo distingue ausência de saldo de equilíbrio financeiro", async ({
  page,
}) => {
  await authenticated(page);
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Equilíbrio entre saldo e dívidas",
  });
  await expect(panel).toContainText("Informe seu saldo");
  await expect(panel).toContainText("Não informado");
  await expect(panel.getByRole("img")).toHaveAttribute(
    "aria-label",
    /Cadastre um saldo/,
  );
});
test("valores em blocos e pagamento com formatação BRL", async ({ page }) => {
  const debt = {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Cartão teste",
    amount: 200000,
    fees: 0,
    paid: 0,
    due_date: "2026-12-01",
    status: "active",
    created_at: "2026-10-18T12:00:00Z",
  };
  await authenticated(page, {
    debts: [debt],
    bank_accounts: [{ source: "manual", balance: 40000 }],
  });
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Equilíbrio entre saldo e dívidas",
  });
  await expect(panel.locator(".balance-values .negative")).toHaveCount(2);
  await expect(panel.locator(".balance-values .positive")).toHaveCount(1);
  await panel.screenshot({
    path: "/tmp/clareza-compact-desktop.png",
    animations: "disabled",
  });
  const gauge = await panel.locator("svg").boundingBox(),
    blocks = await panel.locator(".balance-values").boundingBox();
  expect(gauge!.x + gauge!.width).toBeLessThan(blocks!.x);
  await page
    .locator("nav")
    .getByRole("button", { name: "Minhas dívidas", exact: true })
    .click();
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  const amount = page.getByLabel("Valor do pagamento (R$)");
  for (const raw of ["1234.56", "1.234,56", "1,234.56"]) {
    await amount.fill(raw);
    await amount.blur();
    await expect(amount).toHaveValue("1.234,56");
  }
  await page.route("**/api/payment", (route) =>
    route.fulfill({ json: { id: "payment-test" } }),
  );
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/payment") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  expect((await request).postDataJSON().amount).toBe(123456);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("conexão bancária informa configuração pendente sem solicitar senha", async ({
  page,
}) => {
  await authenticated(page);
  await page.route("**/api/bank/status", (route) =>
    route.fulfill({
      json: {
        configured: false,
        allowed: true,
        missing: ["PLUGGY_CLIENT_ID", "PLUGGY_CLIENT_SECRET"],
        message: "Configure suas credenciais Pluggy no servidor.",
      },
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Contas e saldos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Conectar banco", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Conexão bancária ainda não ativada", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  await page.route("**/api/bank/status", (route) =>
    route.fulfill({
      json: {
        configured: true,
        allowed: true,
        missing: [],
        message: "Pronto para conectar.",
      },
    }),
  );
  await page.getByRole("button", { name: "Verificar configuração" }).click();
  await expect(
    page.getByRole("button", { name: "Conectar banco", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/bank/connect-token", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Provedor temporariamente indisponível." },
    }),
  );
  const tokenRequest = page.waitForRequest((r) =>
    r.url().endsWith("/api/bank/connect-token"),
  );
  await page
    .getByRole("button", { name: "Conectar banco", exact: true })
    .click();
  expect((await tokenRequest).postDataJSON()).toEqual({});
  await expect(
    page.getByText("Provedor temporariamente indisponível."),
  ).toBeVisible();
});
test("saldo de conexão revogada sai do círculo e histórico permanece consultável", async ({
  page,
}) => {
  const cid = "10000000-0000-4000-8000-000000000001";
  const connection = {
    id: cid,
    name: "Banco teste",
    status: "active",
    provider_item_id: "20000000-0000-4000-8000-000000000001",
  };
  const account = {
    id: "account-test",
    name: "Conta BRL",
    institution: "Banco teste",
    source: "pluggy",
    balance: 90000,
    included_in_balance: true,
    created_at: "2026-10-18T15:00:00Z",
  };
  await authenticated(page, {
    bank_connections: [connection],
    bank_accounts: [account],
  });
  await page.route("**/api/bank/status", (route) =>
    route.fulfill({ json: { configured: true, allowed: true, missing: [] } }),
  );
  await page.route("**/api/bank/disconnect", (route) => {
    connection.status = "disconnected";
    account.included_in_balance = false;
    return route.fulfill({
      json: { message: "Conexão revogada. Histórico preservado." },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Equilíbrio entre saldo e dívidas" }),
  ).toContainText("R$ 900,00");
  await page
    .locator("nav")
    .getByRole("button", { name: "Contas e saldos", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/api/bank/disconnect"),
  );
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  expect((await request).postDataJSON()).toEqual({ connectionId: cid });
  await expect(page.getByText("Desconectada", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell").filter({ hasText: "Conta BRL" }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Visão geral", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Equilíbrio entre saldo e dívidas" }),
  ).toContainText("Não informado");
});
test("botão de conexão abre o widget oficial com token temporário", async ({
  page,
}) => {
  await authenticated(page);
  await page.route("**/api/bank/status", (route) =>
    route.fulfill({ json: { configured: true, allowed: true, missing: [] } }),
  );
  await page.route("**/api/bank/connect-token", (route) =>
    route.fulfill({
      json: { connectToken: "test-widget-token", connectorIds: [1] },
    }),
  );
  // Only the external iframe is stubbed; the real installed React/Pluggy SDK boots.
  await page.route("https://connect.pluggy.ai/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="pt-BR"><p>Autorização bancária simulada no teste</p></html>',
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Contas e saldos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Conectar banco", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Conectar banco", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page
          .frames()
          .filter((frame) =>
            frame.url().startsWith("https://connect.pluggy.ai"),
          ).length,
    )
    .toBe(1);
  await expect(
    page.getByRole("heading", { name: "Conectar meu banco" }),
  ).toBeVisible();
});
test("sucesso do widget registra somente o item e atualiza as conexões", async ({
  page,
}) => {
  const itemId = "20000000-0000-4000-8000-000000000001";
  await authenticated(page);
  await page.route("**/api/bank/status", (route) =>
    route.fulfill({ json: { configured: true, allowed: true, missing: [] } }),
  );
  await page.route("**/api/bank/connect-token", (route) =>
    route.fulfill({
      json: { connectToken: "test-widget-token", connectorIds: [1] },
    }),
  );
  // This separate test stubs the SDK callback; the previous test boots the real SDK.
  await page.route(
    "**/node_modules/.vite/deps/pluggy-connect-sdk.js*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `export class PluggyConnect { constructor(options){this.options=options;} init(container){const button=document.createElement('button');button.textContent='Autorizar banco de teste';button.onclick=()=>this.options.onSuccess({item:{id:'${itemId}'}});container.append(button);return Promise.resolve();} destroy(){} }`,
      }),
  );
  await page.route("**/api/bank/connections", (route) =>
    route.fulfill({
      json: {
        connected: true,
        accounts: 1,
        message: "Autorização registrada pelo servidor.",
      },
    }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Contas e saldos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conectar banco", exact: true })
    .click();
  const registration = page.waitForRequest((r) =>
    r.url().endsWith("/api/bank/connections"),
  );
  await page.getByRole("button", { name: "Autorizar banco de teste" }).click();
  expect((await registration).postDataJSON()).toEqual({ itemId });
  await expect(
    page.getByText("Autorização registrada pelo servidor.", { exact: true }),
  ).toBeVisible();
});
test("falha do consentimento mostra código do provedor sem expor mensagem pessoal", async ({
  page,
}) => {
  await authenticated(page);
  await page.route("**/api/bank/status", (route) =>
    route.fulfill({ json: { configured: true, allowed: true, missing: [] } }),
  );
  await page.route("**/api/bank/connect-token", (route) =>
    route.fulfill({
      json: { connectToken: "test-widget-token", connectorIds: [1] },
    }),
  );
  await page.route(
    "**/node_modules/.vite/deps/pluggy-connect-sdk.js*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `export class PluggyConnect { constructor(options){this.options=options;} init(container){const button=document.createElement('button');button.textContent='Simular autorização recusada';button.onclick=()=>this.options.onError({message:'private-message-test',data:{item:{error:{code:'USER_AUTHORIZATION_NOT_GRANTED',providerMessage:'private-cpf-test'}}}});container.append(button);return Promise.resolve();} destroy(){} }`,
      }),
  );
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Contas e saldos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conectar banco", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simular autorização recusada" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "USER_AUTHORIZATION_NOT_GRANTED",
  );
  await expect(page.getByRole("alert")).not.toContainText(
    "private-message-test",
  );
  await expect(page.getByRole("alert")).not.toContainText("private-cpf-test");
});
