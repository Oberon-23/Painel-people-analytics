'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';

export type ItemNav = { href: string; rotulo: string; bloqueado?: boolean };

export default function Nav({ itens }: { itens: ItemNav[] }) {
  const atual = usePathname();
  return (
    <nav className="nav" aria-label="Seções">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} aria-current={atual === i.href ? 'page' : undefined} prefetch={false}>
          {i.rotulo}
          {i.bloqueado ? <Lock className="cad" size={13} aria-label="sem acesso" /> : null}
        </Link>
      ))}
    </nav>
  );
}
