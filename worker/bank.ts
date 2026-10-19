import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
export interface BankEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OWNER_USER_ID?: string;
  PLUGGY_CLIENT_ID?: string;
  PLUGGY_CLIENT_SECRET?: string;
}
export class BankError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const required = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_USER_ID",
  "PLUGGY_CLIENT_ID",
  "PLUGGY_CLIENT_SECRET",
] as const;
const itemId = z.string().uuid();
const connector = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(200),
  country: z.string(),
  type: z.string(),
  isOpenFinance: z.boolean(),
  isSandbox: z.boolean(),
});
const itemSchema = z.object({
  id: itemId,
  clientUserId: z.string().nullable(),
  connector,
  status: z.string(),
  lastUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
  consentExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  statusDetail: z
    .object({
      accounts: z.object({ isUpdated: z.boolean() }).nullable().optional(),
    })
    .nullable()
    .optional(),
});
function missing(env: BankEnv) {
  return required.filter((k) => !env[k]);
}
function assertOwner(env: BankEnv, uid: string) {
  if (!env.OWNER_USER_ID)
    throw new BankError(
      "Configure o proprietário da integração bancária no servidor.",
      503,
    );
  if (uid !== env.OWNER_USER_ID)
    throw new BankError(
      "A conexão bancária está disponível apenas para o proprietário.",
      403,
    );
}
function configured(env: BankEnv, uid: string) {
  assertOwner(env, uid);
  if (missing(env).length)
    throw new BankError(
      "Conexão bancária ainda não configurada. Consulte o guia de ativação.",
      503,
    );
}
function admin(env: BankEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
function check(r: { error: { message: string } | null }) {
  if (
    r.error?.message.includes("Connection was revoked") ||
    r.error?.message.includes("Connection is not active")
  )
    throw new BankError(
      "Esta conexão foi revogada ou está sendo desconectada. Crie uma nova autorização.",
      409,
    );
  if (r.error?.message.includes("Maximum active connections"))
    throw new BankError(
      "Você atingiu o limite de dez conexões ativas. Desconecte uma antes de adicionar outra.",
      409,
    );
  if (r.error)
    throw new BankError(
      "Não foi possível acessar a integração bancária. Aplique a migração 006_bank_connect.sql e tente novamente.",
      503,
    );
}
export function eligibleConnector(c: z.infer<typeof connector>) {
  return (
    c.country === "BR" &&
    c.type === "PERSONAL_BANK" &&
    c.isOpenFinance === true &&
    c.isSandbox === false
  );
}
export function ownedItem(raw: unknown, uid: string) {
  const item = itemSchema.parse(raw);
  if (item.clientUserId !== uid)
    throw new BankError(
      "Esta conexão não pertence ao usuário autenticado.",
      403,
    );
  if (!eligibleConnector(item.connector))
    throw new BankError(
      "Use uma conexão Open Finance de pessoa física no Brasil, fora do sandbox.",
    );
  return item;
}
const bankAccount = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  type: z.string(),
  currencyCode: z.string(),
  balance: z.number().finite().nullable(),
});
export function normalizeAccounts(raw: unknown) {
  const rows = z.array(bankAccount).max(500).parse(raw);
  const seen = new Set<string>();
  return rows
    .filter(
      (a) =>
        a.type === "BANK" && a.currencyCode === "BRL" && a.balance !== null,
    )
    .map((a) => {
      if (seen.has(a.id))
        throw new BankError(
          "O provedor retornou contas duplicadas. Tente novamente.",
        );
      seen.add(a.id);
      const balance = Math.round(a.balance! * 100);
      if (!Number.isSafeInteger(balance) || Math.abs(balance) > 900000000000)
        throw new BankError(
          "O provedor retornou um saldo fora do limite suportado.",
        );
      return { provider_id: a.id, name: a.name, currency: "BRL", balance };
    });
}
async function provider(
  path: string,
  key?: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  let response: Response;
  try {
    response = await fetch(`https://api.pluggy.ai/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "X-API-KEY": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new BankError(
      "O Pluggy não respondeu. Tente novamente em alguns minutos.",
      502,
    );
  }
  if (method === "DELETE" && (response.ok || response.status === 404))
    return null;
  if (!response.ok)
    throw new BankError(
      response.status === 401 || response.status === 403
        ? "Credenciais ou permissões Pluggy inválidas. Revise a configuração do servidor."
        : response.status === 429
          ? "Limite de consultas do Pluggy atingido. Aguarde antes de tentar novamente."
          : "Não foi possível consultar o Pluggy. A conexão e os saldos anteriores foram preservados.",
      502,
    );
  try {
    return (await response.json()) as any;
  } catch {
    throw new BankError(
      "O provedor retornou uma resposta inválida. Tente novamente.",
      502,
    );
  }
}
async function apiKey(env: BankEnv) {
  const result = await provider("auth", undefined, {
    clientId: env.PLUGGY_CLIENT_ID,
    clientSecret: env.PLUGGY_CLIENT_SECRET,
  });
  return z.object({ apiKey: z.string().min(1) }).parse(result).apiKey;
}
async function getConnection(db: SupabaseClient, uid: string, id: string) {
  const r = await db
    .from("bank_connections")
    .select("*")
    .eq("user_id", uid)
    .eq("id", id)
    .maybeSingle();
  check(r);
  if (!r.data) throw new BankError("Conexão não encontrada.", 404);
  return r.data;
}
async function syncOne(
  db: SupabaseClient,
  key: string,
  uid: string,
  c: Record<string, any>,
) {
  const raw = await provider(
    `items/${encodeURIComponent(c.provider_item_id)}`,
    key,
  );
  // Legacy connections from explicit server item IDs have no clientUserId; permit only
  // the persisted owner connection, never adopt an arbitrary item from the browser.
  const item = itemSchema.parse(raw);
  if (item.clientUserId !== uid && item.clientUserId !== null)
    throw new BankError("Conexão vinculada a outro usuário.", 403);
  if (!eligibleConnector(item.connector))
    throw new BankError("Esta conexão exige renovação por Open Finance.");
  const expired =
    item.consentExpiresAt && Date.parse(item.consentExpiresAt) <= Date.now();
  if (
    item.status !== "UPDATED" ||
    expired ||
    item.statusDetail?.accounts?.isUpdated === false
  ) {
    const message = expired
      ? "Consentimento expirado. Renove a autorização do banco."
      : ["UPDATING", "MERGING"].includes(item.status)
        ? "O banco ainda está atualizando os dados. Tente consultar novamente em instantes."
        : "O banco precisa de uma nova autorização. Use Renovar autorização.";
    check(
      await db
        .from("bank_connections")
        .update({
          provider_status: item.status,
          consent_expires_at: item.consentExpiresAt,
          error: message,
        })
        .eq("id", c.id)
        .eq("user_id", uid)
        .eq("status", "active"),
    );
    return { accounts: 0, pending: true, message };
  }
  const all: unknown[] = [];
  let page = 1;
  for (;;) {
    const response = await provider(
      `accounts?itemId=${encodeURIComponent(item.id)}&page=${page}&pageSize=100`,
      key,
    );
    const parsed = z
      .object({
        results: z.array(z.unknown()),
        totalPages: z.number().int().min(0).max(5),
      })
      .parse(response);
    all.push(...parsed.results);
    if (page >= parsed.totalPages) break;
    page++;
  }
  const accounts = normalizeAccounts(all);
  const r = await db.rpc("apply_bank_snapshot", {
    p_user: uid,
    p_connection: c.id,
    p_accounts: accounts,
    p_provider_updated: item.lastUpdatedAt || null,
  });
  check(r);
  check(
    await db
      .from("bank_connections")
      .update({ consent_expires_at: item.consentExpiresAt || null })
      .eq("id", c.id)
      .eq("user_id", uid)
      .eq("status", "active"),
  );
  return {
    accounts: Number(r.data),
    pending: false,
    message: accounts.length
      ? "Saldos atualizados."
      : "Nenhuma conta bancária elegível em BRL foi retornada.",
  };
}
export async function syncBanks(
  env: BankEnv,
  uid: string,
  connectionId?: string,
) {
  configured(env, uid);
  const db = admin(env);
  const r = await db
    .from("bank_connections")
    .select("*")
    .eq("user_id", uid)
    .eq("status", "active");
  check(r);
  const connections = (r.data || []).filter(
    (c) => !connectionId || c.id === connectionId,
  );
  if (!connections.length)
    throw new BankError("Nenhuma conexão ativa. Conecte seu banco primeiro.");
  let key: string;
  try {
    key = await apiKey(env);
  } catch (error) {
    await db
      .from("bank_connections")
      .update({
        error:
          error instanceof BankError
            ? error.message
            : "Não foi possível autenticar no provedor.",
      })
      .eq("user_id", uid)
      .eq("status", "active");
    throw error;
  }
  let accounts = 0;
  const messages: string[] = [];
  for (const c of connections) {
    try {
      const result = await syncOne(db, key, uid, c);
      accounts += result.accounts;
      messages.push(result.message);
    } catch (error) {
      const message =
        error instanceof BankError
          ? error.message
          : "A atualização falhou. Os últimos saldos foram preservados.";
      await db
        .from("bank_connections")
        .update({ error: message })
        .eq("id", c.id)
        .eq("user_id", uid)
        .eq("status", "active");
      messages.push(message);
    }
  }
  return { accounts, message: messages.join(" ") };
}
export async function bankRoute(
  path: string,
  method: string,
  body: () => Promise<unknown>,
  env: BankEnv,
  uid: string,
  userDb: SupabaseClient,
) {
  if (path === "/api/bank/status" && method === "GET") {
    const allowed = uid === env.OWNER_USER_ID;
    const unset = missing(env);
    if (!allowed)
      return {
        configured: false,
        allowed: false,
        missing: env.OWNER_USER_ID ? [] : ["OWNER_USER_ID"],
        message: env.OWNER_USER_ID
          ? "Disponível apenas para o proprietário."
          : "Ative a integração nas configurações do servidor.",
      };
    const r = await userDb
      .from("bank_connections")
      .select("id,status")
      .eq("user_id", uid)
      .limit(1);
    return {
      configured: unset.length === 0 && !r.error,
      allowed: true,
      missing: unset,
      migrationRequired: !!r.error,
      message: r.error
        ? "Aplique a migração bancária 006 antes de conectar."
        : unset.length
          ? "Configure suas credenciais Pluggy no servidor."
          : "Pronto para solicitar sua autorização no banco.",
    };
  }
  configured(env, uid);
  const db = admin(env);
  if (path === "/api/bank/connect-token" && method === "POST") {
    const p = z
      .object({ connectionId: z.string().uuid().optional() })
      .parse(await body());
    let existing;
    if (p.connectionId) {
      existing = await getConnection(db, uid, p.connectionId);
      if (existing.status !== "active")
        throw new BankError("Conexão revogada. Crie uma nova autorização.");
    }
    const key = await apiKey(env);
    if (existing) {
      const previous = ownedItem(
        await provider(
          `items/${encodeURIComponent(existing.provider_item_id)}`,
          key,
        ),
        uid,
      );
      if (!eligibleConnector(previous.connector))
        throw new BankError(
          "Desconecte a conexão antiga e crie uma autorização Open Finance.",
        );
    }
    const candidates: z.infer<typeof connector>[] = [];
    let page = 1;
    for (;;) {
      const connectors = await provider(
        `connectors?countries=BR&types=PERSONAL_BANK&isOpenFinance=true&sandbox=false&page=${page}&pageSize=100`,
        key,
      );
      const response = z
        .object({
          results: z.array(connector),
          totalPages: z.number().int().min(0).max(10).optional(),
        })
        .parse(connectors);
      candidates.push(...response.results.filter(eligibleConnector));
      if (page >= (response.totalPages || 1)) break;
      page++;
    }
    if (!candidates.length)
      throw new BankError(
        "Nenhum banco Open Finance elegível está disponível no seu plano Pluggy.",
        503,
      );
    const token = await provider("connect_token", key, {
      ...(existing ? { itemId: existing.provider_item_id } : {}),
      options: { clientUserId: uid, avoidDuplicates: true },
    });
    return {
      connectToken: z.object({ accessToken: z.string().min(1) }).parse(token)
        .accessToken,
      connectorIds: [...new Set(candidates.map((c) => c.id))],
      ...(existing ? { updateItem: existing.provider_item_id } : {}),
    };
  }
  if (path === "/api/bank/connections" && method === "POST") {
    const p = z.object({ itemId }).parse(await body());
    const key = await apiKey(env);
    const item = ownedItem(
      await provider(`items/${encodeURIComponent(p.itemId)}`, key),
      uid,
    );
    const r = await db.rpc("register_bank_connection", {
      p_user: uid,
      p_item: item.id,
      p_name: item.connector.name,
      p_status: item.status,
      p_expires: item.consentExpiresAt || null,
    });
    check(r);
    // Register the consent first. A temporary extraction failure must not lose it.
    try {
      return {
        connected: true,
        ...(await syncBanks(env, uid, String(r.data))),
      };
    } catch {
      return {
        connected: true,
        accounts: 0,
        message:
          "Autorização salva. Consulte os saldos novamente quando o banco terminar a atualização.",
      };
    }
  }
  if (path === "/api/bank/sync" && method === "POST") {
    const p = z
      .object({ connectionId: z.string().uuid().optional() })
      .parse(await body());
    return syncBanks(env, uid, p.connectionId);
  }
  if (path === "/api/bank/disconnect" && method === "POST") {
    const p = z.object({ connectionId: z.string().uuid() }).parse(await body());
    const c = await getConnection(db, uid, p.connectionId);
    if (c.status === "disconnected")
      return { message: "Conexão já desconectada." };
    const r = await db.rpc("begin_bank_disconnect", {
      p_user: uid,
      p_connection: c.id,
    });
    check(r);
    try {
      const key = await apiKey(env);
      await provider(
        `items/${encodeURIComponent(c.provider_item_id)}`,
        key,
        undefined,
        "DELETE",
      );
      check(
        await db
          .from("bank_connections")
          .update({
            status: "disconnected",
            disconnected_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", c.id)
          .eq("user_id", uid),
      );
      return {
        message:
          "Conexão revogada. O histórico foi preservado e o saldo removido dos totais atuais.",
      };
    } catch (error) {
      await db
        .from("bank_connections")
        .update({
          error:
            "A revogação no provedor não terminou. Tente desconectar novamente; o saldo já foi retirado dos totais.",
        })
        .eq("id", c.id)
        .eq("user_id", uid);
      throw error;
    }
  }
  throw new BankError("Rota bancária não encontrada.", 404);
}
