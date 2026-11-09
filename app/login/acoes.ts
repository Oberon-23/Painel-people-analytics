'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { comUsuario } from '@/lib/db';
import { COOKIE_SESSAO, DURACAO_SESSAO_S, criarToken, lerToken } from '@/lib/token';

/** Usuários de demonstração (senha pública, só para o portfólio). */
const DEMO: Record<string, true> = {
  'helena@rotalume.demo': true,
  'caio@rotalume.demo': true,
  'patricia@rotalume.demo': true,
  'rafael@rotalume.demo': true,
};
const SENHA_DEMO = 'rotalume-demo';

async function autenticar(email: string, senha: string) {
  // A senha é conferida dentro do banco (bcrypt). O bloqueio por excesso de
  // erros vale para e-mail + origem: quem erra de propósito trava só a si
  // mesmo, não o perfil de demonstração para todo mundo. Na Vercel, o IP
  // vem de cabeçalhos que a própria plataforma preenche.
  const h = await headers();
  const origem = (h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || null;
  const r = await comUsuario(null, async (c) =>
    (await c.query('select api.login($1, $2, $3) as r', [email, senha, origem])).rows[0].r as { ok: boolean; id?: number; motivo?: string },
  );
  if (!r.ok || !r.id) redirect(`/login?erro=${r.motivo === 'bloqueado' ? 'bloqueado' : 'invalido'}`);

  (await cookies()).set(COOKIE_SESSAO, criarToken(r.id), {
    httpOnly: true, // o JavaScript da página não consegue ler o token
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_S,
  });
  redirect('/');
}

export async function entrar(form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 120);
  const senha = String(form.get('senha') ?? '').slice(0, 200);
  if (!email || !senha) redirect('/login?erro=invalido');
  await autenticar(email, senha);
}

export async function entrarComo(form: FormData) {
  const email = String(form.get('email') ?? '');
  if (!DEMO[email]) redirect('/login?erro=invalido');
  await autenticar(email, SENHA_DEMO);
}

export async function sair() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (lerToken(token)) {
    await comUsuario(token!, (c) => c.query("select api.registrar('logout')")).catch(() => {});
  }
  jar.delete(COOKIE_SESSAO);
  redirect('/login');
}
