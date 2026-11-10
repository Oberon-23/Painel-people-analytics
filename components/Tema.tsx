'use client';

import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type Tema = 'sistema' | 'claro' | 'escuro';

const PROXIMO: Record<Tema, Tema> = { sistema: 'claro', claro: 'escuro', escuro: 'sistema' };
const NOME: Record<Tema, string> = { sistema: 'automático (segue o sistema)', claro: 'claro', escuro: 'escuro' };

/** Alterna entre automático, claro e escuro. A escolha fica num cookie para o servidor já
 *  devolver a página no tema certo, sem piscar e sem script inline (a CSP não permite). */
export default function BotaoTema({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial);
  const trocar = () => {
    const novo = PROXIMO[tema];
    const html = document.documentElement;
    if (novo === 'sistema') {
      delete html.dataset.theme;
      document.cookie = 'tema=; path=/; max-age=0; samesite=lax';
    } else {
      html.dataset.theme = novo === 'escuro' ? 'dark' : 'light';
      document.cookie = `tema=${novo}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
    }
    setTema(novo);
  };
  const Icone = tema === 'claro' ? Sun : tema === 'escuro' ? Moon : Monitor;
  const rotulo = `Tema ${NOME[tema]}. Clique para mudar para ${NOME[PROXIMO[tema]]}.`;
  return (
    <button type="button" className="btn-tema" onClick={trocar} aria-label={rotulo} title={rotulo}>
      <Icone size={16} aria-hidden="true" />
    </button>
  );
}
