// Activa una cuenta existente como administrador. Uso puntual para el primer usuario
// (nadie puede activarlo todavía porque no hay ningún administrador activo).
//
// Uso:  node --env-file=.env.local scripts/bootstrap-admin.mjs correo@ejemplo.com

import { Client } from "pg";

const email = process.argv[2];
if (!email) {
  console.error("Uso: node --env-file=.env.local scripts/bootstrap-admin.mjs correo@ejemplo.com");
  process.exit(1);
}

const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD } =
  process.env;

const client = new Client({
  host: SUPABASE_DB_HOST,
  port: Number(SUPABASE_DB_PORT || 5432),
  database: SUPABASE_DB_NAME || "postgres",
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows } = await client.query(
  `update public.profiles p
     set role = 'administrador', active = true
     from auth.users u
     where p.id = u.id and u.email = $1
     returning p.id, p.full_name, p.role, p.active`,
  [email],
);

if (rows.length === 0) {
  console.log(`No se encontró ningún usuario con el correo ${email}. ¿Ya se registró en /login?`);
} else {
  console.log("Listo:", rows[0]);
}

await client.end();
