import 'server-only';
import { Pool, type PoolClient } from 'pg';

/**
 * Uma única conexão de banco, sempre com o usuário rh_app (sem poder de
 * dono, sem ignorar RLS). A string de conexão existe só no servidor:
 * nunca vai para o navegador.
 */
declare global {
  // eslint-disable-next-line no-var
  var __pool: Pool | undefined;
}

function pool(): Pool {
  if (!globalThis.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    // o TLS é configurado aqui, não pela URL (sslmode na URL sobrescreveria isto)
    const u = new URL(url);
    for (const k of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl']) u.searchParams.delete(k);
    // Supabase assina o certificado do banco com uma CA própria: cole o
    // certificado dela em DATABASE_CA para a conexão continuar verificada.
    const ca = process.env.DATABASE_CA?.replace(/\\n/g, '\n');
    globalThis.__pool = new Pool({
      connectionString: u.toString(),
      max: 4,
      idleTimeoutMillis: 10_000,
      ssl: local ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true },
    });
  }
  return globalThis.__pool;
}

/**
 * Roda as consultas "como" o usuário do token: abre uma transação e grava
 * o token em app.token só para ela (set_config local). Funciona também com
 * pool de conexões em modo transação (Neon, Supabase, PgBouncer).
 */
export async function comUsuario<T>(token: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query('begin');
    await c.query("select set_config('app.token', $1, true)", [token ?? '']);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export class SemPermissao extends Error {}

/** Erro do Postgres por falta de permissão (42501) ou sessão inválida (28000). */
export function ehBloqueio(e: unknown): e is Error & { code: string } {
  const code = (e as { code?: string })?.code;
  return code === '42501' || code === '28000';
}
