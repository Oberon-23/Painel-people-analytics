import { AlertCircle, ChevronRight, ShieldCheck } from 'lucide-react';
import { entrar, entrarComo } from './acoes';

export const dynamic = 'force-dynamic';

const PERFIS = [
  { email: 'helena@rotalume.demo', nome: 'Helena Duarte', papel: 'Diretora de Pessoas e Cultura', ve: 'Vê a empresa toda, com salário e CPF' },
  { email: 'caio@rotalume.demo', nome: 'Caio Mendes', papel: 'HR Business Partner · Operações', ve: 'Só a Diretoria de Operações, CPF mascarado' },
  { email: 'patricia@rotalume.demo', nome: 'Patrícia Lima', papel: 'Gerente de Produção', ve: 'Só a própria equipe, sem salário e sem CPF' },
  { email: 'rafael@rotalume.demo', nome: 'Rafael Costa', papel: 'Analista de People Analytics', ve: 'Nenhuma pessoa individual, só grupos de 5 ou mais' },
];

const ERROS: Record<string, string> = {
  invalido: 'E-mail ou senha incorretos.',
  bloqueado: 'Muitas tentativas erradas. Esse e-mail ficou bloqueado por 15 minutos.',
};

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const erro = sp.erro ? ERROS[sp.erro] : sp.expirou ? 'Sua sessão expirou. Entre de novo.' : null;
  return (
    <div className="login">
      <section className="login-lado">
        <span className="marca">
          <span className="marca-icone"><ShieldCheck size={18} aria-hidden="true" /></span>
          <span>Rotalume<small>People Analytics</small></span>
        </span>
        <h1>Um painel de RH em que o banco de dados decide o que cada pessoa vê.</h1>
        <p>
          Turnover, absenteísmo, clima e remuneração de uma empresa fictícia com 350 pessoas. Entre com perfis
          diferentes e compare: os números mudam porque cada um recebe só o que pode ver.
        </p>
        <ul>
          <li><ShieldCheck size={18} aria-hidden="true" />Permissão por linha (RLS) no PostgreSQL: o filtro não depende da tela.</li>
          <li><ShieldCheck size={18} aria-hidden="true" />Salário e CPF mascarados por perfil; grupos com menos de 5 pessoas ocultos.</li>
          <li><ShieldCheck size={18} aria-hidden="true" />Sessão assinada que o próprio banco confere, e todo acesso a dado pessoal registrado.</li>
        </ul>
      </section>

      <section className="login-form">
        <h2>Escolha um perfil para entrar</h2>
        {erro ? <p className="erro" role="alert"><AlertCircle size={16} aria-hidden="true" />{erro}</p> : null}
        <div className="perfis">
          {PERFIS.map((p) => (
            <form key={p.email} action={entrarComo}>
              <input type="hidden" name="email" value={p.email} />
              <button className="perfil-btn" type="submit">
                <span className="av" aria-hidden="true">{p.nome.split(' ').map((n) => n[0]).join('')}</span>
                <b>{p.nome} · {p.papel}</b>
                <span className="ve">{p.ve}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </form>
          ))}
        </div>
        <details>
          <summary>Entrar com e-mail e senha</summary>
          <form action={entrar} className="manual">
            <label className="campo">E-mail<input name="email" type="email" autoComplete="username" required /></label>
            <label className="campo">Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
            <button className="btn prim" type="submit">Entrar</button>
            <p className="neutro">Contas de demonstração: os e-mails acima, senha <code>rotalume-demo</code>. Dados 100% fictícios.</p>
          </form>
        </details>
      </section>
    </div>
  );
}
