/*
 * Gráficos em SVG, desenhados no servidor. O navegador recebe só o
 * desenho pronto: nenhuma linha de dado bruto, nenhuma biblioteca.
 */
import type { Area, Mes, Remuneracao } from '@/lib/dados';
import { brlCurto, mesCurto, pct } from '@/lib/formato';

function escala(min: number, max: number, a: number, b: number) {
  return (v: number) => (max === min ? (a + b) / 2 : a + ((v - min) / (max - min)) * (b - a));
}

function ticks(max: number, n = 4) {
  if (max <= 0) return [0];
  const bruto = max / n;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += passo) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + passo);
  return out;
}

/** Admissões (para cima), desligamentos (para baixo) e headcount (linha). */
export function Movimentacao({ meses, inicioTendencia }: { meses: Mes[]; inicioTendencia?: string }) {
  const W = 760, H = 300, L = 40, R = 46, T = 16, B = 30;
  const mid = T + (H - T - B) * 0.62;
  const maxFluxo = Math.max(1, ...meses.map((m) => Math.max(m.admissoes, m.desligamentos)));
  const tf = ticks(maxFluxo, 2);
  const topFluxo = tf[tf.length - 1];
  const yUp = escala(0, topFluxo, mid, T + 70);
  const yDn = escala(0, topFluxo, mid, H - B);
  const hcs = meses.map((m) => m.headcount);
  const hmin = Math.min(...hcs), hmax = Math.max(...hcs);
  const pad = Math.max(2, (hmax - hmin) * 0.25);
  const yHc = escala(hmin - pad, hmax + pad, T + 58, T);
  const bw = (W - L - R) / meses.length;
  const x = (i: number) => L + i * bw + bw / 2;
  const linha = meses.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yHc(m.headcount).toFixed(1)}`).join('');
  const iTend = inicioTendencia ? meses.findIndex((m) => m.mes >= inicioTendencia) : -1;

  return (
    <svg className="graf" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Admissões, desligamentos e headcount por mês">
      {iTend > 0 ? <rect className="faixa-tend" x={L + iTend * bw} y={T} width={(meses.length - iTend) * bw} height={H - T - B} /> : null}
      {tf.slice(1).map((v) => (
        <g key={v}>
          <line className="grade-l" x1={L} x2={W - R} y1={yUp(v)} y2={yUp(v)} />
          <text x={L - 6} y={yUp(v) + 4} textAnchor="end">{v}</text>
          <line className="grade-l" x1={L} x2={W - R} y1={yDn(v)} y2={yDn(v)} />
          <text x={L - 6} y={yDn(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      <line className="eixo" x1={L} x2={W - R} y1={mid} y2={mid} />
      {meses.map((m, i) => (
        <g key={m.mes}>
          <rect className="s1" x={x(i) - bw * 0.32} width={bw * 0.64} y={yUp(m.admissoes)} height={mid - yUp(m.admissoes)} rx="2">
            <title>{`${mesCurto(m.mes)}: ${m.admissoes} admissões`}</title>
          </rect>
          <rect className="s2" x={x(i) - bw * 0.32} width={bw * 0.64} y={mid} height={yDn(m.desligamentos) - mid} rx="2">
            <title>{`${mesCurto(m.mes)}: ${m.desligamentos} desligamentos (${m.voluntarios} pedidos de demissão)`}</title>
          </rect>
          {i % 3 === (meses.length - 1) % 3 ? (
            <text x={x(i)} y={H - 10} textAnchor="middle">{mesCurto(m.mes)}</text>
          ) : null}
        </g>
      ))}
      <path className="l1" d={linha} />
      {meses.map((m, i) => (
        <circle key={m.mes} className="ponto1" cx={x(i)} cy={yHc(m.headcount)} r="3">
          <title>{`${mesCurto(m.mes)}: ${m.headcount} pessoas`}</title>
        </circle>
      ))}
      <text className="rot-forte" x={W - R + 6} y={yHc(hcs[hcs.length - 1]) + 4}>{hcs[hcs.length - 1]}</text>
    </svg>
  );
}

/** Absenteísmo mensal com linha de referência. */
export function LinhaPercentual({ meses, referencia }: { meses: { mes: string; v: number | null }[]; referencia?: number }) {
  const W = 440, H = 230, L = 44, R = 12, T = 12, B = 28;
  const vals = meses.map((m) => m.v ?? 0);
  const tk = ticks(Math.max(...vals, referencia ?? 0) * 100, 4).map((t) => t / 100);
  const top = tk[tk.length - 1];
  const y = escala(0, top, H - B, T);
  const x = escala(0, meses.length - 1, L + 6, W - R - 6);
  const d = meses.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(m.v ?? 0).toFixed(1)}`).join('');
  const area = `${d}L${x(meses.length - 1)},${H - B}L${x(0)},${H - B}Z`;
  return (
    <svg className="graf" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Absenteísmo por mês">
      {tk.map((t) => (
        <g key={t}>
          <line className="grade-l" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end">{pct(t, t < 0.1 ? 1 : 0)}</text>
        </g>
      ))}
      {referencia != null ? <line className="ref" x1={L} x2={W - R} y1={y(referencia)} y2={y(referencia)} /> : null}
      <path className="area1" d={area} />
      <path className="l1" d={d} />
      {meses.map((m, i) => (
        <g key={m.mes}>
          <circle className="ponto1" cx={x(i)} cy={y(m.v ?? 0)} r="3"><title>{`${mesCurto(m.mes)}: ${pct(m.v, 1)}`}</title></circle>
          {i % 3 === (meses.length - 1) % 3 ? <text x={x(i)} y={H - 8} textAnchor="middle">{mesCurto(m.mes)}</text> : null}
        </g>
      ))}
    </svg>
  );
}

/** Turnover por área (barras horizontais), com a média do escopo e áreas suprimidas. */
export function TurnoverPorArea({ areas, media }: { areas: Area[]; media: number | null }) {
  const lista = [...areas].sort((a, b) => (b.turnover_12m ?? -1) - (a.turnover_12m ?? -1));
  const W = 560, linha = 30, L = 132, R = 56, T = 8;
  const H = T + lista.length * linha + 24;
  const max = Math.max(0.1, ...lista.map((a) => a.turnover_12m ?? 0), media ?? 0);
  const tk = ticks(max * 100, 4).map((t) => t / 100);
  const x = escala(0, tk[tk.length - 1], L, W - R);
  return (
    <svg className="graf" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Turnover de 12 meses por área">
      {tk.map((t) => (
        <g key={t}>
          <line className="grade-l" x1={x(t)} x2={x(t)} y1={T} y2={H - 20} />
          <text x={x(t)} y={H - 6} textAnchor="middle">{pct(t)}</text>
        </g>
      ))}
      {lista.map((a, i) => {
        const yy = T + i * linha;
        const alto = media != null && a.turnover_12m != null && a.turnover_12m > media * 1.5;
        return (
          <g key={a.area_id}>
            <text x={L - 8} y={yy + linha / 2 + 4} textAnchor="end" className={alto ? 'rot-forte' : undefined}>{a.area}</text>
            {a.suprimido ? (
              <>
                <rect className="bar-sup" x={L} y={yy + 6} width={W - R - L} height={linha - 12} rx="4" />
                <text className="sup-txt" x={L + 10} y={yy + linha / 2 + 4}>menos de 5 pessoas: oculto</text>
              </>
            ) : (
              <>
                <rect className={alto ? 'bar-bad' : 'bar-n'} x={L} y={yy + 6} width={Math.max(1, x(a.turnover_12m ?? 0) - L)} height={linha - 12} rx="4">
                  <title>{`${a.area}: ${pct(a.turnover_12m)} (${a.desligamentos_12m} saídas, ${a.headcount} pessoas hoje)`}</title>
                </rect>
                <text x={x(a.turnover_12m ?? 0) + 6} y={yy + linha / 2 + 4} className={alto ? 'rot-forte' : undefined}>{pct(a.turnover_12m)}</text>
              </>
            )}
          </g>
        );
      })}
      {media != null ? (
        <g>
          <line className="ref" x1={x(media)} x2={x(media)} y1={T} y2={H - 20} />
        </g>
      ) : null}
    </svg>
  );
}

/** Mediana salarial de mulheres e homens por nível (gráfico de halteres). */
export function Halteres({ linhas }: { linhas: Remuneracao[] }) {
  const W = 1000, linha = 44, L = 110, R = 64, T = 6;
  const H = T + linhas.length * linha + 26;
  const vals = linhas.flatMap((l) => [l.mediana_mulheres, l.mediana_homens]).filter((v): v is number => v != null);
  const max = Math.max(1000, ...vals);
  const tk = ticks(max, 4);
  const x = escala(0, tk[tk.length - 1], L, W - R);
  return (
    <svg className="graf" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mediana salarial por nível e gênero">
      {tk.map((t) => (
        <g key={t}>
          <line className="grade-l" x1={x(t)} x2={x(t)} y1={T} y2={H - 22} />
          <text x={x(t)} y={H - 6} textAnchor="middle">{t === 0 ? '0' : brlCurto(t)}</text>
        </g>
      ))}
      {linhas.map((l, i) => {
        const yy = T + i * linha + linha / 2;
        const f = l.mediana_mulheres, m = l.mediana_homens;
        return (
          <g key={l.nivel_id}>
            <text x={L - 10} y={yy + 4} textAnchor="end">{l.nivel}</text>
            {l.suprimido && (f == null || m == null) ? (
              <>
                <rect className="bar-sup" x={L} y={yy - 10} width={W - R - L} height={20} rx="4" />
                <text className="sup-txt" x={L + 10} y={yy + 4}>{`grupo com menos de 5 (${l.n_mulheres} mulheres, ${l.n_homens} homens): oculto`}</text>
              </>
            ) : (
              <>
                {f != null && m != null ? <line className="liga" x1={x(f)} x2={x(m)} y1={yy} y2={yy} /> : null}
                {f != null ? <circle className="ponto2" cx={x(f)} cy={yy} r="6.5"><title>{`Mulheres: ${brlCurto(f)} (${l.n_mulheres})`}</title></circle> : null}
                {m != null ? <circle className="ponto1" cx={x(m)} cy={yy} r="6.5"><title>{`Homens: ${brlCurto(m)} (${l.n_homens})`}</title></circle> : null}
                {l.razao != null ? (
                  <text x={W - R + 8} y={yy + 4} className={l.razao < 0.95 ? 'rot-forte' : undefined}>{`${l.razao < 1 ? '−' : '+'}${Math.abs(Math.round((1 - l.razao) * 100))}%`}</text>
                ) : null}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Mini linha para o eNPS de cada área ao longo dos ciclos. */
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
