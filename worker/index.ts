import { bankRoute, syncBanks, BankError } from "./bank";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { schemas, type Table } from "../shared/schema";
import { today } from "../shared/finance";
interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_URL: string;
  PLUGGY_CLIENT_ID?: string;
  PLUGGY_CLIENT_SECRET?: string;
  OWNER_USER_ID?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const readable = new Set([
  ...Object.keys(schemas),
  "debt_payments",
  "bank_balance_history",
  "bank_connections",
  "calendar_events",
  "audit_logs",
  "import_jobs",
  "import_rows",
  "savings_alerts",
  "transaction_import_rows",
]);
function must(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}
function admin(env: Env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Integração requer configuração segura do servidor.");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
async function requestJSON(url: string, init: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw Error(`Provedor indisponível (${r.status}).`);
  return r.json() as Promise<any>;
}
async function crypt(env: Env, value: string, decrypt = false) {
  if (!env.TOKEN_ENCRYPTION_KEY)
    throw Error("Criptografia da integração não configurada.");
  const raw = Uint8Array.from(atob(env.TOKEN_ENCRYPTION_KEY), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  if (decrypt) {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes.slice(0, 12) },
        key,
        bytes.slice(12),
      ),
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(value),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...cipher));
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname === "/api/health")
      return json({
        ok: true,
        configured: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY,
      });
    try {
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)
        return json(
          { error: "Configure Supabase no Worker e aplique as migrações." },
          503,
        );
      if (url.pathname === "/api/calendar/callback")
        return await googleCallback(request, env);
      const token = request.headers
        .get("Authorization")
        ?.replace(/^Bearer /, "");
      if (!token) return json({ error: "Autenticação necessária." }, 401);
      const db = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      const {
        data: { user },
        error,
      } = await db.auth.getUser(token);
      if (error || !user)
        return json({ error: "Sessão expirada. Entre novamente." }, 401);
      if (
        request.method !== "GET" &&
        request.headers.get("Origin") &&
        request.headers.get("Origin") !==
          new URL(env.APP_URL || request.url).origin
      )
        return json({ error: "Origem inválida." }, 403);
      if (Number(request.headers.get("Content-Length") || 0) > 2_000_000)
        return json({ error: "Arquivo muito grande." }, 413);
      const body = async () => {
        const text = await request.text();
        if (text.length > 2_000_000) throw Error("Limite de 2 MB excedido");
        return JSON.parse(text);
      };
      if (
        url.pathname === "/api/transactions/realize" &&
        request.method === "POST"
      ) {
        const p = z
          .object({
            id: z.string().uuid(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(await body());
        const r = await db.rpc("realize_transaction", {
          p_id: p.id,
          p_date: p.date,
        });
        must(r);
        return json({ id: r.data });
      }
      if (url.pathname === "/api/alerts/refresh" && request.method === "POST") {
        const r = await db.rpc("refresh_savings_alerts");
        must(r);
        return json({ count: r.data });
      }
      if (url.pathname === "/api/payment" && request.method === "POST") {
        const p = z
          .object({
            debt_id: z.string().uuid(),
            amount: z.number().int().min(-900000000000).max(900000000000),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            key: z.string().uuid(),
            notes: z.string().max(2000).default(""),
            reversal: z.string().uuid().nullable().default(null),
            plan: z.string().uuid().nullable().default(null),
          })
          .parse(await body());
        const r = await db.rpc("record_payment", {
          p_debt_id: p.debt_id,
          p_amount: p.amount,
          p_date: p.date,
          p_key: p.key,
          p_notes: p.notes,
          p_reversal: p.reversal,
          p_plan: p.plan,
        });
        must(r);
        return json({ id: r.data });
      }
      if (
        url.pathname === "/api/import/statement" &&
        request.method === "POST"
      ) {
        const p = z
          .object({ rows: z.array(schemas.transactions).min(1).max(1000) })
          .parse(await body());
        const r = await db.rpc("import_statement", { p_rows: p.rows });
        must(r);
        return json({ imported: r.data });
      }
      if (url.pathname === "/api/import" && request.method === "POST") {
        const p = z
          .object({
            name: z.string().max(200),
            fingerprint: z.string().length(64),
            rows: z.array(schemas.debts).min(1).max(1000),
          })
          .parse(await body());
        const r = await db.rpc("import_debts", {
          p_name: p.name,
          p_fingerprint: p.fingerprint,
          p_rows: p.rows,
        });
        must(r);
        return json({ imported: r.data });
      }
      if (url.pathname.startsWith("/api/bank/"))
        return json(
          await bankRoute(url.pathname, request.method, body, env, user.id, db),
        );
      if (
        url.pathname === "/api/calendar/connect" &&
        request.method === "POST"
      ) {
        if (
          !env.GOOGLE_CLIENT_ID ||
          !env.GOOGLE_CLIENT_SECRET ||
          !env.TOKEN_ENCRYPTION_KEY
        )
          return json(
            { error: "Google Calendar não configurado no servidor." },
            503,
          );
        const state = await crypt(
          env,
          JSON.stringify({
            uid: user.id,
            exp: Date.now() + 600000,
            nonce: crypto.randomUUID(),
          }),
        );
        const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        u.search = new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          redirect_uri: `${env.APP_URL}/api/calendar/callback`,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
          state,
        }).toString();
        const response = json({ url: u.toString() });
        response.headers.set(
          "Set-Cookie",
          `clareza_oauth=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/calendar/callback; Max-Age=600${env.APP_URL.startsWith("https:") ? "; Secure" : ""}`,
        );
        return response;
      }
      if (url.pathname === "/api/calendar/sync" && request.method === "POST")
        return json(await calendarSync(env, db, user.id));
      if (
        url.pathname === "/api/calendar/disconnect" &&
        request.method === "POST"
      ) {
        const r = await admin(env)
          .from("integration_tokens")
          .select("ciphertext")
          .eq("user_id", user.id)
          .maybeSingle();
        must(r);
        if (r.data) {
          const t = JSON.parse(await crypt(env, r.data.ciphertext, true));
          const rev = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: t.refresh_token || t.access_token,
            }),
          });
          if (!rev.ok) throw Error("Falha ao revogar autorização Google.");
        }
        must(
          await admin(env)
            .from("integration_tokens")
            .delete()
            .eq("user_id", user.id),
        );
        return json({ ok: true });
      }
      if (url.pathname === "/api/account" && request.method === "DELETE") {
        const p = z
          .object({ confirmation: z.literal("EXCLUIR") })
          .parse(await body());
        void p;
        const a = admin(env);
        const files = await a.storage
          .from("documents")
          .list(user.id, { limit: 1000 });
        must(files);
        if (files.data?.length) {
          must(
            await a.storage
              .from("documents")
              .remove(files.data.map((f) => `${user.id}/${f.name}`)),
          );
          for (;;) {
            const more = await a.storage
              .from("documents")
              .list(user.id, { limit: 1000 });
            must(more);
            if (!more.data?.length) break;
            must(
              await a.storage
                .from("documents")
                .remove(more.data.map((f) => `${user.id}/${f.name}`)),
            );
          }
        }
        must(await a.auth.admin.deleteUser(user.id));
        return json({ ok: true });
      }
      const match = url.pathname.match(
        /^\/api\/data\/([a-z_]+)(?:\/([0-9a-f-]{36}))?$/,
      );
      if (match && readable.has(match[1])) {
        const table = match[1] as Table,
          id = match[2];
        if (request.method === "GET") {
          const offset = Math.max(
            0,
            Number(url.searchParams.get("offset")) || 0,
          );
          const r = await db
            .from(table)
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .order("id")
            .range(offset, offset + 199);
          must(r);
          return json({ rows: r.data, total: r.count });
        }
        if (!(table in schemas))
          return json({ error: "Somente leitura." }, 405);
        if (request.method === "POST" || (request.method === "PATCH" && id)) {
          const parsed = schemas[table].parse(await body());
          if (table === "bank_accounts" && id) {
            const prior = await db
              .from(table)
              .select("source")
              .eq("id", id)
              .single();
            must(prior);
            if (prior.data?.source !== "manual")
              return json(
                { error: "Conta sincronizada: atualize pelo banco." },
                403,
              );
          }
          const r =
            request.method === "POST"
              ? await db
                  .from(table)
                  .insert({ ...parsed, user_id: user.id })
                  .select()
                  .single()
              : await db
                  .from(table)
                  .update(parsed)
                  .eq("id", id)
                  .eq("user_id", user.id)
                  .select()
                  .single();
          must(r);
          return json(r.data, request.method === "POST" ? 201 : 200);
        }
      }
      return json({ error: "Rota não encontrada." }, 404);
    } catch (e) {
      return json(
        {
          error:
            e instanceof z.ZodError
              ? e.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; ")
              : e instanceof Error
                ? e.message
                : "Operação não concluída.",
        },
        e instanceof BankError ? e.status : 400,
      );
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (
      env.OWNER_USER_ID &&
      env.PLUGGY_CLIENT_ID &&
      env.PLUGGY_CLIENT_SECRET &&
      env.SUPABASE_SERVICE_ROLE_KEY
    )
      ctx.waitUntil(
        syncBanks(env, env.OWNER_USER_ID).catch(() => {
          console.error("Bank synchronization failed");
        }),
      );
  },
};
async function googleCallback(request: Request, env: Env) {
  const u = new URL(request.url);
  const state = u.searchParams.get("state");
  const code = u.searchParams.get("code");
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("clareza_oauth="))
    ?.slice(14);
  if (!state || !code || decodeURIComponent(cookie || "") !== state)
    return json({ error: "Autorização cancelada ou inválida." }, 400);
  const parsed = JSON.parse(await crypt(env, state, true));
  if (parsed.exp < Date.now() || !parsed.uid)
    return json({ error: "Autorização expirada." }, 400);
  const token = await requestJSON("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${env.APP_URL}/api/calendar/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!token.refresh_token)
    throw Error("Google não retornou autorização persistente. Reconecte.");
  must(
    await admin(env)
      .from("integration_tokens")
      .upsert({
        user_id: parsed.uid,
        ciphertext: await crypt(env, JSON.stringify(token)),
      }),
  );
  return Response.redirect(`${env.APP_URL}/?calendar=connected`, 303);
}
async function calendarSync(env: Env, db: SupabaseClient, uid: string) {
  const a = admin(env);
  const r = await a
    .from("integration_tokens")
    .select("ciphertext")
    .eq("user_id", uid)
    .single();
  if (r.error) throw Error("Conecte sua conta Google primeiro.");
  const saved = JSON.parse(await crypt(env, r.data.ciphertext, true));
  const token = await requestJSON("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: saved.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const reminders = await db.from("reminders").select("*").eq("done", false);
  must(reminders);
  let count = 0;
  for (const reminder of reminders.data || []) {
    // Google IDs accept base32hex; UUID hex without hyphens is a stable idempotency key.
    const eventId = reminder.id.replaceAll("-", "");
    const start = new Date(`${reminder.due_date}T${reminder.time}:00-03:00`);
    const end = new Date(start.getTime() + 1800000);
    const event = {
      id: eventId,
      summary: reminder.name,
      description: `Clareza • lembrete ${reminder.id}${reminder.debt_id ? ` • dívida ${reminder.debt_id}` : ""}`,
      start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
      ...(reminder.recurrence !== "none"
        ? {
            recurrence: [
              `RRULE:FREQ=${reminder.recurrence === "weekly" ? "WEEKLY" : "MONTHLY"}`,
            ],
          }
        : {}),
    };
    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    };
    let response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      { method: "POST", headers, body: JSON.stringify(event) },
    );
    if (response.status === 409)
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        { method: "PUT", headers, body: JSON.stringify(event) },
      );
    if (!response.ok)
      throw Error(`Google Calendar retornou ${response.status}.`);
    must(
      await a
        .from("calendar_events")
        .upsert(
          { user_id: uid, reminder_id: reminder.id, google_event_id: eventId },
          { onConflict: "user_id,reminder_id" },
        ),
    );
    count++;
  }
  return { events: count };
}
