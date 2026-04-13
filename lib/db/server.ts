import { Pool } from "pg";

import { env, runtimeFlags } from "@/lib/config";

declare global {
  // eslint-disable-next-line no-var
  var hiredPostgresPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string) {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

export function isDatabaseConfigured() {
  return runtimeFlags.hasDatabase;
}

export function getDatabasePool() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalThis.hiredPostgresPool) {
    globalThis.hiredPostgresPool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: shouldUseSsl(env.DATABASE_URL)
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    });
  }

  return globalThis.hiredPostgresPool;
}
