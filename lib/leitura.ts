import type { Area, Kpis } from './dados';
import { pct, sinal } from './formato';

export type Achado = { tom: 'alerta' | 'atencao' | 'ok'; texto: string; link?: string };

/**
 * Transforma os números em frases. Só usa o que o banco devolveu para
 * este usuário: se um grupo foi suprimido, ele simplesmente não entra.
 */
export function lerResultados(k: Kpis, areas: Area[], quem: string): { manchete: string; achados: Achado[] } {
  const achados: Achado[] = [];
  if (k.suprimido || k.headcount == null) {
    return { manchete: 'Seu escopo tem menos de 5 pessoas, então os indicadores ficam ocultos.', achados };
  }

  const t = k.turnover_12m;
  const subiu = t != null && k.turnover_ant != null && t - k.turnover_ant > 0.02;
  let manchete =
    t == null
      ? `${quem} tem ${k.headcount} pessoas hoje.`
      : `Nos últimos 12 meses, ${quem} teve ${k.desligamentos_12m} desligamentos: turnover de ${pct(t)}` +
        (k.turnover_ant != null ? `, ${subiu ? 'acima dos' : 'contra'} ${pct(k.turnover_ant)} do ano anterior.` : '.');

  const comparaveis = areas.filter((a) => !a.suprimido && (a.headcount ?? 0) >= 10);

  if (t != null && comparaveis.length > 1) {
    const pior = [...comparaveis].sort((a, b) => (b.turnover_12m ?? 0) - (a.turnover_12m ?? 0))[0];
    if (pior.turnover_12m != null && pior.turnover_12m > t * 1.5) {
      const texto =
        `${pior.area} concentra as saídas: turnover de ${pct(pior.turnover_12m)}` +
        (pior.pct_voluntario != null ? `, ${pct(pior.pct_voluntario)} por pedido de demissão` : '') +
        (pior.enps != null ? `, com clima em eNPS ${sinal(pior.enps)}.` : '.');
      achados.push({ tom: 'alerta', texto, link: '/clima' });
      manchete += ` ${pior.area} puxa esse número.`;
    }
  }

  const altas = comparaveis
    .filter((a) => a.absenteismo_3m != null && a.absenteismo_ant != null)
    .map((a) => ({ a, d: (a.absenteismo_3m ?? 0) - (a.absenteismo_ant ?? 0) }))
    .sort((x, y) => y.d - x.d);
  if (altas[0] && altas[0].d > 0.005) {
    const { a } = altas[0];
    achados.push({
      tom: 'atencao',
      texto: `O absenteísmo de ${a.area} subiu de ${pct(a.absenteismo_ant, 1)} para ${pct(a.absenteismo_3m, 1)} nos últimos 3 meses.`,
    });
  } else if (k.absenteismo_3m != null) {
    achados.push({ tom: 'ok', texto: `Absenteísmo estável: ${pct(k.absenteismo_3m, 1)} nos últimos 3 meses.` });
  }

  if (k.pct_mulheres != null && k.pct_mulheres_lideranca != null && k.lideres >= 5 && k.pct_mulheres_lideranca < k.pct_mulheres - 0.03) {
    achados.push({
      tom: 'atencao',
      texto: `Mulheres são ${pct(k.pct_mulheres)} do quadro, mas ${pct(k.pct_mulheres_lideranca)} da liderança.`,
      link: '/remuneracao',
    });
  }

  if (k.admissoes_previstas > 0) {
    achados.push({ tom: 'ok', texto: k.admissoes_previstas === 1 ? '1 admissão já agendada para as próximas semanas.' : `${k.admissoes_previstas} admissões já agendadas para as próximas semanas.` });
  }

  return { manchete, achados };
}
