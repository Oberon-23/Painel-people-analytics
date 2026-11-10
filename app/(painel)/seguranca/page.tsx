import { Sql } from '@/components/Sql';
import { ArrowRight, Check, CircleCheck, Database, Filter, Globe, Minus, Server, ShieldCheck } from 'lucide-react';
import { Cabecalho } from '@/components/ui';
import { dataHora } from '@/lib/formato';
import { rodarProvas } from '@/lib/provas';
import { exigirSessao, NOME_PERFIL, type Perfil } from '@/lib/sessao';

const MATRIZ: { perfil: Perfil; quem: string; linhas: string; salario: string; cpf: string; agregados: string; auditoria: boolean }[] = [
  { perfil: 'diretoria_rh', quem: 'Helena · Diretoria de RH', linhas: 'Empresa toda', salario: 'Sim', cpf: 'Completo', agregados: 'Todos', auditoria: true },
  { perfil: 'hrbp', quem: 'Caio · HRBP Operações', linhas: 'Só a diretoria dele', salario: 'Sim', cpf: 'Mascarado', agregados: 'Da diretoria', auditoria: false },
  { perfil: 'gestor', quem: 'Patrícia · Gerente', linhas: 'Só a própria equipe', salario: 'Não', cpf: 'Não', agregados: 'Da equipe, sem salário', auditoria: false },
  { perfil: 'analista', quem: 'Rafael · People Analytics', linhas: 'Nenhuma', salario: 'Não', cpf: 'Não', agregados: 'Empresa toda, grupos ≥ 5', auditoria: false },
];

export default async function Seguranca() {
  const { token, sessao: s } = await exigirSessao();
  const provas = await rodarProvas(token, s.id, s.perfil);
  const barradas = provas.filter((p) => p.status !== 'permitido').length;
  const agora = new Date();

  return (
    <>
      <Cabecalho sobre="Segurança" titulo="O que você pode ver, e quem garante isso">
        Num painel comum, a tela recebe todos os dados e esconde parte deles. Aqui é o contrário: o banco de dados só
        entrega o que o seu perfil pode ver. Se a tela tiver um erro, ou se alguém tentar consultar direto, a regra continua valendo.
      </Cabecalho>

      <section className="card">
        <h2>Você agora: {s.nome}, {NOME_PERFIL[s.perfil]}</h2>
        <p className="sub">{s.cargo} · escopo: {s.escopo.toLowerCase()}</p>
        <div className="tabela-wrap">
          <table className="matriz">
            <thead>
              <tr><th>Perfil</th><th>Pessoas uma a uma</th><th>Salário individual</th><th>CPF</th><th>Indicadores</th><th>Auditoria</th></tr>
            </thead>
            <tbody>
              {MATRIZ.map((m) => (
                <tr key={m.perfil} className={m.perfil === s.perfil ? 'voce' : undefined}>
                  <td>{m.quem}{m.perfil === s.perfil ? <span className="fraco">você</span> : null}</td>
                  <td>{m.linhas}</td>
                  <td className={m.salario === 'Sim' ? 'sim' : 'nao'}>{m.salario}</td>
                  <td className={m.cpf === 'Não' ? 'nao' : 'sim'}>{m.cpf}</td>
                  <td>{m.agregados}</td>
                  <td>{m.auditoria ? <Check className="sim" size={16} aria-label="sim" /> : <Minus className="nao" size={16} aria-label="não" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Tentativas de passar por cima das regras</h2>
        <p className="sub">
          Executadas agora ({dataHora(agora)}), no banco, com a sua sessão. Cada uma roda dentro de uma transação desfeita
          no final, então nada muda de verdade. {barradas} de {provas.length} foram barradas ou filtradas pelo banco.
        </p>
        <div className="provas">
          {provas.map((p) => (
            <article key={p.titulo} className="prova">
              <span className={`ic ${p.status}`}>
                {p.status === 'bloqueado' ? <ShieldCheck size={20} aria-hidden="true" /> : p.status === 'filtrado' ? <Filter size={20} aria-hidden="true" /> : <CircleCheck size={20} aria-hidden="true" />}
              </span>
              <h3>{p.titulo}</h3>
              <span className={`res ${p.status}`}>{p.resultado}</span>
              <code><Sql texto={p.sql} /></code>
              <p>{p.explicacao}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Por onde o dado passa</h2>
        <p className="sub">Três etapas, e o dado só é liberado na última, pelo banco.</p>
        <div className="fluxo">
          <div className="no">
            <b><Globe size={18} aria-hidden="true" />Seu navegador</b>
            <ul>
              <li>Recebe páginas prontas, sem os dados brutos</li>
              <li>Sessão em cookie que o JavaScript não lê (httpOnly)</li>
              <li>Política de conteúdo (CSP) que bloqueia scripts de fora</li>
              <li>Nada fica em cache</li>
            </ul>
          </div>
          <span className="seta"><ArrowRight size={22} aria-hidden="true" /></span>
          <div className="no">
            <b><Server size={18} aria-hidden="true" />Servidor (Next.js)</b>
            <ul>
              <li>Confere a assinatura da sessão</li>
              <li>Guarda a senha do banco; o navegador nunca a vê</li>
              <li>Repassa a sessão ao banco a cada consulta</li>
              <li>Monta gráficos e tabelas e envia só o resultado</li>
            </ul>
          </div>
          <span className="seta"><ArrowRight size={22} aria-hidden="true" /></span>
          <div className="no db">
            <b><Database size={18} aria-hidden="true" />PostgreSQL</b>
            <ul>
              <li>Confere a sessão de novo, com um segredo próprio</li>
              <li>Aplica as regras por linha, coluna e grupo</li>
              <li>Usuário do aplicativo não vê tabela nenhuma, só a API</li>
              <li>Registra cada acesso a dado pessoal</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="camadas" aria-label="Camadas de proteção">
        <div className="camada"><span className="num">01 · LINHA</span><h3>Cada perfil, suas pessoas</h3><p>Row Level Security no PostgreSQL. A gerente consulta a tabela inteira e recebe só a equipe dela, porque o filtro é do banco.</p></div>
        <div className="camada"><span className="num">02 · COLUNA</span><h3>Dado sensível sob medida</h3><p>O usuário do aplicativo não enxerga nenhuma tabela. Salário e CPF só saem por funções que conferem o perfil e mascaram o CPF; data de nascimento não sai nunca.</p></div>
        <div className="camada"><span className="num">03 · GRUPO</span><h3>Nada de grupos pequenos</h3><p>Com menos de 5 pessoas, uma média revela alguém. Esses grupos saem ocultos, junto com mais um quando preciso, para que o total não entregue o oculto. O clima nem guarda quem respondeu.</p></div>
        <div className="camada"><span className="num">04 · RASTRO</span><h3>Tudo registrado</h3><p>Toda leitura de pessoas passa por funções que gravam usuário, filtro e quantidade: não há caminho sem rastro. O aplicativo não consegue apagar o registro.</p></div>
      </section>
    </>
  );
}
