import { describe, expect, it } from "vitest";
import worker from "../worker/index";
describe("Worker HTTP contract without external credentials", () => {
  it("reports missing configuration honestly", async () => {
    const r = await worker.fetch(
      new Request("https://clareza.test/api/health"),
      {},
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, configured: false });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("refuses unconfigured financial operations", async () => {
    const r = await worker.fetch(
      new Request("https://clareza.test/api/payment", { method: "POST" }),
      {},
    );
    expect(r.status).toBe(503);
  });
  it("requires authentication for private routes", async () => {
    const r = await worker.fetch(
      new Request("https://clareza.test/api/data/debts"),
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "test-public",
      },
    );
    expect(r.status).toBe(401);
  });
  it("serves app assets separately from the API", async () => {
    let path = "";
    const r = await worker.fetch(new Request("https://clareza.test/"), {
      ASSETS: {
        fetch: async (req) => {
          path = new URL(req.url).pathname;
          return new Response("app");
        },
      },
    });
    expect(path).toBe("/");
    expect(await r.text()).toBe("app");
  });
});
