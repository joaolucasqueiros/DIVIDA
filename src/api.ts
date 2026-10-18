import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function api(path: string, method = "GET", body?: unknown) {
  const session = await supabase?.auth.getSession();
  const r = await fetch(`/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.data.session
        ? { Authorization: `Bearer ${session.data.session.access_token}` }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data: any = await r.json();
  if (!r.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}
export async function allRows(table: string) {
  let rows: any[] = [],
    offset = 0;
  for (;;) {
    const r = await api(`data/${table}?offset=${offset}`);
    rows.push(...r.rows);
    if (rows.length >= r.total) return rows;
    offset += r.rows.length;
    if (!r.rows.length) throw Error("Paginação interrompida.");
  }
}
