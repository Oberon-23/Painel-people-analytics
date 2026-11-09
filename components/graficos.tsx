'use client';

/*
 * Gráficos em SVG próprio, sem biblioteca. Recebem só números já
 * agregados pelo banco (nunca linhas de pessoas) e se desenham na largura
 * real do cartão, então o texto fica sempre em 12px, no computador e no
 * celular.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Area, Mes, Remuneracao } from '@/lib/dados';
import { brlCurto, int, mesCurto, pct } from '@/lib/formato';

/* ---------------- utilidades ---------------- */

function escala(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/** Marcas "redondas" do eixo entre min e max. */
function marcas(min: number, max: number, alvo = 4): number[] {
  if (max <= min) return [min];
  const bruto = (max - min) / alvo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const ini = Math.floor(min / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= max + passo * 0.999; v += passo) out.push(Number(v.toFixed(6)));
  return out;
}

/** Mede a largura do contêiner (começa com um palpite e corrige no navegador). */
function useLargura(inicial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Quadro({ largura, altura, rotulo, children }: { largura: number; altura: number; rotulo: string; children: ReactNode }) {
  return (
    <svg className="graf" width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={rotulo}>
      {children}
    </svg>
  );
}

/** De quantos em quantos meses mostrar o rótulo do eixo x, conforme a largura. */
function passoMeses(n: number, larguraUtil: number) {
  const cabem = Math.max(2, Math.floor(larguraUtil / 64));
  return [1, 2, 3, 4, 6, 12].find((p) => Math.ceil(n / p) <= cabem) ?? 12;
}

/* ---------------- Pessoas no fim do mês ---------------- */

export function LinhaPessoas({ meses }: { meses: Mes[] }) {
  const [ref, W] = useLargura(560);
  const H = 240, L = 44, R = 40, T = 14, B = 28;
  const vals = meses.map((m) => m.headcount);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const folga = Math.max(5, (hi - lo) * 0.6);
  const mk = marcas(Math.max(0, lo - folga), hi + folga, 4);
  const y = escala(mk[0], mk[mk.length - 1], H - B, T);
  const x = escala(0, meses.length - 1, L + 8, W - R - 8);
  const d = meses.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(m.headcount).toFixed(1)}`).join('');
  const passo = passoMeses(meses.length, W - L - R);
  const ult = meses.length - 1;
  return (
    <div ref={ref} className="graf-box">
      <Quadro largura={W} altura={H} rotulo="Pessoas no fim de cada mês">
        {mk.map((t) => (
          <g key={t}>
            <line className="grade-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{int(t)}</text>
          </g>
        ))}
        <path className="area1" d={`${d}L${x(ult)},${H - B}L${x(0)},${H - B}Z`} />
        <path className="l1" d={d} />
        {meses.map((m, i) => (
          <g key={m.mes}>
            <circle className="ponto1" cx={x(i)} cy={y(m.headcount)} r={i === ult ? 4.5 : 3}>
              <title>{`${mesCurto(m.mes)}: ${m.headcount} pessoas`}</title>
            </circle>
            {(ult - i) % passo === 0 ? <text x={x(i)} y={H - 8} textAnchor="middle">{mesCurto(m.mes)}</text> : null}
          </g>
        ))}
        <text className="rot-forte halo" x={x(ult)} y={y(meses[ult].headcount) - 12} textAnchor="end">{int(meses[ult].headcount)}</text>
      </Quadro>
    </div>
  );
}

/* ---------------- Admissões x desligamentos ---------------- */

export function BarrasMovimento({ meses, mesesDestaque = 0 }: { meses: Mes[]; mesesDestaque?: number }) {
  const [ref, W] = useLargura(560);
  const H = 240, L = 34, R = 10, T = 22, B = 28;
  const max = Math.max(1, ...meses.map((m) => Math.max(m.admissoes, m.desligamentos)));
  const mk = marcas(0, max, 4);
  const y = escala(0, mk[mk.length - 1], H - B, T);
  const banda = (W - L - R) / meses.length;
  const bw = Math.max(2, Math.min(14, banda * 0.36));
  const x0 = (i: number) => L + i * banda + banda / 2;
  const passo = passoMeses(meses.length, W - L - R);
  const ult = meses.length - 1;
  const iDest = mesesDestaque > 0 ? meses.length - mesesDestaque : -1;
  return (
    <div ref={ref} className="graf-box">
      <Quadro largura={W} altura={H} rotulo="Admissões e desligamentos por mês">
        {iDest > 0 ? (
          <g>
            <rect className="faixa-tend" x={L + iDest * banda} y={T - 18} width={(meses.length - iDest) * banda} height={H - B - T + 18} />
            <text className="rot-faixa" x={L + iDest * banda + 6} y={T - 6}>{`últimos ${mesesDestaque} meses`}</text>
          </g>
        ) : null}
        {mk.map((t) => (
          <g key={t}>
            <line className="grade-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {meses.map((m, i) => (
          <g key={m.mes}>
            <rect className="s1" x={x0(i) - bw - 1} width={bw} y={y(m.admissoes)} height={Math.max(0, y(0) - y(m.admissoes))} rx="2">
              <title>{`${mesCurto(m.mes)}: ${m.admissoes} admissões`}</title>
            </rect>
            <rect className="s2" x={x0(i) + 1} width={bw} y={y(m.desligamentos)} height={Math.max(0, y(0) - y(m.desligamentos))} rx="2">
              <title>{`${mesCurto(m.mes)}: ${m.desligamentos} desligamentos (${m.voluntarios} por pedido de demissão)`}</title>
            </rect>
            {(ult - i) % passo === 0 ? <text x={x0(i)} y={H - 8} textAnchor="middle">{mesCurto(m.mes)}</text> : null}
          </g>
        ))}
        <line className="eixo" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      </Quadro>
    </div>
  );
}

/* ---------------- Absenteísmo ---------------- */

export function LinhaPercentual({ meses, referencia, rotuloReferencia }: { meses: { mes: string; v: number | null }[]; referencia?: number; rotuloReferencia?: string }) {
  const [ref, W] = useLargura(440);
  const H = 240, L = 44, R = 12, T = 14, B = 28;
  const vals = meses.map((m) => m.v ?? 0);
  const mk = marcas(0, Math.max(...vals, referencia ?? 0) * 1.15, 4);
  const y = escala(0, mk[mk.length - 1], H - B, T);
  const x = escala(0, meses.length - 1, L + 8, W - R - 8);
  const d = meses.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(m.v ?? 0).toFixed(1)}`).join('');
  const passo = passoMeses(meses.length, W - L - R);
  const ult = meses.length - 1;
  return (
    <div ref={ref} className="graf-box">
      <Quadro largura={W} altura={H} rotulo="Absenteísmo por mês">
        {mk.map((t) => (
          <g key={t}>
            <line className="grade-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{pct(t, t > 0 && t < 0.1 ? 1 : 0)}</text>
          </g>
        ))}
        <path className="area1" d={`${d}L${x(ult)},${H - B}L${x(0)},${H - B}Z`} />
        {referencia != null ? (
          <g>
            <line className="ref" x1={L} x2={W - R} y1={y(referencia)} y2={y(referencia)} />
            <text className="rot-ref halo" x={L + 6} y={y(referencia) - 6}>{rotuloReferencia ?? `referência ${pct(referencia, 1)}`}</text>
          </g>
        ) : null}
        <path className="l1" d={d} />
        {meses.map((m, i) => (
          <g key={m.mes}>
            <circle className="ponto1" cx={x(i)} cy={y(m.v ?? 0)} r={i === ult ? 4.5 : 3}><title>{`${mesCurto(m.mes)}: ${pct(m.v, 1)}`}</title></circle>
            {(ult - i) % passo === 0 ? <text x={x(i)} y={H - 8} textAnchor="middle">{mesCurto(m.mes)}</text> : null}
          </g>
        ))}
        <text className="rot-forte halo" x={x(ult)} y={y(meses[ult].v ?? 0) - 12} textAnchor="end">{pct(meses[ult].v, 1)}</text>
      </Quadro>
    </div>
  );
}

/* ---------------- Turnover por área ---------------- */

export function TurnoverPorArea({ areas, media, rotuloMedia }: { areas: Area[]; media: number | null; rotuloMedia: string }) {
  const [ref, W] = useLargura(620);
  const lista = [...areas].sort((a, b) => (b.turnover_12m ?? -1) - (a.turnover_12m ?? -1));
  const estreito = W < 480;
  const linha = 30, L = estreito ? 118 : 136, R = 44, T = 26, B = 24;
  const H = T + lista.length * linha + B;
  const max = Math.max(0.1, ...lista.map((a) => a.turnover_12m ?? 0), media ?? 0);
  const mk = marcas(0, max, 4);
  const x = escala(0, mk[mk.length - 1], L, W - R);
  const alto = (a: Area) => media != null && a.turnover_12m != null && a.turnover_12m > media * 1.5;
  return (
    <div ref={ref} className="graf-box">
      <Quadro largura={W} altura={H} rotulo="Turnover de 12 meses por área">
        {mk.map((t) => (
          <g key={t}>
            <line className="grade-l" x1={x(t)} x2={x(t)} y1={T - 4} y2={H - B} />
            <text x={x(t)} y={H - 6} textAnchor="middle">{pct(t)}</text>
          </g>
        ))}
        {media != null ? (
          <g>
            <line className="ref" x1={x(media)} x2={x(media)} y1={T - 8} y2={H - B} />
            <text className="rot-ref" x={x(media)} y={T - 12} textAnchor="middle">{`${rotuloMedia} ${pct(media)}`}</text>
          </g>
        ) : null}
        {lista.map((a, i) => {
          const yy = T + i * linha;
          const forte = alto(a);
          return (
            <g key={a.area_id}>
              <text x={L - 10} y={yy + linha / 2 + 4} textAnchor="end" className={forte ? 'rot-forte' : 'rot-cat'}>{a.area}</text>
              {a.suprimido ? (
                <>
                  <rect className="bar-sup" x={L} y={yy + 6} width={W - R - L} height={linha - 12} rx="4" />
                  <text className="sup-txt" x={L + 10} y={yy + linha / 2 + 4}>oculto: grupo pequeno</text>
                </>
              ) : (
                <>
                  <rect className={forte ? 'bar-bad' : 'bar-n'} x={L} y={yy + 6} width={Math.max(2, x(a.turnover_12m ?? 0) - L)} height={linha - 12} rx="4">
                    <title>{`${a.area}: ${pct(a.turnover_12m)} (${a.desligamentos_12m} saídas, ${a.headcount} pessoas hoje)`}</title>
                  </rect>
                  <text x={x(a.turnover_12m ?? 0) + 6} y={yy + linha / 2 + 4} className={`halo ${forte ? 'rot-forte' : 'rot-val'}`}>{pct(a.turnover_12m)}</text>
                </>
              )}
            </g>
          );
        })}
      </Quadro>
    </div>
  );
}

/* ---------------- Remuneração: diferença por nível ---------------- */

export function DiferencaSalarial({ linhas }: { linhas: Remuneracao[] }) {
  const [ref, W] = useLargura(900);
  const estreito = W < 520;
  const linha = 40, L = estreito ? 96 : 124, R = 18, T = 26, B = 26;
  const H = T + linhas.length * linha + B;
  const difs = linhas.map((l) => (l.razao == null ? null : l.razao - 1));
  const ok = difs.filter((d): d is number => d != null);
  const lo = Math.min(-0.15, ...ok) , hi = Math.max(0.05, ...ok);
  const mk = marcas(lo, hi, estreito ? 3 : 5);
  const x = escala(mk[0], mk[mk.length - 1], L, W - R);
  const fmt = (d: number) => `${d < 0 ? '−' : d > 0 ? '+' : ''}${Math.abs(d * 100).toFixed(1).replace('.', ',')}%`;
  return (
    <div ref={ref} className="graf-box">
      <Quadro largura={W} altura={H} rotulo="Diferença entre a mediana salarial de mulheres e de homens, por nível">
        {mk.map((t) => (
          <g key={t}>
            <line className={Math.abs(t) < 1e-9 ? 'eixo' : 'grade-l'} x1={x(t)} x2={x(t)} y1={T - 6} y2={H - B} />
            <text x={x(t)} y={H - 6} textAnchor="middle">{Math.abs(t) < 1e-9 ? 'igual' : `${t > 0 ? '+' : '−'}${Math.round(Math.abs(t) * 100)}%`}</text>
          </g>
        ))}
        <text className="rot-ref" x={x(0) - 8} y={T - 12} textAnchor="end">← mulheres ganham menos</text>
        {!estreito ? <text className="rot-ref" x={x(0) + 8} y={T - 12}>mulheres ganham mais →</text> : null}
        {linhas.map((l, i) => {
          const yy = T + i * linha;
          const d = difs[i];
          return (
            <g key={l.nivel_id}>
              <text x={L - 12} y={yy + linha / 2 + 4} textAnchor="end" className="rot-cat">{l.nivel}</text>
              {d == null ? (
                <>
                  <rect className="bar-sup" x={L} y={yy + 8} width={W - R - L} height={linha - 16} rx="4" />
                  <text className="sup-txt" x={L + 10} y={yy + linha / 2 + 4}>{estreito ? 'oculto: grupo pequeno' : `oculto: ${l.n_mulheres} mulheres e ${l.n_homens} homens (mínimo de 5 em cada grupo)`}</text>
                </>
              ) : (
                <>
                  <rect className={d < -0.03 ? 'bar-bad' : 'bar-n'} x={Math.min(x(0), x(d))} y={yy + 9} width={Math.max(2, Math.abs(x(d) - x(0)))} height={linha - 18} rx="3">
                    <title>{`${l.nivel}: mulheres ${brlCurto(l.mediana_mulheres!)} · homens ${brlCurto(l.mediana_homens!)}`}</title>
                  </rect>
                  <text className={`halo ${d < -0.03 ? 'rot-forte' : 'rot-val'}`} x={d < 0 ? x(d) - 6 : x(d) + 6} y={yy + linha / 2 + 4} textAnchor={d < 0 ? 'end' : 'start'}>{fmt(d)}</text>
                </>
              )}
            </g>
          );
        })}
      </Quadro>
    </div>
  );
}

/* ---------------- Mini linha (clima) ---------------- */

export function Mini({ valores }: { valores: (number | null)[] }) {
  const W = 110, H = 32;
  const ok = valores.filter((v): v is number => v != null);
  if (ok.length < 2) return <span className="neutro">—</span>;
  const x = escala(0, valores.length - 1, 4, W - 4);
  const y = escala(-100, 100, H - 4, 4);
  const d = valores.map((v, i) => (v == null ? '' : `${i && valores[i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)}`)).join('');
  const ult = valores[valores.length - 1];
  return (
    <svg className="graf" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line className="grade-l" x1="0" x2={W} y1={y(0)} y2={y(0)} />
      <path className={ult != null && ok[0] - ult > 20 ? 'l2' : 'l1'} d={d} />
    </svg>
  );
}
