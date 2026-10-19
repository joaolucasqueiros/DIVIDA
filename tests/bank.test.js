import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
import { createClient } from "@supabase/supabase-js";
import {
  bankRoute,
  eligibleConnector,
  normalizeAccounts,
  ownedItem,
  syncBanks,
} from "../worker/bank";
const uid = "00000000-0000-4000-8000-000000000001",
  cid = "10000000-0000-4000-8000-000000000001",
  iid = "20000000-0000-4000-8000-000000000001";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "server-test-only",
  OWNER_USER_ID: uid,
  PLUGGY_CLIENT_ID: "test-client",
  PLUGGY_CLIENT_SECRET: "test-secret",
};
const connector = {
  id: 1,
  name: "Banco de teste",
  country: "BR",
  type: "PERSONAL_BANK",
  isOpenFinance: true,
  isSandbox: false,
};
const item = {
  id: iid,
  clientUserId: uid,
  connector,
  status: "UPDATED",
  lastUpdatedAt: "2026-10-18T15:00:00Z",
  consentExpiresAt: "2099-10-18T15:00:00Z",
};
let rows, db, fetchMock;
function query() {
  const filters = [];
  let update;
  const q = {
    select: () => q,
    eq: (k, v) => {
      filters.push([k, v]);
      return q;
    },
    limit: () => q,
    update: (v) => {
      update = v;
      return q;
    },
    maybeSingle: async () => ({
      data: rows.find((r) => filters.every(([k, v]) => r[k] === v)) || null,
      error: null,
    }),
    then: (yes, no) => {
      const matched = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
      if (update) matched.forEach((r) => Object.assign(r, update));
      return Promise.resolve({ data: matched, error: null }).then(yes, no);
    },
  };
  return q;
}
beforeEach(() => {
  rows = [
    {
      id: cid,
      user_id: uid,
      provider_item_id: iid,
      name: "Banco de teste",
      status: "active",
    },
  ];
  db = {
    from: vi.fn(() => query()),
    rpc: vi.fn(async (name) => {
      if (name === "begin_bank_disconnect") rows[0].status = "disconnecting";
      return {
        data:
          name === "register_bank_connection"
            ? cid
            : name === "apply_bank_snapshot"
              ? 1
              : iid,
        error: null,
      };
    }),
  };
  createClient.mockReturnValue(db);
  fetchMock = vi.fn(async (url, init) => {
    const path = new URL(url).pathname;
    if (path === "/auth") return Response.json({ apiKey: "server-api-key" });
    if (path === "/connect_token")
      return Response.json({ accessToken: "short-lived-connect-token" });
    if (path === "/connectors")
      return Response.json({
        results: [connector, { ...connector, id: 2, isOpenFinance: false }],
      });
    if (path === `/items/${iid}`)
      return init.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json(item);
    if (path === "/accounts")
      return Response.json({
        results: [
          {
            id: "account-1",
            name: "Conta corrente",
            type: "BANK",
            currencyCode: "BRL",
            balance: 100.25,
          },
          {
            id: "card-1",
            name: "Cartão",
            type: "CREDIT",
            currencyCode: "BRL",
            balance: 9999,
          },
        ],
        totalPages: 1,
      });
    throw Error("Unexpected provider path");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
describe("Open Finance consent and authorization", () => {
  it("limits eligible institutions to Brazilian personal Open Finance outside sandbox", () => {
    expect(eligibleConnector(connector)).toBe(true);
    for (const c of [
      { ...connector, isSandbox: true },
      { ...connector, isOpenFinance: false },
      { ...connector, type: "BUSINESS_BANK" },
      { ...connector, country: "US" },
    ])
      expect(eligibleConnector(c)).toBe(false);
  });
  it("rejects adopting someone else’s item, even if the browser reports success", () => {
    expect(() =>
      ownedItem({ ...item, clientUserId: "other-user" }, uid),
    ).toThrow("não pertence");
    expect(() => ownedItem({ ...item, clientUserId: null }, uid)).toThrow(
      "não pertence",
    );
  });
  it("does not contact providers without server credentials or for another user", async () => {
    await expect(
      bankRoute(
        "/api/bank/connect-token",
        "POST",
        async () => ({}),
        {},
        uid,
        db,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      bankRoute(
        "/api/bank/connect-token",
        "POST",
        async () => ({}),
        env,
        "someone-else",
        db,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("issues a scoped ephemeral widget token with the authenticated user id", async () => {
    const result = await bankRoute(
      "/api/bank/connect-token",
      "POST",
      async () => ({}),
      env,
      uid,
      db,
    );
    expect(result).toEqual({
      connectToken: "short-lived-connect-token",
      connectorIds: [1],
    });
    const call = fetchMock.mock.calls.find(([url]) =>
      url.endsWith("/connect_token"),
    );
    expect(JSON.parse(call[1].body)).toEqual({
      options: { clientUserId: uid, avoidDuplicates: true },
    });
    expect(JSON.stringify(result)).not.toContain(env.PLUGGY_CLIENT_SECRET);
    expect(JSON.stringify(result)).not.toContain("server-api-key");
  });
  it("requires an owned active connection for renewal", async () => {
    rows[0].status = "disconnected";
    await expect(
      bankRoute(
        "/api/bank/connect-token",
        "POST",
        async () => ({ connectionId: cid }),
        env,
        uid,
        db,
      ),
    ).rejects.toThrow("revogada");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("registers verified consent and snapshots only eligible BRL bank balances", async () => {
    const result = await bankRoute(
      "/api/bank/connections",
      "POST",
      async () => ({ itemId: iid }),
      env,
      uid,
      db,
    );
    expect(result.connected).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith(
      "register_bank_connection",
      expect.objectContaining({
        p_user: uid,
        p_name: "Banco de teste",
        p_item: iid,
      }),
    );
    expect(db.rpc).toHaveBeenCalledWith(
      "apply_bank_snapshot",
      expect.objectContaining({
        p_accounts: [
          {
            provider_id: "account-1",
            name: "Conta corrente",
            balance: 10025,
            currency: "BRL",
          },
        ],
      }),
    );
  });
  it("excludes null balances, credit cards and other currencies without inventing zero", () => {
    expect(
      normalizeAccounts([
        {
          id: "a",
          name: "Conta",
          type: "BANK",
          currencyCode: "BRL",
          balance: null,
        },
        {
          id: "b",
          name: "Dólar",
          type: "BANK",
          currencyCode: "USD",
          balance: 100,
        },
      ]),
    ).toEqual([]);
    expect(() =>
      normalizeAccounts([
        {
          id: "a",
          name: "Conta",
          type: "BANK",
          currencyCode: "BRL",
          balance: Infinity,
        },
      ]),
    ).toThrow();
  });
  it("preserves existing snapshots when provider data is still updating", async () => {
    fetchMock.mockImplementation(async (url) =>
      url.endsWith("/auth")
        ? Response.json({ apiKey: "key" })
        : Response.json({ ...item, status: "UPDATING" }),
    );
    const result = await syncBanks(env, uid);
    expect(result.message).toContain("atualizando");
    expect(db.rpc).not.toHaveBeenCalledWith(
      "apply_bank_snapshot",
      expect.anything(),
    );
  });
  it("marks a failed revocation pending and allows a safe retry without reconnecting", async () => {
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, init) =>
      init.method === "DELETE"
        ? Promise.resolve(new Response(null, { status: 503 }))
        : original(url, init),
    );
    await expect(
      bankRoute(
        "/api/bank/disconnect",
        "POST",
        async () => ({ connectionId: cid }),
        env,
        uid,
        db,
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(rows[0].status).toBe("disconnecting");
    fetchMock.mockImplementation(original);
    await bankRoute(
      "/api/bank/disconnect",
      "POST",
      async () => ({ connectionId: cid }),
      env,
      uid,
      db,
    );
    expect(rows[0].status).toBe("disconnected");
    expect(db.rpc).toHaveBeenCalledWith("begin_bank_disconnect", {
      p_user: uid,
      p_connection: cid,
    });
  });
  it("does not list another user’s configuration as ready", async () => {
    const result = await bankRoute(
      "/api/bank/status",
      "GET",
      async () => ({}),
      env,
      "other-user",
      db,
    );
    expect(result.allowed).toBe(false);
    expect(result.configured).toBe(false);
    expect(db.from).not.toHaveBeenCalled();
  });
});
it("rejects renewal when the provider item belongs to someone else", async () => {
  fetchMock.mockImplementation(async (url) =>
    url.endsWith("/auth")
      ? Response.json({ apiKey: "key" })
      : Response.json({ ...item, clientUserId: "other-user" }),
  );
  await expect(
    bankRoute(
      "/api/bank/connect-token",
      "POST",
      async () => ({ connectionId: cid }),
      env,
      uid,
      db,
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(
    fetchMock.mock.calls.some(([url]) => url.endsWith("/connect_token")),
  ).toBe(false);
});
