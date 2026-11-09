-- =====================================================================
-- Rotalume · People Analytics
-- 04 · Gera os dados, o segredo do token e a senha do rh_app
-- =====================================================================

select app_privado.gerar_tudo();

insert into app_privado.config values ('token_secret', encode(gen_random_bytes(32), 'hex'))
  on conflict (chave) do update set valor = excluded.valor;

do $$
declare s text := 'rh_' || encode(gen_random_bytes(18), 'hex');
begin
  execute format('alter role rh_app password %L', s);
  execute format('create temp table _instalacao as select %L::text as senha_rh_app', s);
end $$;

-- Copie os dois valores abaixo: eles vão para as variáveis do Vercel.
select (select senha_rh_app from _instalacao)                          as senha_rh_app,
       (select valor from app_privado.config where chave = 'token_secret') as token_secret,
       (select count(*) from rh.colaboradores)                          as colaboradores_gerados;
