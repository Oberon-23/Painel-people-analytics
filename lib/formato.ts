const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const int = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('pt-BR'));

export const pct = (n: number | null | undefined, casas = 0) =>
  n == null ? '—' : `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const pp = (a: number | null | undefined, b: number | null | undefined, casas = 0) => {
  if (a == null || b == null) return '';
  const d = (a - b) * 100;
  const s = Math.abs(d).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${d >= 0 ? '+' : '−'}${s} p.p.`;
};

export const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const brlCurto = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(n)}`;

export const sinal = (n: number | null | undefined) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`);

/** '2026-10-01' → 'out/26' */
export const mesCurto = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;

/** '2026-10-01' → 'outubro de 2026' */
export const mesLongo = (iso: string) => `${MESES_LONGOS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

/** '2026-04-01' (ciclo de clima) → '1º sem. 2026' */
export const ciclo = (iso: string) => `${Number(iso.slice(5, 7)) <= 6 ? '1º' : '2º'} sem. ${iso.slice(0, 4)}`;

export const data = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : d.toISOString();
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
};

export const dataHora = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const anos = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${n >= 1 && n < 2 ? 'ano' : 'anos'}`;
