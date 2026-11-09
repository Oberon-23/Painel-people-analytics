-- Apaga tudo o que o instalar.sql criou (para reinstalar do zero).
drop schema if exists api cascade;
drop schema if exists app cascade;
drop schema if exists app_privado cascade;
drop schema if exists rh cascade;
drop owned by rh_app;
drop role if exists rh_app;
