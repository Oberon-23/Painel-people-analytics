import { NextResponse, type NextRequest } from 'next/server';
import { comUsuario } from '@/lib/db';
import { pessoas, type FiltroPessoas, type Pessoa } from '@/lib/dados';
import { tokenAtual } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

const COLUNAS: [keyof Pessoa, string][] = [
  ['nome', 'Nome'], ['cpf', 'CPF'], ['cargo', 'Cargo'], ['nivel', 'Nível'], ['area', 'Área'], ['diretoria', 'Diretoria'],
  ['unidade', 'Unidade'], ['gestor', 'Gestor'], ['admissao', 'Admissão'], ['desligamento', 'Desligamento'],
  ['tipo_desligamento', 'Tipo de desligamento'], ['modalidade', 'Modalidade'], ['salario', 'Salário'],
];

const celula = (v: unknown) => {
  if (v == null) return '';
  let s = String(v);
  // evita injeção de fórmula ao abrir o CSV no Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const token = await tokenAtual();
  if (!token) return NextResponse.json({ erro: 'Sessão inválida' }, { status: 401 });

  const pode = await comUsuario(token, async (c) => (await c.query("select (api.sessao()->'pode'->>'exportar')::boolean as p")).rows[0].p as boolean);
  if (!pode) return NextResponse.json({ erro: 'Seu perfil não pode exportar dados' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const f: FiltroPessoas = {
    busca: sp.get('q')?.slice(0, 60) || undefined,
    area: sp.get('area') || undefined,
    situacao: (sp.get('situacao') as FiltroPessoas['situacao']) ?? 'ativos',
    ordem: (sp.get('ordem') as FiltroPessoas['ordem']) ?? 'nome',
  };
  const r = await pessoas(token, f, 'exportacao');
  const csv = [COLUNAS.map(([, t]) => t).join(';'), ...r.linhas.map((p) => COLUNAS.map(([k]) => celula(p[k])).join(';'))].join('\r\n');
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pessoas-rotalume-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
