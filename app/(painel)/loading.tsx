/** Aparece na hora em que a pessoa clica em outra tela, enquanto o banco responde. */
export default function Carregando() {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="esq esq-titulo" />
      <div className="esq-grade">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="esq esq-cartao" />)}
      </div>
      <div className="esq esq-bloco" />
    </div>
  );
}
