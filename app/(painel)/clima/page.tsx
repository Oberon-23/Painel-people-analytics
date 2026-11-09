import { Mini } from '@/components/graficos';
import { Cabecalho, Oculto } from '@/components/ui';
import { clima } from '@/lib/dados';
import { ciclo as nomeCiclo, sinal } from '@/lib/formato';
import { exigirSessao } from '@/lib/sessao';

export default async function Clima() {
  const { token } = await exigirSessao();
  const linhas = await clima(token);
  const ciclos = [...new Set(linhas.map((l) => l.ciclo))].sort();
  const areas = [...new Map(linhas.map((l) => [l.area_id, l.area])).entries()];
  const celula = (a: number, c: string) => linhas.find((l) => l.area_id === a && l.ciclo === c);
  const ultimo = ciclos[ciclos.length - 1];
  const atuais = areas
    .map(([id, nome]) => ({ nome, atual: celula(id, ultimo), antes: celula(id, ciclos[0]) }))
    .filter((x) => x.atual?.enps != null);
  const queda = [...atuais].filter((x) => x.antes?.enps != null).sort((a, b) => (a.atual!.enps! - a.antes!.enps!) - (b.atual!.enps! - b.antes!.enps!))[0];
  const ocultas = areas.filter(([id]) => celula(id, ultimo)?.suprimido).map(([, n]) => n);

  return (
    <>
      <Cabecalho sobre="Pesquisa de clima" titulo="eNPS por área">
        Pergunta: &quot;De 0 a 10, quanto você recomendaria a Rotalume como lugar para trabalhar?&quot; eNPS = % de notas 9 e 10
        menos % de notas 0 a 6. A pesquisa é semestral e anônima.
      </Cabecalho>

      <section className="card manchete">
        <h1>
          {queda && queda.antes!.enps! - queda.atual!.enps! > 15
            ? `${queda.nome} teve a maior queda: o eNPS foi de ${sinal(queda.antes!.enps)} para ${sinal(queda.atual!.enps)} em dois anos.`
            : 'O clima está estável entre os ciclos.'}
        </h1>
        <ul className="achados">
          <li>
            <span className="ponto ok" aria-hidden="true" />
            <span>
              <b>Anônima pelo desenho:</b> a tabela de respostas não tem coluna que ligue a nota à pessoa. Nem a
              Diretoria de RH, nem quem administra o banco consegue saber quem respondeu o quê.
            </span>
          </li>
          {ocultas.length ? (
            <li>
              <span className="ponto ok" aria-hidden="true" />
              <span>{`${ocultas.join(', ')}: menos de 5 respostas no ciclo, então o resultado fica oculto para todos os perfis, inclusive a diretoria.`}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Área</th>
                {ciclos.map((c) => <th key={c} className="n">{nomeCiclo(c)}</th>)}
                <th>Tendência</th>
                <th className="n">Respostas</th>
              </tr>
            </thead>
            <tbody>
              {areas.map(([id, nome]) => {
                const vals = ciclos.map((c) => celula(id, c)?.enps ?? null);
                return (
                  <tr key={id}>
                    <td>{nome}</td>
                    {ciclos.map((c) => {
                      const x = celula(id, c);
                      return (
                        <td key={c} className={`n ${tom(x?.enps)}`}>
                          {x?.suprimido || x?.enps == null ? <Oculto texto="< 5" /> : sinal(x.enps)}
                        </td>
                      );
                    })}
                    <td><Mini valores={vals} /></td>
                    <td className="n">{celula(id, ultimo)?.respostas ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function tom(v: number | null | undefined) {
  if (v == null) return '';
  if (v < -10) return 'calor-3';
  if (v < 0) return 'calor-2';
  if (v < 15) return 'calor-1';
  if (v >= 40) return 'calor-b2';
  return 'calor-b1';
}
