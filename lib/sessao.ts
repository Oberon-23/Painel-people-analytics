import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { comUsuario } from './db';
import { COOKIE_SESSAO, lerToken } from './token';

export type Perfil = 'diretoria_rh' | 'hrbp' | 'gestor' | 'analista';

export type Sessao = {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  cargo: string;
  escopo: string;
  pessoas_visiveis: number;
  pessoas_agregado: number;
  pode: {
    individual: boolean;
    salario: boolean;
    salario_agregado: boolean;
    cpf: boolean;
    exportar: boolean;
    auditoria: boolean;
  };
  dados_ate: string | null;
  ultima_atualizacao: string | null;
};

export const NOME_PERFIL: Record<Perfil, string> = {
  diretoria_rh: 'Diretoria de RH',
  hrbp: 'HR Business Partner',
  gestor: 'Gestor(a)',
  analista: 'People Analytics',
};

/** Token do cookie, já conferido aqui no servidor (o banco confere de novo). */
export async function tokenAtual(): Promise<string | null> {
  const t = (await cookies()).get(COOKIE_SESSAO)?.value ?? null;
  return lerToken(t) ? t : null;
}

/** Sessão do usuário logado, lida do banco. Sem sessão válida, vai para o login. */
export const exigirSessao = cache(async (): Promise<{ token: string; sessao: Sessao }> => {
  const token = await tokenAtual();
  if (!token) redirect('/login');
  try {
    const sessao = await comUsuario(token, async (c) => (await c.query('select api.sessao() as s')).rows[0].s as Sessao);
    return { token, sessao };
  } catch (e) {
    if ((e as { code?: string }).code === '28000') redirect('/login?expirou=1');
    throw e;
  }
});
