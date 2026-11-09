import Link from 'next/link';
import { BarrasMovimento, LinhaPercentual, LinhaPessoas, TurnoverPorArea } from '@/components/graficos';
import { Kpi, Oculto } from '@/components/ui';
import { kpis, porArea, serieMensal } from '@/lib/dados';
import { anos, int, pct, pp, sinal } from '@/lib/formato';
import { lerResultados } from '@/lib/leitura';
import { exigirSessao } from '@/lib/sessao';

export default async function VisaoGeral() {
  const { token, sessao: s } = await exigirSessao();
  const [k, meses, areas] = await Promise.all([kpis(token), serieMensal(token, 24), porArea(token)]);
  const quem = s.perfil === 'gestor' ? 'sua equipe' : s.perfil === 'hrbp' ? 'a Diretoria de Operações' : 'a Rotalume';
  const { manchete, achados } = lerResultados(k, areas, quem);
  const mesesFechados = meses.slice(0, -1);
  const turnSobe = k.turnover_12m != null && k.turnover_ant != null && k.turnover_12m > k.turnover_ant;
  const absSobe = k.absenteismo_3m != null && k.absenteismo_ant != null && k.absenteismo_3m > k.absenteismo_ant;
  const variosSetores = areas.length > 1;
  const variacaoAus = areas
    .filter((a) => !a.suprimido && (a.headcount ?? 0) >= 10 && a.absenteismo_3m != null && a.absenteismo_ant != null)
    .sort((a, b) => (b.absenteismo_3m! - b.absenteismo_ant!) - (a.absenteismo_3m! - a.absenteismo_ant!))
    .slice(0, 4);

  return (
    <>
      <section className="card manchete">
        <h1>{manchete.charAt(0).toUpperCase() + manchete.slice(1)}</h1>
        {achados.length ? (
          <ul className="achados">
            {achados.map((a) => (
              <li key={a.texto}>
                <span className={`ponto ${a.tom}`} aria-hidden="true" />
                <span>{a.texto} {a.link ? <Link href={a.link}>Ver</Link> : null}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {k.suprimido ? null : (
        <section className="kpis" aria-label="Indicadores principais">
          <Kpi rotulo="Pessoas hoje" valor={int(k.headcount)} detalhe={k.admissoes_previstas === 1 ? '1 admissão agendada' : `${k.admissoes_previstas} admissões agendadas`} />
          <Kpi
            rotulo="Turnover 12 meses"
            valor={pct(k.turnover_12m, 1)}
            detalhe={<span className={turnSobe ? 'sobe-ruim' : 'desce-bom'}>{pp(k.turnover_12m, k.turnover_ant, 1)} vs. ano anterior</span>}
          />
          <Kpi
            rotulo="Saídas por pedido de demissão"
            valor={k.desligamentos_12m ? pct(k.voluntarios_12m / k.desligamentos_12m) : '—'}
            detalhe={`${k.voluntarios_12m} de ${k.desligamentos_12m} desligamentos`}
          />
          <Kpi
            rotulo="Absenteísmo 3 meses"
            valor={pct(k.absenteismo_3m, 1)}
            detalhe={<span className={absSobe ? 'sobe-ruim' : 'desce-bom'}>{pp(k.absenteismo_3m, k.absenteismo_ant, 1)} vs. 3 meses antes</span>}
          />
          <Kpi rotulo="Tempo médio de casa" valor={anos(k.tempo_casa_anos)} />
          <Kpi
            rotulo="Mulheres na liderança"
            valor={pct(k.pct_mulheres_lideranca)}
            detalhe={`${pct(k.pct_mulheres)} do quadro total`}
          />
          <Kpi
            rotulo="Salário médio"
            valor={k.salario_medio != null ? `R$ ${int(k.salario_medio)}` : null}
            oculto={k.salario_medio == null}
            detalhe={k.salario_medio == null ? 'Seu perfil não acessa remuneração' : 'Média do quadro ativo'}
          />
        </section>
      )}

      <div className="grade g2">
        <section className="card cartao-graf">
          <h2>Admissões e desligamentos</h2>
          <p className="sub">Por mês, nos últimos 2 anos. A faixa marca o período em que as saídas aceleraram.</p>
          <div className="legenda">
            <span><i className="c1" />Admissões</span>
            <span><i className="c2" />Desligamentos</span>
          </div>
          <BarrasMovimento meses={mesesFechados} mesesDestaque={9} />
        </section>
        <section className="card cartao-graf">
          <h2>Pessoas no fim do mês</h2>
          <p className="sub">Quadro ativo, contando só quem já foi admitido. O eixo não começa no zero para mostrar a variação.</p>
          <div className="legenda"><span><i className="c1 linha" />Pessoas</span></div>
          <LinhaPessoas meses={mesesFechados} />
        </section>
      </div>

      <div className="grade g-7-5">
        {variosSetores ? (
          <section className="card">
            <h2>Turnover por área</h2>
            <p className="sub">Saídas dos últimos 12 meses sobre a média de pessoas no período. Em vermelho, áreas com mais de 1,5 vez a média.</p>
            <TurnoverPorArea areas={areas} media={k.turnover_12m} rotuloMedia={s.perfil === 'gestor' ? 'média da equipe' : s.perfil === 'hrbp' ? 'média da diretoria' : 'média da empresa'} />
          </section>
        ) : (
          <section className="card">
            <h2>Sua área</h2>
            <p className="sub">Seu escopo tem uma área só, então não há comparação entre áreas.</p>
            <TabelaAreas areas={areas} />
          </section>
        )}
        <section className="card">
          <h2>Absenteísmo</h2>
          <p className="sub">Dias de ausência (atestado e falta) sobre os dias úteis, nos últimos 12 meses.</p>
          <LinhaPercentual meses={mesesFechados.slice(-12).map((m) => ({ mes: m.mes, v: m.absenteismo }))} referencia={0.02} rotuloReferencia="referência 2%" />
          {variacaoAus.length ? (
            <ul className="lista-var">
              <li><h3>Variação por área: últimos 3 meses contra os 3 anteriores</h3></li>
              {variacaoAus.map((a) => (
                <li key={a.area_id}>
                  <span>{a.area}</span>
                  <b>{pct(a.absenteismo_3m, 1)}</b>
                  <span className={(a.absenteismo_3m ?? 0) > (a.absenteismo_ant ?? 0) ? 'sobe-ruim' : 'desce-bom'}>{pp(a.absenteismo_3m, a.absenteismo_ant, 1)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      {variosSetores ? (
        <section className="card">
          <h2>Indicadores por área</h2>
          <p className="sub">Áreas com menos de 5 pessoas aparecem ocultas para quem não tem acesso individual: em grupos tão pequenos, a média revela a pessoa.</p>
          <TabelaAreas areas={areas} />
        </section>
      ) : null}
    </>
  );
}

function TabelaAreas({ areas }: { areas: Awaited<ReturnType<typeof porArea>> }) {
  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>Área</th>
            <th className="n">Pessoas</th>
            <th className="n">Turnover 12m</th>
            <th className="n">Pedido de demissão</th>
            <th className="n">Absenteísmo 3m</th>
            <th className="n">eNPS</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.area_id}>
              <td>{a.area}<span className="fraco">{a.diretoria}</span></td>
              {a.suprimido ? (
                <td colSpan={5} className="n"><Oculto texto="menos de 5 pessoas" /></td>
              ) : (
                <>
                  <td className="n">{int(a.headcount)}</td>
                  <td className={`n ${calor(a.turnover_12m, [0.15, 0.25, 0.4])}`}>{pct(a.turnover_12m)}</td>
                  <td className="n">{pct(a.pct_voluntario)}</td>
                  <td className={`n ${calor(a.absenteismo_3m, [0.02, 0.025, 0.03])}`}>
                    {pct(a.absenteismo_3m, 1)}
                    <span className="fraco">{pp(a.absenteismo_3m, a.absenteismo_ant, 1)}</span>
                  </td>
                  <td className="n">{a.enps == null ? <Oculto texto="< 5 respostas" /> : sinal(a.enps)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="legenda-calor">
        <span>Cores: quanto mais forte, pior.</span>
        <span><i className="chip calor-1" />Turnover a partir de 15% · absenteísmo a partir de 2%</span>
        <span><i className="chip calor-2" />25% · 2,5%</span>
        <span><i className="chip calor-3" />40% · 3%</span>
      </p>
    </div>
  );
}

function calor(v: number | null, limites: [number, number, number]) {
  if (v == null) return '';
  if (v >= limites[2]) return 'calor-3';
  if (v >= limites[1]) return 'calor-2';
  if (v >= limites[0]) return 'calor-1';
  return '';
}
