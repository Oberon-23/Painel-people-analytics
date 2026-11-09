import 'server-only';
import { cache } from 'react';
import { comUsuario, ehBloqueio } from './db';

export type Kpis = {
  headcount: number | null;
  suprimido: boolean;
  admissoes_12m: number;
  admissoes_previstas: number;
  desligamentos_12m: number;
  voluntarios_12m: number;
  turnover_12m: number | null;
  turnover_ant: number | null;
  absenteismo_3m: number | null;
  absenteismo_ant: number | null;
  tempo_casa_anos: number | null;
  pct_mulheres: number | null;
  pct_mulheres_lideranca: number | null;
  lideres: number;
  salario_medio: number | null;
};

export type Mes = {
  mes: string;
  headcount: number;
  admissoes: number;
  desligamentos: number;
  voluntarios: number;
  dias_ausencia: number;
  absenteismo: number | null;
};

export type Area = {
  area_id: number;
  area: string;
  diretoria: string;
  headcount: number | null;
  desligamentos_12m: number | null;
  turnover_12m: number | null;
  pct_voluntario: number | null;
  absenteismo_3m: number | null;
  absenteismo_ant: number | null;
  enps: number | null;
  suprimido: boolean;
};

export type Remuneracao = {
  nivel_id: number;
  nivel: string;
  n_mulheres: number;
  n_homens: number;
  mediana_mulheres: number | null;
  mediana_homens: number | null;
  razao: number | null;
  suprimido: boolean;
};

export type Clima = {
  area_id: number;
  area: string;
  ciclo: string;
  respostas: number;
  nota_media: number | null;
  enps: number | null;
  suprimido: boolean;
};

export type Pessoa = {
  id: number;
  nome: string;
  cpf: string | null;
  genero: 'F' | 'M';
  cargo: string;
  nivel_id: number;
  nivel: string;
  area: string;
  diretoria: string;
  unidade: string;
  gestor: string | null;
  admissao: string;
  desligamento: string | null;
  tipo_desligamento: string | null;
  modalidade: string;
  salario: number | null;
};

export type FiltroPessoas = {
  busca?: string;
  area?: string;
  situacao?: 'ativos' | 'desligados' | 'previstos' | 'todos';
  ordem?: 'nome' | 'admissao' | 'area' | 'nivel' | 'salario';
  pagina?: number;
};

export type Bloqueado = { bloqueado: true; motivo: string };
export const estaBloqueado = (x: unknown): x is Bloqueado => !!x && (x as Bloqueado).bloqueado === true;

/** Postgres devolve numeric como texto; aqui viram números. */
function num<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) ? Number(v) : v;
  }
  return out as T;
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d as string));

async function seguro<T>(fn: () => Promise<T>): Promise<T | Bloqueado> {
  try {
    return await fn();
  } catch (e) {
    if (ehBloqueio(e)) return { bloqueado: true, motivo: (e as Error).message };
    throw e;
  }
}

export const kpis = cache((token: string) =>
  comUsuario(token, async (c) => num((await c.query('select api.kpis() as k')).rows[0].k as Kpis)),
);

export const serieMensal = cache((token: string, meses = 24) =>
  comUsuario(token, async (c) =>
    (await c.query('select * from api.serie_mensal($1)', [meses])).rows.map((r) => {
      const m = num(r) as Mes;
      m.mes = iso(r.mes);
      m.absenteismo = m.headcount > 0 ? m.dias_ausencia / (m.headcount * 21) : null;
      return m;
    }),
  ),
);

export const porArea = cache((token: string) =>
  comUsuario(token, async (c) => (await c.query('select * from api.por_area()')).rows.map((r) => num(r) as Area)),
);

export const remuneracao = cache((token: string) =>
  seguro(() =>
    comUsuario(token, async (c) => (await c.query('select * from api.remuneracao()')).rows.map((r) => num(r) as Remuneracao)),
  ),
);

export const clima = cache((token: string) =>
  comUsuario(token, async (c) =>
    (await c.query('select * from api.clima()')).rows.map((r) => ({ ...(num(r) as Clima), ciclo: iso(r.ciclo) })),
  ),
);

export async function pessoas(token: string, f: FiltroPessoas, motivo: 'consulta' | 'exportacao' = 'consulta') {
  return comUsuario(token, async (c) => {
    const r = (
      await c.query('select api.listar_pessoas($1, $2, $3, $4, $5, $6, $7) as r', [
        f.busca ?? null,
        f.area ?? null,
        f.situacao ?? 'ativos',
        f.ordem ?? 'nome',
        f.pagina ?? 1,
        motivo === 'exportacao' ? 1000 : 25,
        motivo,
      ])
    ).rows[0].r as { total: number; linhas: Pessoa[] };
    return r;
  });
}

export const areasVisiveis = cache((token: string) =>
  comUsuario(token, async (c) =>
    (await c.query('select area from api.areas_visiveis() as area')).rows.map((r) => r.area as string),
  ),
);

export type LinhaAuditoria = { quando: Date; usuario: string; perfil: string; acao: string; detalhe: string | null; linhas: number | null };
export type ResumoAuditoria = { usuario: string; perfil: string; acessos: number; linhas: number; ultimo: Date | null };

export const auditoria = cache((token: string) =>
  seguro(() =>
    comUsuario(token, async (c) => ({
      linhas: (await c.query('select * from api.auditoria(150)')).rows as LinhaAuditoria[],
      resumo: (await c.query('select * from api.auditoria_resumo()')).rows as ResumoAuditoria[],
    })),
  ),
);

export async function registrar(token: string, acao: string, detalhe?: string) {
  await comUsuario(token, (c) => c.query('select api.registrar($1, $2)', [acao, detalhe ?? null]));
}

/** Contagem direta na visão de pessoas: prova de que o banco filtra sozinho. */
export async function contarPessoas(token: string): Promise<number> {
  return comUsuario(token, async (c) => Number((await c.query('select count(*) as n from api.pessoas()')).rows[0].n));
}
