-- Apaga tudo o que o instalar.sql criou (para reinstalar do zero).
drop schema if exists api cascade;
drop schema if exists app cascade;
drop schema if exists app_privado cascade;
drop schema if exists rh cascade;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'rh_app') then
    execute 'drop owned by rh_app'; execute 'drop role rh_app';
  end if;
  if exists (select 1 from pg_roles where rolname = 'rh_leitor') then
    execute 'drop owned by rh_leitor'; execute 'drop role rh_leitor';
  end if;
end $$;
