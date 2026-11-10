import type { ReactNode } from 'react';

const PALAVRAS = new Set(
  'select from where update delete insert into set values limit order by group having join left right inner on and or not null as distinct begin rollback commit like in is between case when then else end create drop alter table with returning union all desc asc'.split(' '),
);

const PADRAO = /('(?:[^']|'')*')|(--[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(\s*\()?/g;

/** Realce simples de SQL, sem biblioteca. Cada trecho recebe uma classe; as cores vêm dos tokens do tema. */
export function Sql({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  let k = 0;
  for (const m of texto.matchAll(PADRAO)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push(texto.slice(ultimo, i));
    const [todo, texto_, comentario, numero, palavra, abre] = m;
    if (texto_) partes.push(<span key={k++} className="sql-s">{todo}</span>);
    else if (comentario) partes.push(<span key={k++} className="sql-c">{todo}</span>);
    else if (numero) partes.push(<span key={k++} className="sql-n">{todo}</span>);
    else if (palavra && PALAVRAS.has(palavra.toLowerCase())) partes.push(<span key={k++} className="sql-k">{palavra}</span>, abre ?? '');
    else if (palavra && abre) partes.push(<span key={k++} className="sql-f">{palavra}</span>, abre);
    else partes.push(todo);
    ultimo = i + todo.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}
