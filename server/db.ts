// PostgreSQL client (server-only). Connection string from env:
//   DATABASE_URL=postgres://nashtwin:nashtwin@localhost:5432/super_omaha
// Defaults suit the local Docker container (see db/schema.sql header).

import { Pool } from "npm:pg@^8";

const url = Deno.env.get("DATABASE_URL") ??
  "postgres://nashtwin:nashtwin@localhost:5432/super_omaha";

export const pool = new Pool({ connectionString: url, max: 4 });

export async function query<T>(text: string, params: unknown[] = []) {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
