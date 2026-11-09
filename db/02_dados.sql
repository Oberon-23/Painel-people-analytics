-- =====================================================================
-- Rotalume · People Analytics
-- 02 · Dados fictícios
--
-- Tudo é gerado aqui dentro, com sorteios a partir de uma semente fixa.
-- Nenhuma pessoa é real: nomes são combinações aleatórias e os CPFs são
-- propositalmente inválidos (o primeiro dígito verificador está errado).
--
-- A história plantada nos dados:
--   · Logística (Macaé) perde gente cada vez mais rápido nos últimos 9 meses,
--     quase sempre por pedido de demissão, e o clima da área vem caindo.
--   · O absenteísmo da Produção subiu nos últimos 4 meses.
--   · No nível Especialista e na Coordenação, mulheres ganham menos que
--     homens no mesmo nível (assunto do relatório da Lei 14.611/2023).
--   · Mulheres são minoria nos cargos de liderança.
-- =====================================================================

insert into rh.diretorias values
  (1, 'Operações'), (2, 'Comercial'), (3, 'Administrativo e Financeiro'), (4, 'Tecnologia');

insert into rh.unidades values
  (1, 'Campos dos Goytacazes'), (2, 'Macaé'), (3, 'Rio de Janeiro');

insert into rh.niveis values
  (1, 'Operacional'), (2, 'Técnico'), (3, 'Analista'), (4, 'Especialista'),
  (5, 'Coordenação'), (6, 'Gerência'), (7, 'Diretoria');

insert into rh.areas values
  (1, 'Produção', 1), (2, 'Manutenção', 1), (3, 'Qualidade', 1), (4, 'Logística', 1),
  (5, 'Vendas', 2), (6, 'Marketing', 2),
  (7, 'Financeiro', 3), (8, 'Pessoas e Cultura', 3), (9, 'Jurídico', 3),
  (10, 'TI', 4), (11, 'Dados', 4);

--                               rótulo   %F   unidades              níveis 1..5        saída base/recente  vol.  atestado base/rec.  salário clima  queda  cargo operacional                                        vagas novas
insert into app_privado.parametros_area values
  (1,  'produção',          .25, '{1,1,1,2,2}',           '{70,20,8,4,4}',  .011, .011, .60, .17, .36, .95, 7.7, .15, 'Operadora de produção|Operador de produção',       0),
  (2,  'manutenção',        .10, '{1,1,1,2,2}',           '{12,18,4,3,2}',  .007, .007, .55, .15, .15, 1.05, 7.8, 0,  'Auxiliar de manutenção|Auxiliar de manutenção',   0),
  (3,  'qualidade',         .55, '{1}',                   '{4,8,6,3,1}',    .008, .008, .60, .14, .14, 1.0, 7.6, 0,   'Inspetora de qualidade|Inspetor de qualidade',     0),
  (4,  'logística',         .30, '{2,2,2,2,2,2,2,1,1,1}', '{34,10,5,2,2}',  .019, .036, .82, .16, .16, .93, 7.9, .45, 'Auxiliar de logística|Auxiliar de logística',     0),
  (5,  'vendas',            .50, '{3,3,3,1,1}',           '{0,6,20,4,3}',   .012, .012, .50, .11, .11, 1.0, 7.8, 0,   null, 0),
  (6,  'marketing',         .65, '{3}',                   '{0,2,6,2,1}',    .010, .010, .60, .11, .11, 1.05, 7.7, 0,  null, 0),
  (7,  'finanças',          .60, '{1}',                   '{0,3,9,3,1}',    .007, .007, .60, .11, .11, 1.05, 7.9, 0,  null, 0),
  (8,  'pessoas e cultura', .80, '{1}',                   '{0,2,7,2,1}',    .006, .006, .60, .11, .11, 1.0, 7.7, 0,   null, 0),
  (9,  'jurídico',          .50, '{3}',                   '{0,1,2,2,0}',    .005, .005, .60, .09, .09, 1.25, 7.7, 0,  null, 0),
  (10, 'TI',                .25, '{1,3}',                 '{0,8,12,5,2}',   .013, .013, .75, .09, .09, 1.15, 8.1, 0,  null, .22),
  (11, 'dados',             .40, '{3}',                   '{0,0,4,3,0}',    .010, .010, .75, .09, .09, 1.22, 7.9, 0,  null, .10);

-- ---------------------------------------------------------------------
-- Geradores
-- ---------------------------------------------------------------------
create or replace function app_privado.sorteio(arr anyarray) returns anyelement
language sql volatile as $$
  select arr[1 + floor(random() * array_length(arr, 1))::int]
$$;

create or replace function app_privado.nome_ficticio(g char) returns text
language plpgsql volatile as $$
declare
  f text[] := '{Ana,Beatriz,Camila,Carla,Daniela,Débora,Eduarda,Fernanda,Gabriela,Giovana,Isabela,Jéssica,Juliana,Larissa,Letícia,Luana,Mariana,Marina,Natália,Paula,Priscila,Rafaela,Renata,Sabrina,Tatiane,Vanessa,Vitória,Yasmin,Aline,Bruna,Cláudia,Elaine,Flávia,Kelly,Lívia,Mônica,Raquel,Simone,Thaís,Viviane}';
  m text[] := '{André,Bruno,Carlos,Daniel,Diego,Eduardo,Felipe,Fernando,Gabriel,Guilherme,Gustavo,Henrique,Igor,João,José,Leandro,Leonardo,Lucas,Luiz,Marcelo,Marcos,Mateus,Paulo,Pedro,Renan,Ricardo,Rodrigo,Samuel,Thiago,Vinícius,Wellington,Alexandre,Fábio,Júlio,Márcio,Otávio,Roberto,Sérgio,Tiago,Wagner}';
  s text[] := '{Silva,Santos,Oliveira,Souza,Rodrigues,Ferreira,Alves,Pereira,Gomes,Ribeiro,Martins,Carvalho,Almeida,Lopes,Soares,Fernandes,Vieira,Barbosa,Rocha,Dias,Nascimento,Andrade,Moreira,Nunes,Marques,Machado,Freitas,Cardoso,Ramos,Gonçalves,Santana,Teixeira,Moura,Correia,Pinto,Batista,Campos,Araújo,Monteiro,Peixoto}';
begin
  return app_privado.sorteio(case when g = 'F' then f else m end)
      || ' ' || app_privado.sorteio(s) || ' ' || app_privado.sorteio(s);
end $$;

-- CPF com formato real, mas inválido de propósito (primeiro dígito
-- verificador trocado), para nunca coincidir com o de uma pessoa real.
create or replace function app_privado.cpf_ficticio() returns text
language plpgsql volatile as $$
declare
  d int[] := array(select floor(random() * 10)::int from generate_series(1, 9));
  s int := 0; dv1 int; dv2 int;
begin
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  dv1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  dv1 := (dv1 + 1) % 10;                      -- propositalmente errado
  s := 0;
  for i in 1..9 loop s := s + d[i] * (12 - i); end loop;
  s := s + dv1 * 2;
  dv2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return format('%s%s%s.%s%s%s.%s%s%s-%s%s', d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], dv1, dv2);
end $$;

create or replace function app_privado.cargo(p_area smallint, p_nivel smallint, g char) returns text
language plpgsql stable as $$
declare
  p app_privado.parametros_area;
  dir text;
begin
  select * into p from app_privado.parametros_area where area_id = p_area;
  select lower(d.nome) into dir from rh.areas a join rh.diretorias d on d.id = a.diretoria_id where a.id = p_area;
  return case p_nivel
    when 1 then split_part(coalesce(p.cargo_operacional, 'Assistente de ' || p.rotulo || '|Assistente de ' || p.rotulo), '|', case when g = 'F' then 1 else 2 end)
    when 2 then case when g = 'F' then 'Técnica' else 'Técnico' end || ' de ' || p.rotulo
    when 3 then 'Analista de ' || p.rotulo
    when 4 then 'Especialista de ' || p.rotulo
    when 5 then case when g = 'F' then 'Coordenadora' else 'Coordenador' end || ' de ' || p.rotulo
    when 6 then 'Gerente de ' || p.rotulo
    else case when g = 'F' then 'Diretora' else 'Diretor' end || ' de ' || dir
  end;
end $$;

create or replace function app_privado.salario_ficticio(p_area smallint, p_nivel smallint, g char, p_admissao date)
returns numeric language plpgsql volatile as $$
declare
  base numeric[] := '{2450,3900,5900,9300,12800,18500,34000}';
  fator numeric := (select fator_salario from app_privado.parametros_area where area_id = p_area);
  anos numeric := greatest(0, (current_date - p_admissao) / 365.25);
  f_genero numeric := case when g = 'F' and p_nivel in (4, 5) then .90 when g = 'F' then .975 else 1 end;
begin
  return round(base[p_nivel] * fator * (1 + least(anos * .025, .3)) * f_genero * (1 + (random()::numeric - .5) * .16), -1);
end $$;

create or replace function app_privado.nova_pessoa(
  p_area smallint, p_nivel smallint, p_unidade smallint, p_gestor int, p_admissao date,
  p_genero char default null, p_nome text default null
) returns int language plpgsql volatile as $$
declare
  p app_privado.parametros_area;
  g char;
  idade numeric;
  novo int;
begin
  select * into p from app_privado.parametros_area where area_id = p_area;
  -- mulheres são promovidas menos à liderança: a chance cai nos níveis 5 a 7
  g := coalesce(p_genero, case when random() < p.pct_mulheres * case when p_nivel >= 5 then .65 else 1 end then 'F' else 'M' end);
  idade := case p_nivel
    when 1 then 19 + random() * 22  when 2 then 21 + random() * 20  when 3 then 23 + random() * 15
    when 4 then 28 + random() * 14  when 5 then 30 + random() * 14  when 6 then 35 + random() * 12
    else 42 + random() * 10 end;
  insert into rh.colaboradores
    (nome, cpf, genero, nascimento, cargo, nivel_id, area_id, unidade_id, gestor_id, admissao, salario, modalidade)
  values (
    coalesce(p_nome, app_privado.nome_ficticio(g)),
    app_privado.cpf_ficticio(),
    g,
    p_admissao - (idade * 365.25)::int,
    app_privado.cargo(p_area, p_nivel, g),
    p_nivel, p_area,
    coalesce(p_unidade, app_privado.sorteio(p.unidades)),
    p_gestor, p_admissao,
    app_privado.salario_ficticio(p_area, p_nivel, g, p_admissao),
    case
      when p_area in (6, 10, 11) then app_privado.sorteio('{remoto,hibrido,hibrido}'::text[])
      when p_nivel >= 3 then app_privado.sorteio('{hibrido,presencial,presencial}'::text[])
      else 'presencial' end
  ) returning id into novo;
  return novo;
end $$;

-- Um dia útil de vida da empresa: desligamentos (com reposição),
-- vagas novas e ausências.
create or replace function app_privado.simular_dia(d date) returns int
language plpgsql volatile as $$
declare
  r record;
  novo int;
  n int := 0;
  t_saida date := (select valor::date from app_privado.config where chave = 'tendencia_saida');
  t_aus date := (select valor::date from app_privado.config where chave = 'tendencia_ausencia');
begin
  if extract(isodow from d) in (6, 7) then return 0; end if;

  for r in
    select c.id, c.area_id, c.nivel_id, c.unidade_id, c.gestor_id, p.pct_voluntario
    from rh.colaboradores c join app_privado.parametros_area p using (area_id)
    where c.admissao < d and c.desligamento is null and c.nivel_id <= 5
      and random() < (case when d >= t_saida then p.saida_recente else p.saida_base end)
                     * case when c.nivel_id = 5 then .5 else 1 end
                     * case when d - c.admissao < 365 then 1.5 else 1 end / 21.0
  loop
    update rh.colaboradores
       set desligamento = d,
           tipo_desligamento = case when random() < r.pct_voluntario then 'voluntario' else 'involuntario' end
     where id = r.id;
    novo := app_privado.nova_pessoa(r.area_id, r.nivel_id, r.unidade_id, r.gestor_id, d + 15 + floor(random() * 35)::int);
    if r.nivel_id = 5 then
      update rh.colaboradores set gestor_id = novo where gestor_id = r.id and desligamento is null;
    end if;
    n := n + 1;
  end loop;

  -- vagas novas (TI e Dados crescem)
  for r in
    select p.area_id,
           (select id from rh.colaboradores c where c.area_id = p.area_id and c.nivel_id in (5, 6)
              and c.desligamento is null order by c.nivel_id, random() limit 1) as gestor
    from app_privado.parametros_area p
    where p.crescimento > 0 and random() < p.crescimento / 21.0
  loop
    perform app_privado.nova_pessoa(r.area_id, (2 + floor(random() * 3))::smallint, null, r.gestor, d + 20 + floor(random() * 20)::int);
  end loop;

  insert into rh.ausencias (colaborador_id, data, dias, tipo)
  select c.id, d,
         case when random() < .5 then 1 when random() < .6 then 2 else 3 + floor(random() * 3) end,
         'atestado'
  -- o sorteio fica numa subconsulta para ser feito pessoa a pessoa
  -- (no filtro do join, o Postgres sortearia uma vez por área)
  from (select c.*, random() as u from rh.colaboradores c
        where c.admissao <= d and (c.desligamento is null or c.desligamento > d)) c
  join app_privado.parametros_area p using (area_id)
  where c.u < (case when d >= t_aus then p.atestado_recente else p.atestado_base end) / 21.0;

  insert into rh.ausencias (colaborador_id, data, dias, tipo)
  select c.id, d, 1, 'falta'
  from rh.colaboradores c
  where c.admissao <= d and (c.desligamento is null or c.desligamento > d)
    and random() < .03 / 21.0;

  return n;
end $$;

create or replace function app_privado.simular_periodo(ini date, fim date) returns int
language plpgsql volatile as $$
declare
  d date := ini;
  n int := 0;
begin
  while d <= fim loop
    n := n + app_privado.simular_dia(d);
    d := d + 1;
  end loop;
  insert into app_privado.config values ('dados_ate', fim::text)
    on conflict (chave) do update set valor = excluded.valor;
  return n;
end $$;

-- Pesquisa de clima semestral: 4 ciclos, respostas sem identificação.
create or replace function app_privado.gerar_clima() returns void
language plpgsql volatile as $$
declare
  k int;
  ciclo date;
  a record;
  hc int;
begin
  for k in 0..3 loop
    ciclo := (date_trunc('month', current_date) - make_interval(months => 6 * k + 1))::date;
    for a in select * from app_privado.parametros_area loop
      select count(*) into hc from rh.colaboradores c
       where c.area_id = a.area_id and c.admissao <= ciclo and (c.desligamento is null or c.desligamento > ciclo);
      insert into rh.clima_respostas (area_id, ciclo, nota)
      select a.area_id, ciclo,
             least(10, greatest(0, round(a.clima_media + a.clima_queda * (k - 1.5)
                                        + 1.4 * sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random()))))
      from generate_series(1, round(hc * (.62 + random() * .16))::int);
    end loop;
  end loop;
end $$;

create or replace function app_privado.gerar_tudo() returns void
language plpgsql volatile as $$
declare
  inicio date := (date_trunc('month', current_date) - interval '36 months')::date;
  diretor int[] := '{}';
  ger int;
  coords int[];
  a record;
  n int;
  i int;
  dir_area smallint[] := '{1,5,7,10}';
begin
  perform setseed(0.2026);

  insert into app_privado.config values
    ('tendencia_saida', (current_date - interval '9 months')::date::text),
    ('tendencia_ausencia', (current_date - interval '4 months')::date::text)
  on conflict (chave) do update set valor = excluded.valor;

  -- diretoria executiva
  for i in 1..4 loop
    diretor := diretor || app_privado.nova_pessoa(dir_area[i], 7::smallint,
      case when i in (2, 4) then 3 else 1 end::smallint, null,
      inicio - (3 + random() * 9)::int * 365);
  end loop;

  -- cada área: gerente, coordenadores e equipe
  for a in select p.*, ar.diretoria_id from app_privado.parametros_area p join rh.areas ar on ar.id = p.area_id order by p.area_id loop
    ger := app_privado.nova_pessoa(a.area_id, 6::smallint, a.unidades[1], diretor[a.diretoria_id],
      inicio - (2 + random() * 8)::int * 365,
      case when a.area_id = 1 then 'F' end,
      case when a.area_id = 1 then 'Patrícia Lima' end);
    coords := '{}';
    for i in 1..a.qtd_niveis[5] loop
      coords := coords || app_privado.nova_pessoa(a.area_id, 5::smallint, null, ger, inicio - (1 + random() * 9 * 365)::int);
    end loop;
    for n in reverse 4..1 loop
      for i in 1..a.qtd_niveis[n] loop
        perform app_privado.nova_pessoa(a.area_id, n::smallint, null,
          case when array_length(coords, 1) > 0 then app_privado.sorteio(coords) else ger end,
          inicio - (30 + power(random(), 1.6) * 11 * 365)::int);
      end loop;
    end loop;
  end loop;

  perform app_privado.simular_periodo(inicio, current_date);
  perform app_privado.gerar_clima();

  -- usuários de demonstração (senha de todos: rotalume-demo)
  insert into app.usuarios (id, nome, email, senha_hash, perfil, cargo, diretoria_id, colaborador_id) values
    (1, 'Helena Duarte', 'helena@rotalume.demo', crypt('rotalume-demo', gen_salt('bf', 10)), 'diretoria_rh',
        'Diretora de Pessoas e Cultura', null, null),
    (2, 'Caio Mendes',   'caio@rotalume.demo',   crypt('rotalume-demo', gen_salt('bf', 10)), 'hrbp',
        'HR Business Partner · Operações', 1, null),
    (3, 'Patrícia Lima', 'patricia@rotalume.demo', crypt('rotalume-demo', gen_salt('bf', 10)), 'gestor',
        'Gerente de produção', null, (select id from rh.colaboradores where nome = 'Patrícia Lima')),
    (4, 'Rafael Costa',  'rafael@rotalume.demo', crypt('rotalume-demo', gen_salt('bf', 10)), 'analista',
        'Analista de People Analytics', null, null);

  insert into app.atualizacoes (origem, detalhe) values ('instalação', 'Dados fictícios gerados');
end $$;
