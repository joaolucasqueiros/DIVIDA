import { describe, expect, it } from "vitest";
import { bankErrorMessage } from "../shared/bank-errors";
describe("diagnóstico bancário sem dados pessoais", () => {
  it("traduz o código oficial e omite mensagens livres", () => {
    const text = bankErrorMessage({
      message: "token=private-test-token",
      data: {
        item: {
          error: {
            code: "USER_AUTHORIZATION_NOT_GRANTED",
            providerMessage: "CPF pessoal oculto",
          },
          credentials: { password: "test-private-password" },
        },
      },
    });
    expect(text).toContain("USER_AUTHORIZATION_NOT_GRANTED");
    expect(text).toContain("consentimento");
    expect(text).not.toContain("private-test-token");
    expect(text).not.toContain("CPF pessoal");
    expect(text).not.toContain("test-private-password");
  });
  it("não transforma um erro desconhecido em acusação de credencial inválida", () => {
    const text = bankErrorMessage({
      message: "arbitrary private value",
      data: { item: { error: { code: "unrecognized-private-value" } } },
    });
    expect(text).toContain("painel Pluggy");
    expect(text).not.toContain("unrecognized-private-value");
    expect(text).not.toContain("arbitrary private value");
  });
  it("distingue timeout e carregamento do widget", () => {
    expect(
      bankErrorMessage({
        data: { item: { executionStatus: "USER_INPUT_TIMEOUT" } },
      }),
    ).toContain("prazo");
    expect(bankErrorMessage({ code: "WIDGET_LOAD_FAILED" })).toContain(
      "carregar",
    );
  });
});
