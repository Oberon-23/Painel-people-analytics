-- =====================================================================
-- Rotalume · People Analytics
-- 03 · Segurança
--
-- O aplicativo conecta com o usuário rh_app, que não enxerga nenhuma
-- tabela: só executa as funções do esquema api. Não lê, não altera e não
-- apaga nada diretamente.
--
-- O dado individual (lista de pessoas) passa por funções que rodam como
-- rh_leitor, um papel sem login que também não é dono das tabelas e,
-- por isso, obedece à RLS. Essas funções registram cada acesso: não existe
-- caminho para ler pessoas sem deixar rastro.
--
-- Quem está usando o painel chega ao banco como um token assinado
-- (HMAC-SHA256) na variável app.token. O banco confere a assinatura com
-- um segredo que o rh_app não consegue ler. Token ausente, vencido ou
-- adulterado = usuário nenhum = zero linhas.
--
-- Camadas:
--   1. Linha    RLS: cada perfil só recebe as pessoas do seu escopo
--   2. Coluna   CPF e salário só saem mascarados ou para quem pode
--   3. Grupo    agregados com menos de 5 pessoas são suprimidos
--   4. Rastro   todo acesso a dado individual fica registrado
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rh_app') then
    create role rh_app login nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'rh_leitor') then
    create role rh_leitor nologin nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
-- quem instala precisa poder transferir funções para o rh_leitor
grant rh_leitor to current_user;

-- ---------------------------------------------------------------------
-- Identidade: quem está pedindo?
-- ---------------------------------------------------------------------
create or replace function app.usuario_atual() returns smallint
language plpgsql stable security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  t text := current_setting('app.token', true);
  p text[];
  esperado text;
begin
  if t is null or t = '' then return null; end if;
  p := string_to_array(t, '.');
  if array_length(p, 1) <> 3
     or p[1] !~ '^\d{1,4}$' or p[2] !~ '^\d{1,12}$' or p[3] !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  esperado := encode(hmac(p[1] || '.' || p[2],
                          (select valor from app_privado.config where chave = 'token_secret'),
                          'sha256'), 'hex');
  if esperado is distinct from p[3] then return null; end if;
  if p[2]::bigint < extract(epoch from now()) then return null; end if;
  return p[1]::smallint;
exception when others then
  return null;
end $$;

create or replace function app.perfil() returns text
language sql stable security definer set search_path = pg_catalog as $$
  select perfil from app.usuarios where id = app.usuario_atual()
$$;

-- O que cada perfil pode fazer. Um lugar só, fácil de auditar.
create or replace function app.pode(acao text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(case acao
    when 'individual'       then app.perfil() in ('diretoria_rh', 'hrbp', 'gestor')
    when 'salario'          then app.perfil() in ('diretoria_rh', 'hrbp')
    when 'salario_agregado' then app.perfil() in ('diretoria_rh', 'hrbp', 'analista')
    when 'cpf'              then app.perfil() in ('diretoria_rh', 'hrbp')
    when 'exportar'         then app.perfil() in ('diretoria_rh', 'hrbp')
    when 'auditoria'        then app.perfil() = 'diretoria_rh'
    else false end, false)
$$;

-- Pessoas que o usuário pode ver uma a uma.
create or replace function app.escopo_ids() returns int[]
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  u app.usuarios;
begin
  select * into u from app.usuarios where id = app.usuario_atual();
  if not found then return '{}'; end if;
  if u.perfil = 'diretoria_rh' then
    return array(select id from rh.colaboradores);
  elsif u.perfil = 'hrbp' then
    return array(select c.id from rh.colaboradores c join rh.areas a on a.id = c.area_id
                 where a.diretoria_id = u.diretoria_id);
  elsif u.perfil = 'gestor' then
    return array(with recursive equipe as (
                   select id from rh.colaboradores where id = u.colaborador_id
                   union all
                   select c.id from rh.colaboradores c join equipe e on c.gestor_id = e.id)
                 select id from equipe);
  end if;
  return '{}';   -- analista: nenhum dado individual
end $$;

-- Pessoas que entram nos números agregados (o analista vê a empresa
-- toda, mas só em grupos de 5 ou mais).
create or replace function app.escopo_agregado_ids() returns int[]
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  if app.perfil() = 'analista' then
    return array(select id from rh.colaboradores);
  end if;
  return app.escopo_ids();
end $$;

-- Tamanho mínimo de grupo (padrão 5). Fica na configuração para poder ser testado.
create or replace function app.k_min() returns int
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce((select valor::int from app_privado.config where chave = 'k_min'), 5)
$$;

create or replace function app.exigir_usuario() returns app.usuarios
language plpgsql stable security definer set search_path = pg_catalog as $$
declare u app.usuarios;
begin
  select * into u from app.usuarios where id = app.usuario_atual();
  if not found then
    raise exception 'Sessão inválida ou expirada' using errcode = '28000';
  end if;
  return u;
end $$;

-- ---------------------------------------------------------------------
-- Camada 1 · Linha (RLS)
-- ---------------------------------------------------------------------
alter table rh.colaboradores   enable row level security;
alter table rh.ausencias       enable row level security;
alter table rh.clima_respostas enable row level security;   -- sem política: ninguém lê
alter table app.usuarios       enable row level security;
alter table app.acessos        enable row level security;
alter table app.login_tentativas enable row level security;
alter table app.atualizacoes   enable row level security;
alter table app_privado.config enable row level security;

drop policy if exists escopo on rh.colaboradores;
create policy escopo on rh.colaboradores for select to rh_leitor
  using (id = any ((select app.escopo_ids())::int[]));

drop policy if exists escopo on rh.ausencias;
create policy escopo on rh.ausencias for select to rh_leitor
  using (colaborador_id = any ((select app.escopo_ids())::int[]));

drop policy if exists leitura on app.atualizacoes;

-- ---------------------------------------------------------------------
-- Camada 2 · Coluna
-- ---------------------------------------------------------------------
create or replace function app.salario_de(cid int) returns numeric
language sql stable security definer set search_path = pg_catalog as $$
  select c.salario
  from rh.colaboradores c
  join rh.areas a on a.id = c.area_id
  join app.usuarios u on u.id = app.usuario_atual()
  where c.id = cid
    and (u.perfil = 'diretoria_rh' or (u.perfil = 'hrbp' and a.diretoria_id = u.diretoria_id))
$$;

create or replace function app.cpf_de(cid int) returns text
language sql stable security definer set search_path = pg_catalog as $$
  select case u.perfil
           when 'diretoria_rh' then c.cpf
           else '***.' || substr(c.cpf, 5, 3) || '.' || substr(c.cpf, 9, 3) || '-**' end
  from rh.colaboradores c
  join rh.areas a on a.id = c.area_id
  join app.usuarios u on u.id = app.usuario_atual()
  where c.id = cid
    and (u.perfil = 'diretoria_rh' or (u.perfil = 'hrbp' and a.diretoria_id = u.diretoria_id))
$$;

-- A visão de pessoas roda com as permissões de quem consulta
-- (security_invoker), então a RLS acima vale aqui também. Ela é interna:
-- só o rh_leitor a lê, e só de dentro das funções da api.
create or replace view rh.v_pessoas with (security_invoker = true) as
select c.id,
       c.nome,
       app.cpf_de(c.id)                         as cpf,
       c.genero,
       c.cargo,
       c.nivel_id,
       n.nome                                   as nivel,
       ar.nome                                  as area,
       d.nome                                   as diretoria,
       un.nome                                  as unidade,
       g.nome                                   as gestor,
       c.admissao,
       c.desligamento,
       c.tipo_desligamento,
       c.modalidade,
       app.salario_de(c.id)                     as salario
from rh.colaboradores c
join rh.niveis n      on n.id = c.nivel_id
join rh.areas ar      on ar.id = c.area_id
join rh.diretorias d  on d.id = ar.diretoria_id
join rh.unidades un   on un.id = c.unidade_id
left join rh.colaboradores g on g.id = c.gestor_id;

-- ---------------------------------------------------------------------
-- Camada 4 · Rastro (auditoria)
-- ---------------------------------------------------------------------
create or replace function api.registrar(p_acao text, p_detalhe text default null, p_linhas int default null)
returns void language plpgsql volatile security definer set search_path = pg_catalog as $$
declare uid smallint := app.usuario_atual();
begin
  if uid is null then return; end if;
  insert into app.acessos (usuario_id, acao, detalhe, linhas)
  values (uid, left(p_acao, 60), left(p_detalhe, 300), p_linhas);
end $$;

-- ---------------------------------------------------------------------
-- Login
-- ---------------------------------------------------------------------
-- O bloqueio vale para o par e-mail + origem (IP). Assim, quem erra a
-- senha de propósito bloqueia só a si mesmo, e não o perfil para todo
-- mundo. Uma mesma origem também é barrada se errar demais em vários
-- e-mails. O IP é guardado só como hash (LGPD: dado mínimo).
create or replace function api.login(p_email text, p_senha text, p_origem text default null)
returns json language plpgsql volatile security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  u app.usuarios;
  falhas_email int;
  falhas_origem int;
  email_n text := lower(trim(p_email));
  origem_h text := left(encode(digest(coalesce(p_origem, 'desconhecida'), 'sha256'), 'hex'), 16);
begin
  select count(*) filter (where email = email_n), count(*) into falhas_email, falhas_origem
    from app.login_tentativas
   where origem = origem_h and not ok and quando > now() - interval '15 minutes';
  if falhas_email >= 5 or falhas_origem >= 30 then
    return json_build_object('ok', false, 'motivo', 'bloqueado');
  end if;

  select * into u from app.usuarios where email = email_n;
  if not found or u.senha_hash <> crypt(p_senha, u.senha_hash) then
    insert into app.login_tentativas (email, origem, ok) values (email_n, origem_h, false);
    return json_build_object('ok', false, 'motivo', 'invalido');
  end if;

  insert into app.login_tentativas (email, origem, ok) values (email_n, origem_h, true);
  insert into app.acessos (usuario_id, acao, detalhe) values (u.id, 'login', null);
  return json_build_object('ok', true, 'id', u.id);
end $$;

-- ---------------------------------------------------------------------
-- Sessão
-- ---------------------------------------------------------------------
create or replace function api.sessao() returns json
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  u app.usuarios := app.exigir_usuario();
  escopo text;
begin
  escopo := case u.perfil
    when 'diretoria_rh' then 'Toda a empresa'
    when 'hrbp' then 'Diretoria de ' || (select nome from rh.diretorias where id = u.diretoria_id)
    when 'gestor' then 'Sua equipe (você e quem se reporta a você)'
    else 'Empresa toda, só em grupos de 5 pessoas ou mais' end;
  return json_build_object(
    'id', u.id, 'nome', u.nome, 'email', u.email, 'perfil', u.perfil, 'cargo', u.cargo,
    'escopo', escopo,
    'pessoas_visiveis', coalesce(array_length(app.escopo_ids(), 1), 0),
    'pessoas_agregado', coalesce(array_length(app.escopo_agregado_ids(), 1), 0),
    'pode', json_build_object(
      'individual', app.pode('individual'), 'salario', app.pode('salario'),
      'salario_agregado', app.pode('salario_agregado'), 'cpf', app.pode('cpf'),
      'exportar', app.pode('exportar'), 'auditoria', app.pode('auditoria')),
    'dados_ate', (select valor from app_privado.config where chave = 'dados_ate'),
    'ultima_atualizacao', (select max(quando) from app.atualizacoes)
  );
end $$;

-- ---------------------------------------------------------------------
-- Camada 3 · Agregados (só grupos com 5 pessoas ou mais quando o
-- perfil não tem acesso individual)
-- ---------------------------------------------------------------------

-- Série mensal: headcount no fim do mês, admissões, desligamentos e absenteísmo
create or replace function api.serie_mensal(p_meses int default 24)
returns table (mes date, headcount int, admissoes int, desligamentos int, voluntarios int,
               dias_ausencia numeric, absenteismo numeric)
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  ids int[];
begin
  perform app.exigir_usuario();
  ids := app.escopo_agregado_ids();
  return query
  with meses as (
    select (date_trunc('month', current_date) - make_interval(months => g))::date as ini
    from generate_series(0, least(p_meses, 36) - 1) g
  ), c as (
    select * from rh.colaboradores where id = any (ids)
  )
  select m.ini,
         (select count(*)::int from c where c.admissao <= least((m.ini + interval '1 month - 1 day')::date, current_date)
             and (c.desligamento is null or c.desligamento > least((m.ini + interval '1 month - 1 day')::date, current_date))),
         (select count(*)::int from c where c.admissao >= m.ini and c.admissao < m.ini + interval '1 month' and c.admissao <= current_date),
         (select count(*)::int from c where c.desligamento >= m.ini and c.desligamento < m.ini + interval '1 month'),
         (select count(*)::int from c where c.desligamento >= m.ini and c.desligamento < m.ini + interval '1 month'
             and c.tipo_desligamento = 'voluntario'),
         (select coalesce(sum(a.dias), 0) from rh.ausencias a
             where a.colaborador_id = any (ids) and a.data >= m.ini and a.data < m.ini + interval '1 month'),
         null::numeric
  from meses m
  order by m.ini;
end $$;

-- KPIs dos últimos 12 meses, com o período anterior para comparar.
create or replace function api.kpis() returns json
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  ids int[];
  individual boolean := app.pode('individual');
  sal boolean := app.pode('salario_agregado');
  r json;
begin
  perform app.exigir_usuario();
  ids := app.escopo_agregado_ids();
  with c as (select * from rh.colaboradores where id = any (ids)),
  ativos as (select * from c where admissao <= current_date and (desligamento is null or desligamento > current_date)),
  fins as (select (current_date - make_interval(months => g))::date as d from generate_series(0, 23) g),
  hc as (
    select f.d, (select count(*) from c where admissao <= f.d and (desligamento is null or desligamento > f.d)) as n
    from fins f
  ),
  per as (
    select
      (select avg(n) from hc where d > current_date - interval '12 months')                              as hc12,
      (select avg(n) from hc where d <= current_date - interval '12 months')                             as hc_ant,
      (select count(*) from c where desligamento > current_date - interval '12 months' and desligamento <= current_date) as desl12,
      (select count(*) from c where desligamento > current_date - interval '24 months' and desligamento <= current_date - interval '12 months') as desl_ant,
      (select count(*) from c where desligamento > current_date - interval '12 months' and desligamento <= current_date and tipo_desligamento = 'voluntario') as vol12,
      (select count(*) from c where admissao > current_date - interval '12 months' and admissao <= current_date) as adm12,
      (select count(*) from c where admissao > current_date) as adm_prevista,
      (select coalesce(sum(dias), 0) from rh.ausencias where colaborador_id = any (ids) and data > current_date - interval '3 months')  as aus3,
      (select coalesce(sum(dias), 0) from rh.ausencias where colaborador_id = any (ids) and data > current_date - interval '6 months' and data <= current_date - interval '3 months') as aus_ant,
      (select avg(n) from hc where d > current_date - interval '3 months')                                as hc3,
      (select avg(n) from hc where d > current_date - interval '6 months' and d <= current_date - interval '3 months') as hc3_ant
  )
  select json_build_object(
    'headcount', (select count(*) from ativos),
    'suprimido', not individual and (select count(*) from ativos) < app.k_min(),
    'admissoes_12m', per.adm12,
    'admissoes_previstas', per.adm_prevista,
    'desligamentos_12m', per.desl12,
    'voluntarios_12m', per.vol12,
    'turnover_12m', case when per.hc12 > 0 then per.desl12 / per.hc12 end,
    'turnover_ant', case when per.hc_ant > 0 then per.desl_ant / per.hc_ant end,
    'absenteismo_3m', case when per.hc3 > 0 then per.aus3 / (per.hc3 * 63) end,
    'absenteismo_ant', case when per.hc3_ant > 0 then per.aus_ant / (per.hc3_ant * 63) end,
    'tempo_casa_anos', (select avg((current_date - admissao) / 365.25) from ativos),
    'pct_mulheres', (select avg((genero = 'F')::int) from ativos),
    'pct_mulheres_lideranca', (select avg((genero = 'F')::int) from ativos where nivel_id >= 5),
    'lideres', (select count(*) from ativos where nivel_id >= 5),
    'salario_medio', case when sal and (select count(*) from ativos) >= app.k_min()
                          then (select round(avg(salario)) from ativos) end
  ) into r
  from per;

  if not individual and (r->>'headcount')::int < app.k_min() then
    return json_build_object('headcount', null, 'suprimido', true);
  end if;
  return r;
end $$;

-- Indicadores por área.
create or replace function api.por_area()
returns table (area_id smallint, area text, diretoria text, headcount int, desligamentos_12m int,
               turnover_12m numeric, pct_voluntario numeric, absenteismo_3m numeric, absenteismo_ant numeric,
               enps numeric, suprimido boolean)
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  ids int[];
  individual boolean := app.pode('individual');
begin
  perform app.exigir_usuario();
  ids := app.escopo_agregado_ids();
  return query
  with c as (select * from rh.colaboradores where id = any (ids)),
  base as (
    select ar.id, ar.nome, d.nome as dir,
      (select count(*) from c where c.area_id = ar.id and c.admissao <= current_date and (c.desligamento is null or c.desligamento > current_date))::int as hc,
      (select count(*) from c where c.area_id = ar.id and c.desligamento > current_date - interval '12 months' and c.desligamento <= current_date)::int as dl,
      (select count(*) from c where c.area_id = ar.id and c.desligamento > current_date - interval '12 months' and c.desligamento <= current_date and c.tipo_desligamento = 'voluntario')::int as vol,
      (select avg(n) from (select (select count(*) from c where c.area_id = ar.id and c.admissao <= f and (c.desligamento is null or c.desligamento > f)) n
                           from generate_series(current_date - interval '11 months', current_date, interval '1 month') f) z) as hc12,
      (select coalesce(sum(a.dias), 0) from rh.ausencias a join c on c.id = a.colaborador_id where c.area_id = ar.id and a.data > current_date - interval '3 months') as a3,
      (select coalesce(sum(a.dias), 0) from rh.ausencias a join c on c.id = a.colaborador_id where c.area_id = ar.id and a.data > current_date - interval '6 months' and a.data <= current_date - interval '3 months') as a_ant,
      (select avg(n) from (select (select count(*) from c where c.area_id = ar.id and c.admissao <= f and (c.desligamento is null or c.desligamento > f)) n
                           from generate_series(current_date - interval '5 months', current_date - interval '3 months', interval '1 month') f) z) as hc_ant
    from rh.areas ar join rh.diretorias d on d.id = ar.diretoria_id
    where exists (select 1 from c where c.area_id = ar.id)
  ),
  clima as (
    select r.area_id, count(*) as n,
           (100.0 * avg((r.nota >= 9)::int) - 100.0 * avg((r.nota <= 6)::int)) as enps
    from rh.clima_respostas r
    where r.ciclo = (select max(ciclo) from rh.clima_respostas)
    group by r.area_id
  )
  , prim as (
    -- supressão primária: grupo pequeno demais
    select b.*, (not individual and b.hc < app.k_min()) as sup1 from base b
  ), comp as (
    -- supressão complementar: se só uma área ficou oculta, o total menos as
    -- visíveis revelaria o número dela. Então a menor área visível também sai.
    select p.*,
           p.sup1 or (
             (select count(*) from prim x where x.sup1) = 1
             and p.id = (select x.id from prim x where not x.sup1 order by x.hc, x.id limit 1)
           ) as sup
    from prim p
  )
  select b.id, b.nome, b.dir,
         case when sup then null else b.hc end,
         case when sup then null else b.dl end,
         case when sup or b.hc12 = 0 then null else round(b.dl / b.hc12, 4) end,
         case when sup or b.dl = 0 then null else round(b.vol::numeric / b.dl, 4) end,
         case when sup or b.hc = 0 then null else round(b.a3 / (b.hc * 63.0), 4) end,
         case when sup or coalesce(b.hc_ant, 0) = 0 then null else round(b.a_ant / (b.hc_ant * 63.0), 4) end,
         case when not sup and cl.n >= app.k_min() then round(cl.enps, 0) end,
         sup
  from comp b
  left join clima cl on cl.area_id = b.id
  order by b.id;
end $$;

-- Remuneração por nível e gênero (relatório de igualdade salarial).
create or replace function api.remuneracao()
returns table (nivel_id smallint, nivel text, n_mulheres int, n_homens int,
               mediana_mulheres numeric, mediana_homens numeric, razao numeric, suprimido boolean)
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  ids int[];
begin
  perform app.exigir_usuario();
  if not app.pode('salario_agregado') then
    raise exception 'Seu perfil não tem acesso a dados de remuneração' using errcode = '42501';
  end if;
  ids := app.escopo_agregado_ids();
  return query
  with ativos as (
    select * from rh.colaboradores
    where id = any (ids) and admissao <= current_date and (desligamento is null or desligamento > current_date)
  ), g as (
    select n.id, n.nome,
           count(*) filter (where a.genero = 'F')::int as nf,
           count(*) filter (where a.genero = 'M')::int as nm,
           percentile_cont(.5) within group (order by a.salario) filter (where a.genero = 'F') as mf,
           percentile_cont(.5) within group (order by a.salario) filter (where a.genero = 'M') as mm
    from rh.niveis n join ativos a on a.nivel_id = n.id
    group by n.id, n.nome
  )
  select g.id, g.nome, g.nf, g.nm,
         case when g.nf >= app.k_min() then round(g.mf::numeric, -1) end,
         case when g.nm >= app.k_min() then round(g.mm::numeric, -1) end,
         case when g.nf >= app.k_min() and g.nm >= app.k_min() then round((g.mf / g.mm)::numeric, 4) end,
         g.nf < app.k_min() or g.nm < app.k_min()
  from g order by g.id;
end $$;

-- Pesquisa de clima: eNPS por área e ciclo. Grupo com menos de 5
-- respostas não aparece para ninguém, nem para a diretoria.
create or replace function api.clima()
returns table (area_id smallint, area text, ciclo date, respostas int, nota_media numeric, enps numeric, suprimido boolean)
language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  ids int[];
begin
  perform app.exigir_usuario();
  ids := app.escopo_agregado_ids();
  return query
  with areas_visiveis as (
    select distinct c.area_id from rh.colaboradores c where c.id = any (ids)
  ), g as (
    select r.area_id, r.ciclo, count(*)::int as n, avg(r.nota) as media,
           100.0 * avg((r.nota >= 9)::int) - 100.0 * avg((r.nota <= 6)::int) as e
    from rh.clima_respostas r
    where r.area_id in (select av.area_id from areas_visiveis av)
    group by r.area_id, r.ciclo
  )
  select g.area_id, ar.nome, g.ciclo, g.n,
         case when g.n >= app.k_min() then round(g.media, 1) end,
         case when g.n >= app.k_min() then round(g.e, 0) end,
         g.n < app.k_min()
  from g join rh.areas ar on ar.id = g.area_id
  order by g.area_id, g.ciclo;
end $$;

-- Lista de pessoas (dado individual): roda como rh_leitor, passa pela RLS
-- e fica registrada.
create or replace function api.listar_pessoas(
  p_busca text default null, p_area text default null, p_situacao text default 'ativos',
  p_ordem text default 'nome', p_pagina int default 1, p_por_pagina int default 25, p_motivo text default 'consulta'
) returns json
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  total int;
  linhas json;
  ordem text := case p_ordem
    when 'admissao' then 'admissao desc' when 'area' then 'area, nome' when 'nivel' then 'nivel_id desc, nome'
    when 'salario' then 'salario desc nulls last' else 'nome' end;
  lim int := least(greatest(p_por_pagina, 1), case when p_motivo = 'exportacao' then 1000 else 100 end);
  filtro text := ' where true'
    || case when coalesce(p_busca, '') <> '' then ' and (nome ilike ' || quote_literal('%' || p_busca || '%')
                                                     || ' or cargo ilike ' || quote_literal('%' || p_busca || '%') || ')' else '' end
    || case when coalesce(p_area, '') <> '' then ' and area = ' || quote_literal(p_area) else '' end
    || case p_situacao
         when 'ativos' then ' and admissao <= current_date and (desligamento is null or desligamento > current_date)'
         when 'desligados' then ' and desligamento <= current_date'
         when 'previstos' then ' and admissao > current_date'
         else '' end;
begin
  perform app.exigir_usuario();
  execute 'select count(*) from rh.v_pessoas' || filtro into total;
  execute format('select coalesce(json_agg(p), ''[]'') from (select * from rh.v_pessoas %s order by %s limit %s offset %s) p',
                 filtro, ordem, lim, (greatest(p_pagina, 1) - 1) * lim)
    into linhas;
  perform api.registrar(case when p_motivo = 'exportacao' then 'exportação' else 'consulta de pessoas' end,
                        nullif(concat_ws(' · ', nullif(p_busca, ''), nullif(p_area, ''), p_situacao), ''),
                        case when p_motivo = 'exportacao' then total else json_array_length(linhas) end);
  return json_build_object('total', total, 'linhas', linhas);
end $$;

-- Todas as pessoas do escopo, sem filtro (é o "select * from" da API).
-- Também roda como rh_leitor e também fica registrada.
create or replace function api.pessoas() returns setof rh.v_pessoas
language plpgsql volatile security definer set search_path = pg_catalog as $$
declare n int;
begin
  perform app.exigir_usuario();
  return query select * from rh.v_pessoas;
  get diagnostics n = row_count;
  perform api.registrar('consulta de pessoas', 'api.pessoas(), sem filtro', n);
end $$;

-- Áreas que aparecem no filtro da lista de pessoas.
create or replace function api.areas_visiveis() returns setof text
language sql stable security definer set search_path = pg_catalog as $$
  select distinct area from rh.v_pessoas order by area
$$;

-- Log de acessos: só a diretoria de RH.
create or replace function api.auditoria(p_limite int default 100)
returns table (quando timestamptz, usuario text, perfil text, acao text, detalhe text, linhas int)
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  perform app.exigir_usuario();
  if not app.pode('auditoria') then
    raise exception 'Seu perfil não tem acesso à auditoria' using errcode = '42501';
  end if;
  return query
  select a.quando, u.nome, u.perfil, a.acao, a.detalhe, a.linhas
  from app.acessos a left join app.usuarios u on u.id = a.usuario_id
  order by a.quando desc limit least(p_limite, 500);
end $$;

create or replace function api.auditoria_resumo()
returns table (usuario text, perfil text, acessos int, linhas int, ultimo timestamptz)
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  perform app.exigir_usuario();
  if not app.pode('auditoria') then
    raise exception 'Seu perfil não tem acesso à auditoria' using errcode = '42501';
  end if;
  return query
  select u.nome, u.perfil, count(a.id)::int, coalesce(sum(a.linhas), 0)::int, max(a.quando)
  from app.usuarios u left join app.acessos a on a.usuario_id = u.id and a.quando > now() - interval '30 days'
  group by u.id, u.nome, u.perfil order by u.id;
end $$;

-- Atualização diária (chamada pelo agendador do Vercel): simula os dias
-- que faltam até hoje. O aplicativo só chama; quem escreve é o banco.
create or replace function api.atualizar_dados(p_origem text default 'agendada') returns json
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  ate date := coalesce((select valor::date from app_privado.config where chave = 'dados_ate'), current_date - 1);
  dias int := current_date - ate;
  saidas int := 0;
  aus_antes int := (select count(*) from rh.ausencias);
begin
  if dias > 0 then
    saidas := app_privado.simular_periodo(ate + 1, current_date);
  end if;
  insert into app.atualizacoes (origem, detalhe)
  values (left(p_origem, 30), format('%s dia(s) processado(s), %s desligamento(s), %s ausência(s)',
                                     greatest(dias, 0), saidas, (select count(*) from rh.ausencias) - aus_antes));
  return json_build_object('dias', greatest(dias, 0), 'desligamentos', saidas,
                           'ausencias', (select count(*) from rh.ausencias) - aus_antes);
end $$;

-- ---------------------------------------------------------------------
-- Permissões do rh_app (o mínimo necessário)
-- ---------------------------------------------------------------------
revoke all on schema rh, app, app_privado, api from public;
revoke all on all tables in schema rh, app, app_privado, api from public;
revoke execute on all functions in schema rh, app, app_privado, api from public;
alter default privileges in schema rh, app, app_privado, api revoke execute on functions from public;

-- rh_leitor: o papel que lê pessoas, sempre por trás das funções e da RLS
grant usage on schema rh, app, api to rh_leitor;
grant select (id, nome, genero, cargo, nivel_id, area_id, unidade_id, gestor_id,
              admissao, desligamento, tipo_desligamento, modalidade)
  on rh.colaboradores to rh_leitor;
grant select on rh.areas, rh.diretorias, rh.unidades, rh.niveis to rh_leitor;
grant select on rh.v_pessoas to rh_leitor;
grant execute on function app.escopo_ids(), app.salario_de(int), app.cpf_de(int),
  app.exigir_usuario(), api.registrar(text, text, int) to rh_leitor;
-- rh.clima_respostas, rh.ausencias, app.usuarios, app.acessos e app_privado: nada

-- (o novo dono precisa de CREATE no esquema só durante a troca)
grant create on schema api to rh_leitor;
alter function api.listar_pessoas(text, text, text, text, int, int, text) owner to rh_leitor;
alter function api.pessoas() owner to rh_leitor;
alter function api.areas_visiveis() owner to rh_leitor;
revoke create on schema api from rh_leitor;

-- rh_app: nenhuma tabela, só a "API" do banco
grant usage on schema api to rh_app;
grant execute on function
  api.login(text, text, text), api.sessao(), api.registrar(text, text, int),
  api.kpis(), api.serie_mensal(int), api.por_area(), api.remuneracao(), api.clima(),
  api.listar_pessoas(text, text, text, text, int, int, text), api.pessoas(), api.areas_visiveis(),
  api.auditoria(int), api.auditoria_resumo(), api.atualizar_dados(text)
to rh_app;
