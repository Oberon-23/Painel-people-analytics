import { RefreshCw } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { Bloqueio, Cabecalho } from '@/components/ui';
import { auditoria, estaBloqueado } from '@/lib/dados';
import { comUsuario } from '@/lib/db';
import { dataHora } from '@/lib/formato';
import { exigirSessao, NOME_PERFIL, type Perfil } from '@/lib/sessao';

async function atualizarAgora() {
  'use server';
  const { token, sessao } = await exigirSessao();
  if (!sessao.pode.auditoria) return;
  await comUsuario(token, async (c) => {
    await c.query("select api.atualizar_dados('manual')");
    await c.query("select api.registrar('atualização manual dos dados')");
  });
  revalidatePath('/', 'layout');
}

export default async function Auditoria() {
  const { token } = await exigirSessao();
  const a = await auditoria(token);

  if (estaBloqueado(a)) {
    return (
      <>
        <Cabecalho sobre="Auditoria" titulo="Quem acessou o quê" />
        <Bloqueio titulo="Esta tela não está disponível para o seu perfil">
          O registro de acessos é restrito à Diretoria de RH. Os seus acessos a dados pessoais continuam sendo registrados,
          e a diretoria pode consultá-los.
        </Bloqueio>
      </>
    );
  }

  return (
    <>
      <Cabecalho sobre="Auditoria" titulo="Quem acessou o quê">
        Cada login, consulta à lista de pessoas e exportação é gravada pelo próprio banco. O usuário do aplicativo não tem
        nenhuma permissão na tabela: não lê, não altera e não apaga. Esta página usa uma função do banco que só responde
        para a Diretoria de RH.
      </Cabecalho>

      <section className="card">
        <h2>Últimos 30 dias por usuário</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Usuário</th><th>Perfil</th><th className="n">Acessos</th><th className="n">Pessoas exibidas ou exportadas</th><th className="n">Último acesso</th></tr></thead>
            <tbody>
              {a.resumo.map((r) => (
                <tr key={r.usuario}>
                  <td>{r.usuario}</td>
                  <td>{NOME_PERFIL[r.perfil as Perfil]}</td>
                  <td className="n">{r.acessos}</td>
                  <td className="n">{r.linhas}</td>
                  <td className="n">{dataHora(r.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Atualização dos dados</h2>
        <p className="sub">
          Todo dia às 6h um agendamento na Vercel chama o banco, que processa o dia (ausências, desligamentos e
          admissões simuladas). O botão abaixo faz a mesma coisa na hora.
        </p>
        <form action={atualizarAgora}>
          <button className="btn" type="submit"><RefreshCw size={15} aria-hidden="true" />Atualizar agora</button>
        </form>
      </section>

      <section className="card">
        <h2>Registro de acessos</h2>
        <p className="sub">Os 150 eventos mais recentes.</p>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Detalhe</th><th className="n">Pessoas</th></tr></thead>
            <tbody>
              {a.linhas.map((l, i) => (
                <tr key={i}>
                  <td className="mono">{dataHora(l.quando)}</td>
                  <td>{l.usuario}<span className="fraco">{NOME_PERFIL[l.perfil as Perfil]}</span></td>
                  <td>{l.acao}</td>
                  <td>{l.detalhe ?? '—'}</td>
                  <td className="n">{l.linhas ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
