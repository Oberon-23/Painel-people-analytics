import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import Nav from '@/components/Nav';
import BotaoTema from '@/components/Tema';
import { lerTema } from '@/lib/tema';
import { exigirSessao, NOME_PERFIL } from '@/lib/sessao';
import { data, dataHora } from '@/lib/formato';
import { sair } from '../login/acoes';

export const dynamic = 'force-dynamic';

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { sessao: s } = await exigirSessao();
  const tema = await lerTema();
  const itens = [
    { href: '/', rotulo: 'Visão geral' },
    { href: '/pessoas', rotulo: 'Pessoas', bloqueado: !s.pode.individual },
    { href: '/remuneracao', rotulo: 'Remuneração', bloqueado: !s.pode.salario_agregado },
    { href: '/clima', rotulo: 'Clima' },
    { href: '/seguranca', rotulo: 'Segurança' },
    { href: '/auditoria', rotulo: 'Auditoria', bloqueado: !s.pode.auditoria },
  ];
  return (
    <>
      <header className="topo">
        <div className="topo-in">
          <Link href="/" className="marca">
            <span className="marca-icone"><ShieldCheck size={18} aria-hidden="true" /></span>
            <span>Rotalume<small>People Analytics</small></span>
          </Link>
          <Nav itens={itens} />
          <div className="usuario">
            <span className="quem">
              <b>{s.nome}</b>
              <small>{NOME_PERFIL[s.perfil]}</small>
            </span>
            <BotaoTema inicial={tema} />
            <form action={sair}>
              <button className="btn-sair" type="submit"><LogOut size={14} aria-hidden="true" />Trocar perfil</button>
            </form>
          </div>
        </div>
      </header>
      <div className="faixa">
        <div className="faixa-in">
          <span className="item"><ShieldCheck size={15} aria-hidden="true" />Escopo: <b>{s.escopo}</b></span>
          {s.pode.individual ? <span className="item">{s.pessoas_visiveis} registros visíveis um a um (ativos e desligados)</span> : <span className="item">Sem acesso a dados individuais</span>}
          <span className="item">Dados até {data(s.dados_ate)} · atualizado em {dataHora(s.ultima_atualizacao)}</span>
          <Link href="/seguranca">O que você pode ver e por quê</Link>
        </div>
      </div>
      <main>{children}</main>
      <footer className="rodape">
        Rotalume é uma empresa fictícia. Nomes, CPFs (propositalmente inválidos), salários e respostas foram gerados por
        sorteio. Projeto de portfólio de Breno Silva.
      </footer>
    </>
  );
}
