import 'server-only';
import { cookies } from 'next/headers';
import type { Tema } from '@/components/Tema';

export async function lerTema(): Promise<Tema> {
  const v = (await cookies()).get('tema')?.value;
  return v === 'claro' || v === 'escuro' ? v : 'sistema';
}
