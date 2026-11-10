import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import { AvisoRegistro, Bloqueio, Cabecalho, Oculto } from '@/components/ui';
import { areasVisiveis, pessoas, type FiltroPessoas } from '@/lib/dados';
import { brl, data } from '@/lib/formato';
import { exigirSessao } from '@/lib/sessao';

const SITUACOES = { ativos: 'Ativos', desligados: 'Desligados', previstos: 'Admissão agendada', todos: 'Todos' } as const;
const ORDENS = { nome: 'Nome', area: 'Área', nivel: 'Nível', admissao: 'Admissão mais recente', salario: 'Maior salário' } as const;

export default async function Pessoas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token, sessao: s } = await exigirSessao();
  const sp = await searchParams;

  if (!s.pode.individual) {
    return (
      <>
        <Cabecalho sobre="Pessoas" titulo="Lista de colaboradores" />
        <Bloqueio titulo="Esta tela não está disponível para o seu perfil">
          Para proteger a privacidade das pessoas, o seu perfil trabalha só com números de grupos, como turnover, clima e
          absenteísmo por área. A lista individual de colaboradores fica restrita a quem precisa dela no trabalho.
        </Bloqueio>
      </>
    );
  }

  const f: FiltroPessoas = {
    busca: sp.q?.slice(0, 60) || undefined,
    area: sp.area || undefined,
    situacao: sp.situacao && sp.situacao in SITUACOES ? (sp.situacao as FiltroPessoas['situacao']) : 'ativos',
    ordem: sp.ordem && sp.ordem in ORDENS ? (sp.ordem as FiltroPessoas['ordem']) : 'nome',
    pagina: Math.max(1, Number(sp.pagina) || 1),
  };
  const [r, areas] = await Promise.all([pessoas(token, f), areasVisiveis(token)]);
  const paginas = Math.max(1, Math.ceil(r.total / 25));
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const tudo = { q: f.busca, area: f.area, situacao: f.situacao, ordem: f.ordem, ...extra };
    for (const [k, v] of Object.entries(tudo)) if (v != null && v !== '') p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <>
      <Cabecalho sobre="Pessoas" titulo="Lista de colaboradores">
        Seu escopo: {s.escopo.toLowerCase()} ({s.pessoas_visiveis} registros, contando desligados).{' '}
        {s.pode.salario ? (s.pode.cpf && s.perfil === 'diretoria_rh' ? 'Salário e CPF completos.' : 'Salário visível; CPF mascarado.') : 'Salário e CPF não chegam ao seu perfil.'}
      </Cabecalho>

      <AvisoRegistro>
        <b>Esta consulta ficou registrada.</b> Toda vez que alguém abre esta lista ou exporta dados, o banco grava quem
        foi, quando, o filtro usado e quantas pessoas apareceram. A Diretoria de RH vê esse registro em Auditoria.
      </AvisoRegistro>

      <section className="card">
        <form className="filtros" method="get">
          <label className="campo">Buscar nome ou cargo<input name="q" defaultValue={f.busca} placeholder="Ex.: Silva, técnico" /></label>
          <label className="campo">Área
            <select name="area" defaultValue={f.area ?? ''}>
              <option value="">Todas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="campo">Situação
            <select name="situacao" defaultValue={f.situacao}>
              {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="campo">Ordenar por
            <select name="ordem" defaultValue={f.ordem}>
              {Object.entries(ORDENS).filter(([k]) => k !== 'salario' || s.pode.salario).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <button className="btn prim" type="submit"><Search size={15} aria-hidden="true" />Filtrar</button>
          {s.pode.exportar ? (
            <a className="btn" href={`/api/exportar${qs({})}`}><Download size={15} aria-hidden="true" />Exportar CSV</a>
          ) : null}
        </form>
      </section>

      <section className="card">
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Área</th>
                <th>Unidade</th>
                <th>Gestor(a)</th>
                <th className="n">Admissão</th>
                <th>CPF</th>
                <th className="n">Salário</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.length === 0 ? (
                <tr><td colSpan={8} className="neutro">Ninguém encontrado com esses filtros.</td></tr>
              ) : null}
              {r.linhas.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}{p.desligamento ? <span className="fraco">Desligado em {data(p.desligamento)} · {p.tipo_desligamento === 'voluntario' ? 'pedido' : 'empresa'}</span> : null}</td>
                  <td>{p.cargo}<span className="fraco">{p.nivel}</span></td>
                  <td>{p.area}</td>
                  <td>{p.unidade}</td>
                  <td>{p.gestor ?? <Oculto texto="fora do escopo" />}</td>
                  <td className="n">{data(p.admissao)}</td>
                  <td className="mono">{p.cpf ?? <Oculto />}</td>
                  <td className="n">{p.salario != null ? brl(p.salario) : <Oculto />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="paginacao">
          <span>{r.total} pessoas · página {f.pagina} de {paginas}</span>
          <span>
            <Link className="btn" aria-disabled={f.pagina! <= 1} href={qs({ pagina: f.pagina! - 1 })}>Anterior</Link>{' '}
            <Link className="btn" aria-disabled={f.pagina! >= paginas} href={qs({ pagina: f.pagina! + 1 })}>Próxima</Link>
          </span>
        </div>
      </section>
    </>
  );
}
