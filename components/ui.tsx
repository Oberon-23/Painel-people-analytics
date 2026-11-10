import { Sql } from './Sql';
import { Lock, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function Cabecalho({ sobre, titulo, children }: { sobre: string; titulo: string; children?: ReactNode }) {
  return (
    <header className="cabec">
      <span className="sobre">{sobre}</span>
      <h1>{titulo}</h1>
      {children ? <p>{children}</p> : null}
    </header>
  );
}

export function Kpi({ rotulo, valor, detalhe, oculto }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; oculto?: boolean }) {
  return (
    <div className="card kpi">
      <span className="rot">{rotulo}</span>
      {oculto ? (
        <span className="val"><Oculto texto="sem acesso" /></span>
      ) : (
        <span className="val">{valor}</span>
      )}
      {detalhe ? <span className="det">{detalhe}</span> : null}
    </div>
  );
}

export function Oculto({ texto = 'oculto' }: { texto?: string }) {
  return (
    <span className="oculto" title="O banco não devolveu este dado para o seu perfil">
      <Lock size={13} aria-hidden="true" />
      {texto}
    </span>
  );
}

export function Bloqueio({ titulo, children, sql, erro }: { titulo: string; children: ReactNode; sql?: string; erro?: string }) {
  return (
    <section className="card bloqueio">
      <span className="icone"><Lock size={22} aria-hidden="true" /></span>
      <h2>{titulo}</h2>
      <p>{children}</p>
      {sql ? (
        <pre className="terminal" aria-label="Consulta SQL e resposta do banco">
          <span className="linha"><span className="prompt" aria-hidden="true">&gt; </span><Sql texto={sql.split('\n')[0]} /></span>
          {sql.split('\n').slice(1).map((l, i) => <span key={i} className="linha resultado">{l}</span>)}
          {erro ? <span className="linha erro"><b>ERRO:</b> {erro}</span> : null}
        </pre>
      ) : null}
    </section>
  );
}

export function AvisoRegistro({ children }: { children: ReactNode }) {
  return (
    <div className="aviso info">
      <ShieldCheck size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
