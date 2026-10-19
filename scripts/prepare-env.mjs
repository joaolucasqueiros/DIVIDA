// Materialize injected bindings for local Wrangler without logging any values.
// Existing local files are never replaced.
import { existsSync, writeFileSync } from "node:fs";
const workerNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "OWNER_USER_ID",
  "PLUGGY_CLIENT_ID",
  "PLUGGY_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TOKEN_ENCRYPTION_KEY",
];
const bindings = Object.fromEntries(
  workerNames.filter((k) => process.env[k]).map((k) => [k, process.env[k]]),
);
bindings.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
bindings.SUPABASE_ANON_KEY ||= process.env.VITE_SUPABASE_ANON_KEY;
if (
  !existsSync(".dev.vars") &&
  bindings.SUPABASE_URL &&
  bindings.SUPABASE_ANON_KEY
) {
  writeFileSync(
    ".dev.vars",
    Object.entries(bindings)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Arquivo local .dev.vars criado a partir dos bindings injetados.",
  );
}
const vite = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
};
if (
  !existsSync(".env.local") &&
  vite.VITE_SUPABASE_URL &&
  vite.VITE_SUPABASE_ANON_KEY
) {
  writeFileSync(
    ".env.local",
    Object.entries(vite)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log("Arquivo local .env.local criado com a configuração pública.");
}
