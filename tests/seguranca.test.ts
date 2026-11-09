/**
 * Testes das regras de segurança direto no banco, com o mesmo usuário e o
 * mesmo token que o aplicativo usa. Rodam contra um Postgres de teste
 * instalado com db/instalar.sql (variáveis em .env.local).
 */
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { criarToken, lerToken } = await import('../lib/token');

const HELENA = 1, CAIO = 2, PATRICIA = 3, RAFAEL = 4;
let db: Client;

async function como<T = Record<string, unknown>>(uid: number | string | null, sql: string, params: unknown[] = []) {
  const token = uid == null ? '' : typeof uid === 'string' ? uid : criarToken(uid);
  await db.query('begin');
  try {
    await db.query("select set_config('app.token', $1, true)", [token]);
    return (await db.query(sql, params)).rows as T[];
  } finally {
    await db.query('rollback');
  }
}
const n = async (uid: number | string | null, sql: string) => Number(Object.values((await como(uid, sql))[0])[0]);

beforeAll(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
});
afterAll(async () => db?.end());

describe('token de sessão', () => {
  it('aceita o token íntegro e recusa o adulterado ou vencido', () => {
    const t = criarToken(3);
    expect(lerToken(t)).toBe(3);
    expect(lerToken(t.replace(/^3/, '1'))).toBeNull();
    expect(lerToken(t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a'))).toBeNull();
    expect(lerToken(criarToken(3, Date.now() - 9 * 3600 * 1000))).toBeNull();
    expect(lerToken('lixo')).toBeNull();
  });
  it('o banco reconhece o mesmo token (mesmo segredo)', async () => {
    expect((await como(PATRICIA, 'select api.sessao() as s'))[0]).toMatchObject({ s: { nome: 'Patrícia Lima', perfil: 'gestor' } });
  });
  it('token trocado de usuário ou vencido vira "ninguém" no banco', async () => {
    const forjado = criarToken(PATRICIA).replace(/^3/, '1');
    expect(await n(forjado, 'select count(*) from rh.colaboradores')).toBe(0);
    expect(await n(criarToken(HELENA, Date.now() - 9 * 3600 * 1000), 'select count(*) from rh.colaboradores')).toBe(0);
    await expect(como(forjado, 'select api.sessao()')).rejects.toThrow(/Sessão inválida/);
  });
});

describe('camada 1: linhas (RLS)', () => {
  it('cada perfil recebe só o próprio escopo, com a mesma consulta', async () => {
    const total = await n(HELENA, 'select count(*) from rh.colaboradores');
    const caio = await n(CAIO, 'select count(*) from rh.colaboradores');
    const patricia = await n(PATRICIA, 'select count(*) from rh.colaboradores');
    expect(total).toBeGreaterThan(400);
    expect(caio).toBeLessThan(total);
    expect(patricia).toBeLessThan(caio);
    expect(await n(RAFAEL, 'select count(*) from rh.colaboradores')).toBe(0);
    expect(await n(null, 'select count(*) from rh.colaboradores')).toBe(0);
  });
  it('o HRBP só vê a diretoria dele', async () => {
    const dirs = await como<{ diretoria: string }>(CAIO, 'select distinct diretoria from api.pessoas');
    expect(dirs.map((d) => d.diretoria)).toEqual(['Operações']);
  });
  it('a gestora só vê a própria equipe, nem a área vizinha', async () => {
    const areas = await como<{ area: string }>(PATRICIA, 'select distinct area from api.pessoas');
    expect(areas.map((a) => a.area)).toEqual(['Produção']);
  });
  it('ausências seguem o mesmo escopo', async () => {
    const fora = await n(PATRICIA, `select count(*) from rh.ausencias a
      where not exists (select 1 from api.pessoas p where p.id = a.colaborador_id)`);
    expect(fora).toBe(0);
    expect(await n(RAFAEL, 'select count(*) from rh.ausencias')).toBe(0);
  });
});

describe('camada 2: colunas', () => {
  it('ninguém lê salário, CPF ou nascimento direto da tabela', async () => {
    for (const col of ['salario', 'cpf', 'nascimento']) {
      await expect(como(HELENA, `select ${col} from rh.colaboradores limit 1`)).rejects.toThrow(/permission denied/);
    }
  });
  it('salário e CPF saem conforme o perfil', async () => {
    const [h] = await como<{ cpf: string; salario: string }>(HELENA, "select cpf, salario from api.pessoas where area = 'Produção' limit 1");
    const [c] = await como<{ cpf: string; salario: string }>(CAIO, "select cpf, salario from api.pessoas where area = 'Produção' limit 1");
    const [p] = await como<{ cpf: string; salario: string }>(PATRICIA, "select cpf, salario from api.pessoas limit 1");
    expect(h.cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(h.salario).not.toBeNull();
    expect(c.cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    expect(c.salario).not.toBeNull();
    expect(p.cpf).toBeNull();
    expect(p.salario).toBeNull();
  });
  it('a função de salário não vaza fora do escopo, mesmo chamada direto', async () => {
    const [{ id }] = await como<{ id: number }>(HELENA, "select id from api.pessoas where diretoria = 'Tecnologia' limit 1");
    expect((await como(CAIO, `select app.salario_de(${id}) as s`))[0].s).toBeNull();
    expect((await como(PATRICIA, `select app.salario_de(${id}) as s`))[0].s).toBeNull();
  });
});

describe('camada 3: grupos pequenos', () => {
  it('remuneração esconde grupos com menos de 5', async () => {
    const r = await como<{ n_mulheres: number; n_homens: number; mediana_mulheres: string | null; mediana_homens: string | null }>(RAFAEL, 'select * from api.remuneracao()');
    for (const l of r) {
      if (l.n_mulheres < 5) expect(l.mediana_mulheres).toBeNull();
      if (l.n_homens < 5) expect(l.mediana_homens).toBeNull();
    }
    expect(r.some((l) => l.mediana_mulheres == null)).toBe(true);
  });
  it('a gestora não acessa remuneração nem agregada', async () => {
    await expect(como(PATRICIA, 'select * from api.remuneracao()')).rejects.toThrow(/remuneração/);
  });
  it('clima com menos de 5 respostas fica oculto até para a diretoria', async () => {
    const r = await como<{ respostas: number; enps: string | null }>(HELENA, 'select * from api.clima()');
    for (const l of r) if (l.respostas < 5) expect(l.enps).toBeNull();
  });
  it('respostas individuais do clima não são legíveis por ninguém', async () => {
    await expect(como(HELENA, 'select nota from rh.clima_respostas limit 1')).rejects.toThrow(/permission denied/);
  });
});

describe('camada 4: rastro e escrita', () => {
  it('consulta de pessoas fica registrada com o usuário', async () => {
    await db.query("select set_config('app.token', $1, false)", [criarToken(CAIO)]);
    await db.query("select api.listar_pessoas('Silva', null, 'ativos', 'nome', 1, 25, 'consulta')");
    await db.query("select set_config('app.token', $1, false)", [criarToken(HELENA)]);
    const [ult] = (await db.query('select usuario, acao, detalhe from api.auditoria(1)')).rows;
    await db.query("select set_config('app.token', '', false)");
    expect(ult).toMatchObject({ usuario: 'Caio Mendes', acao: 'consulta de pessoas' });
    expect(ult.detalhe).toContain('Silva');
  });
  it('só a diretoria lê a auditoria', async () => {
    await expect(como(CAIO, 'select * from api.auditoria()')).rejects.toThrow(/auditoria/);
    await expect(como(HELENA, 'select * from app.acessos')).rejects.toThrow(/permission denied/);
  });
  it('o aplicativo não altera nem apaga nada', async () => {
    await expect(como(HELENA, "update rh.colaboradores set nome = 'x'")).rejects.toThrow(/permission denied/);
    await expect(como(HELENA, 'delete from app.acessos')).rejects.toThrow(/permission denied/);
    await expect(como(HELENA, 'select valor from app_privado.config')).rejects.toThrow(/permission denied/);
  });
  it('busca com aspas não quebra a consulta (sem injeção de SQL)', async () => {
    const [r] = await como<{ r: { total: number } }>(HELENA, "select api.listar_pessoas($1) as r", ["x' or 1=1 --"]);
    expect(r.r.total).toBe(0);
  });
  it('login errado 5 vezes bloqueia o e-mail', async () => {
    const email = `teste-${Date.now()}@rotalume.demo`;
    for (let i = 0; i < 5; i++) await db.query('select api.login($1, $2)', [email, 'errada']);
    const [{ r }] = (await db.query('select api.login($1, $2) as r', [email, 'errada'])).rows;
    expect(r).toMatchObject({ ok: false, motivo: 'bloqueado' });
  });
});
