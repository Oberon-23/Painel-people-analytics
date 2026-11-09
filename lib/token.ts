import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token de sessão: "<usuario>.<expira_em_segundos>.<hmac-sha256>".
 * O mesmo formato é conferido dentro do Postgres (app.usuario_atual),
 * com o mesmo segredo. Quem não tem o segredo não consegue fabricar
 * um token, nem mesmo alguém com acesso ao usuário rh_app do banco.
 */
export const DURACAO_SESSAO_S = 8 * 60 * 60;

function segredo(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('TOKEN_SECRET ausente ou curto demais');
  return s;
}

function assinar(corpo: string): string {
  return createHmac('sha256', segredo()).update(corpo).digest('hex');
}

export function criarToken(usuarioId: number, agora = Date.now()): string {
  const exp = Math.floor(agora / 1000) + DURACAO_SESSAO_S;
  const corpo = `${usuarioId}.${exp}`;
  return `${corpo}.${assinar(corpo)}`;
}

/** Devolve o id do usuário se o token for íntegro e não estiver vencido. */
export function lerToken(token: string | undefined | null, agora = Date.now()): number | null {
  if (!token) return null;
  const m = /^(\d{1,4})\.(\d{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return null;
  const esperado = Buffer.from(assinar(`${m[1]}.${m[2]}`), 'hex');
  const recebido = Buffer.from(m[3], 'hex');
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  if (Number(m[2]) * 1000 < agora) return null;
  return Number(m[1]);
}

export const COOKIE_SESSAO = 'rh_sessao';
