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
async function authenticated(page: any) {
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
    const rows = table === "savings_goals" ? [goal] : [];
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
