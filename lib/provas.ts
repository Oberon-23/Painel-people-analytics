import 'server-only';
import { comUsuario } from './db';

export type Prova = {
  titulo: string;
  explicacao: string;
  sql: string;
  resultado: string;
  status: 'bloqueado' | 'filtrado' | 'permitido';
};

type Caso = {
  titulo: string;
  explicacao: string;
  sql: string;
  /** token usado só neste teste (para simular adulteração) */
  token?: (t: string) => string;
  ler: (rows: Record<string, unknown>[]) => Pick<Prova, 'resultado' | 'status'>;
};

/**
 * Tentativas reais de passar por cima das regras, executadas agora, no
 * banco, com o usuário do aplicativo e o seu token. Cada uma roda dentro
 * de um savepoint e é desfeita, então nada muda de verdade.
 */
export async function rodarProvas(token: string, usuarioId: number, perfil: string): Promise<Prova[]> {
  const alvo = usuarioId === 1 ? 2 : 1;
  const casos: Caso[] = [
    {
      titulo: 'Contar todas as pessoas da tabela, sem filtro',
      explicacao: 'A consulta não tem WHERE. Quem filtra é a política de RLS do banco.',
      sql: 'select count(*) from rh.colaboradores',
      ler: (r) => {
        const n = Number(r[0].count);
        return perfil === 'diretoria_rh'
          ? { resultado: `${n} pessoas: seu perfil vê a empresa toda`, status: 'permitido' }
          : { resultado: `${n} pessoas: só as do seu escopo`, status: 'filtrado' };
      },
    },
    {
      titulo: 'Ler o salário direto da tabela',
      explicacao: 'O usuário do aplicativo não tem permissão na coluna. Salário só sai pela visão, e só para quem pode.',
      sql: 'select nome, salario from rh.colaboradores limit 5',
      ler: () => ({ resultado: 'Devolveu dados', status: 'permitido' }),
    },
    {
      titulo: 'Ler respostas individuais da pesquisa de clima',
      explicacao: 'A tabela não tem política de leitura para ninguém e nem guarda quem respondeu.',
      sql: 'select area_id, nota from rh.clima_respostas limit 5',
      ler: () => ({ resultado: 'Devolveu dados', status: 'permitido' }),
    },
    {
      titulo: 'Ler e-mails e senhas dos usuários',
      explicacao: 'Usuários e senhas (com hash bcrypt) ficam fora do alcance do aplicativo.',
      sql: 'select email, senha_hash from app.usuarios',
      ler: () => ({ resultado: 'Devolveu dados', status: 'permitido' }),
    },
    {
      titulo: 'Ler o segredo que assina os tokens',
      explicacao: 'Sem o segredo, ninguém fabrica um token válido.',
      sql: 'select valor from app_privado.config',
      ler: () => ({ resultado: 'Devolveu dados', status: 'permitido' }),
    },
    {
      titulo: 'Dobrar todos os salários',
      explicacao: 'O aplicativo só lê. Nenhuma alteração passa.',
      sql: 'update rh.colaboradores set salario = salario * 2',
      ler: () => ({ resultado: 'Alterou dados', status: 'permitido' }),
    },
    {
      titulo: 'Apagar o registro de auditoria',
      explicacao: 'O rastro de quem acessou o quê não pode ser apagado pelo aplicativo.',
      sql: 'delete from app.acessos',
      ler: () => ({ resultado: 'Apagou dados', status: 'permitido' }),
    },
    {
      titulo: 'Trocar o usuário dentro do token',
      explicacao: `O token foi editado para dizer "sou o usuário ${alvo}". A assinatura deixa de bater e o banco trata como ninguém.`,
      sql: 'select count(*) from rh.colaboradores',
      token: (t) => t.replace(/^\d+/, String(alvo)),
      ler: (r) =>
        Number(r[0].count) === 0
          ? { resultado: '0 pessoas: token rejeitado', status: 'bloqueado' }
          : { resultado: `${r[0].count} pessoas`, status: 'permitido' },
    },
    {
      titulo: 'Consultar sem token (como se a sessão tivesse vazado sem o cookie)',
      explicacao: 'Sem token não há usuário, e sem usuário a RLS não devolve nada.',
      sql: 'select count(*) from rh.colaboradores',
      token: () => '',
      ler: (r) =>
        Number(r[0].count) === 0
          ? { resultado: '0 pessoas', status: 'bloqueado' }
          : { resultado: `${r[0].count} pessoas`, status: 'permitido' },
    },
    {
      titulo: 'Pedir a mediana salarial da Diretoria (4 pessoas)',
      explicacao: 'Grupos com menos de 5 pessoas não aparecem: com tão pouca gente, a média revela o salário de alguém.',
      sql: "select mediana_mulheres, mediana_homens from api.remuneracao() where nivel = 'Diretoria'",
      ler: (r) =>
        r[0] && r[0].mediana_mulheres == null && r[0].mediana_homens == null
          ? { resultado: 'Grupo suprimido: valores vazios', status: 'bloqueado' }
          : { resultado: 'Devolveu valores', status: 'permitido' },
    },
  ];

  return comUsuario(token, async (c) => {
    const out: Prova[] = [];
    for (const caso of casos) {
      await c.query('savepoint prova');
      try {
        if (caso.token) await c.query("select set_config('app.token', $1, true)", [caso.token(token)]);
        const r = await c.query(caso.sql);
        out.push({ titulo: caso.titulo, explicacao: caso.explicacao, sql: caso.sql, ...caso.ler(r.rows) });
      } catch (e) {
        const msg = (e as Error).message;
        out.push({
          titulo: caso.titulo,
          explicacao: caso.explicacao,
          sql: caso.sql,
          resultado: traduzir(msg),
          status: 'bloqueado',
        });
      } finally {
        await c.query('rollback to savepoint prova');
      }
    }
    return out;
  });
}

function traduzir(msg: string): string {
  if (/permission denied for schema/.test(msg)) return 'Negado: sem acesso a esse esquema';
  if (/permission denied/.test(msg)) return 'Negado: permissão recusada pelo banco';
  if (/remuneração/.test(msg)) return 'Negado: seu perfil não acessa remuneração';
  return `Negado: ${msg}`;
}
