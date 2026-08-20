// Aplica, en orden, los archivos .sql de supabase/migrations contra la base de
// datos indicada en SUPABASE_DB_URL. Lleva registro de lo ya aplicado en la
// tabla public._migrations, así que se puede correr muchas veces sin repetir.
//
// Uso:  node --env-file=.env.local scripts/migrate.mjs

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD } =
  process.env;

if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD || SUPABASE_DB_PASSWORD.startsWith("PEGAR_AQUI")) {
  console.error(
    "Faltan los datos de conexión (o falta reemplazar SUPABASE_DB_PASSWORD) en .env.local. " +
      "Ese archivo no se comparte ni se sube a git.\n" +
      "Volvé a correr con:\n  node --env-file=.env.local scripts/migrate.mjs",
  );
  process.exit(1);
}

const client = new Client({
  host: SUPABASE_DB_HOST,
  port: Number(SUPABASE_DB_PORT || 5432),
  database: SUPABASE_DB_NAME || "postgres",
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public._migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows: applied } = await client.query("select filename from public._migrations");
  const appliedSet = new Set(applied.map((r) => r.filename));

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ranAny = false;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`= ${file} (ya aplicada)`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`> aplicando ${file} ...`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`  listo.`);
      ranAny = true;
    } catch (err) {
      await client.query("rollback");
      console.error(`  ERROR en ${file}:`, err.message);
      process.exitCode = 1;
      break;
    }
  }

  if (!ranAny && process.exitCode !== 1) {
    console.log("Nada nuevo para aplicar.");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
