import { DiferencaSalarial } from '@/components/graficos';
import { Bloqueio, Cabecalho, Oculto } from '@/components/ui';
import { estaBloqueado, remuneracao } from '@/lib/dados';
import { brl } from '@/lib/formato';
import { exigirSessao } from '@/lib/sessao';

export default async function Remuneracao() {
  const { token, sessao: s } = await exigirSessao();
  const r = await remuneracao(token);

  if (estaBloqueado(r)) {
    return (
      <>
        <Cabecalho sobre="Remuneração" titulo="Igualdade salarial por nível" />
        <Bloqueio titulo="Seu perfil não acessa remuneração" sql="select * from api.remuneracao();" erro={r.motivo}>
          Gestores acompanham a própria equipe, mas não os salários dela. A consulta acima foi feita agora e o banco
          recusou: a regra está no banco, então nenhuma tela, exportação ou chamada direta consegue esses números com o seu perfil.
        </Bloqueio>
      </>
    );
  }

  const visiveis = r.filter((l) => l.razao != null);
  const pior = [...visiveis].sort((a, b) => (a.razao ?? 1) - (b.razao ?? 1))[0];
  const ocultos = r.filter((l) => l.suprimido);

  return (
    <>
      <Cabecalho sobre="Remuneração" titulo="Igualdade salarial por nível">
        Mediana do salário de mulheres e homens no mesmo nível, como no relatório de transparência salarial da
        Lei 14.611/2023. {s.perfil === 'analista' ? 'Você vê só grupos; nenhum salário individual chega ao seu perfil.' : ''}
      </Cabecalho>

      <section className="card manchete">
        <h1>
          {pior && pior.razao! < 0.97
            ? `No nível ${pior.nivel}, a mediana das mulheres é ${Math.round((1 - pior.razao!) * 100)}% menor que a dos homens (${brl(pior.mediana_mulheres)} contra ${brl(pior.mediana_homens)}).`
            : 'Nos níveis comparáveis, as medianas de mulheres e homens estão próximas.'}
        </h1>
        <ul className="achados">
          <li><span className="ponto atencao" aria-hidden="true" /><span>{`${visiveis.filter((l) => l.razao! < 0.97).length} de ${visiveis.length} níveis comparáveis têm diferença acima de 3% contra as mulheres.`}</span></li>
          {ocultos.length ? (
            <li><span className="ponto ok" aria-hidden="true" /><span>{`${ocultos.map((l) => l.nivel).join(' e ')} ${ocultos.length > 1 ? 'ficam ocultos' : 'fica oculto'}: com menos de 5 pessoas de um dos gêneros, a mediana revelaria o salário de alguém.`}</span></li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <h2>Diferença salarial por nível</h2>
        <p className="sub">
          Quanto a mediana das mulheres fica acima ou abaixo da dos homens no mesmo nível. Em vermelho, diferenças maiores
          que 3% contra as mulheres. Os valores em reais estão na tabela abaixo.
        </p>
        <div className="legenda">
          <span><i className="c1" />Diferença de até 3%</span>
          <span><i className="bad" />Mais de 3% contra as mulheres</span>
          <span><i className="lk" />Grupo oculto (menos de 5 mulheres ou homens)</span>
        </div>
        <DiferencaSalarial linhas={r} />
      </section>

      <section className="card">
        <h2>Medianas por nível</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Nível</th><th className="n">Mulheres</th><th className="n">Homens</th><th className="n">Mediana mulheres</th><th className="n">Mediana homens</th><th className="n">Mulheres / homens</th></tr>
            </thead>
            <tbody>
              {r.map((l) => (
                <tr key={l.nivel_id}>
                  <td>{l.nivel}</td>
                  <td className="n">{l.n_mulheres}</td>
                  <td className="n">{l.n_homens}</td>
                  <td className="n">{l.mediana_mulheres != null ? brl(l.mediana_mulheres) : <Oculto texto="< 5" />}</td>
                  <td className="n">{l.mediana_homens != null ? brl(l.mediana_homens) : <Oculto texto="< 5" />}</td>
                  <td className={`n ${l.razao != null && l.razao < 0.93 ? 'calor-2' : l.razao != null && l.razao < 0.97 ? 'calor-1' : ''}`}>
                    {l.razao != null ? `${(l.razao * 100).toFixed(1).replace('.', ',')}%` : <Oculto texto="oculto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
