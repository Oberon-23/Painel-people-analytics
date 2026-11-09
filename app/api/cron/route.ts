import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { comUsuario } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Chamada todo dia pelo agendador da Vercel (vercel.json). A Vercel manda
 * "Authorization: Bearer <CRON_SECRET>"; sem esse segredo, nada acontece.
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const recebido = req.headers.get('authorization') ?? '';
  const esperado = `Bearer ${segredo}`;
  if (!segredo || recebido.length !== esperado.length || !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  const r = await comUsuario(null, async (c) => (await c.query("select api.atualizar_dados('agendada') as r")).rows[0].r);
  return NextResponse.json({ ok: true, ...r });
}
