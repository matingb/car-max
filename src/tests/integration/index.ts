import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Constantes de entidades pre-existentes en el seed de prueba (supabase/seed.sql).
 * Se estructuran en un objeto único para facilitar el autocompletado y evitar múltiples imports.
 */
export const SEED = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tallerId: "50000000-0000-0000-0000-000000000001", // Sede Central
  vehiculoId: "40000000-0000-0000-0000-000000000001", // Toyota Corolla ABC123
  clienteId: "10000000-0000-0000-0000-000000000001",
  userId: "7ff568f8-4d46-463b-969c-9e68157fa769", // local@user.ar
  cuentaId: "c0000000-0000-4000-8000-000000000001", // Banco Galicia
  categoriaServiceId: "b1000000-0000-0000-0000-000000000001", // Service
  stockAceite: {
    id: "70000000-0000-0000-0000-000000000001",
    productoId: "60000000-0000-0000-0000-000000000001",
    nombre: "Aceite 5W30",
    codigo: "ACE-5W30",
    cantidadInicial: 200,
    precioUnitario: 6500,
  },
} as const;

// Alias individuales para retrocompatibilidad
export const TEST_TENANT_ID = SEED.tenantId;
export const TEST_TALLER_ID = SEED.tallerId;
export const TEST_VEHICULO_ID = SEED.vehiculoId;
export const TEST_CLIENTE_ID = SEED.clienteId;
export const TEST_USER_ID = SEED.userId;
export const TEST_CUENTA_ID = SEED.cuentaId;
export const TEST_CATEGORIA_SERVICE_ID = SEED.categoriaServiceId;
export const TEST_STOCK_ACEITE = SEED.stockAceite;

// --- Configuración y JWT Supabase ---

const DEFAULT_SUPABASE_URL = "http://127.0.0.1:54321";
const DEFAULT_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export interface TestClientOptions {
  userId?: string;
  tenantId?: string;
  userRole?: string;
  url?: string;
  jwtSecret?: string;
}

export function generateTestJwt(options?: TestClientOptions): string {
  const secret =
    options?.jwtSecret ||
    process.env.SUPABASE_JWT_SECRET ||
    DEFAULT_JWT_SECRET;

  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: options?.userId || SEED.userId,
      role: "authenticated",
      aud: "authenticated",
      tenant_id: options?.tenantId || SEED.tenantId,
      user_role: options?.userRole || "admin",
      tenant_name: "B2Car",
      iat: now,
      exp: now + 3600 * 24,
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function createTestClient(options?: TestClientOptions): SupabaseClient {
  const url =
    options?.url ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const token = generateTestJwt(options);

  return createClient(url, token, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createAdminTestClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Instancia compartida por defecto con claims de admin de B2Car.
 * Lista para utilizar directamente en la mayoría de tests de integración.
 */
export const testClient = createTestClient();
