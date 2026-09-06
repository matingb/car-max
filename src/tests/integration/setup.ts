import { beforeEach, vi } from "vitest";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { testClient } from "./index";

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Resetea la base de datos completa de pruebas al estado prístino definido en supabase/seed.sql.
 * Ejecuta `TRUNCATE auth.users CASCADE` y vuelve a sembrar todos los datos en milisegundos.
 */
export function resetDatabase(dbUrl: string = process.env.DATABASE_URL || DEFAULT_DB_URL): void {
  const seedPath = path.resolve(process.cwd(), "supabase/seed.sql");

  if (!fs.existsSync(seedPath)) {
    throw new Error(`No se encontró el archivo de seed en: ${seedPath}`);
  }

  execSync(
    `psql "${dbUrl}" -v ON_ERROR_STOP=1 -c "TRUNCATE auth.users CASCADE;" && psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${seedPath}"`,
    { stdio: "pipe", env: process.env }
  );
}

// Inyecta el cliente Supabase real conectado a Postgres local para todas las API routes y servicios
vi.mock("@/supabase/server", () => ({
  createClient: async () => testClient,
}));

// Se ejecuta automáticamente antes de cada test de integración
beforeEach(() => {
  resetDatabase();
});
