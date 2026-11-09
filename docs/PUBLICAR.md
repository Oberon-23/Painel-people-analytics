# Como publicar (Supabase + Vercel)

Cerca de 15 minutos, tudo no plano gratuito.

## 1. Criar o banco no Supabase

1. Em [supabase.com](https://supabase.com), crie um projeto:
   - Nome: `rotalume-people`
   - Senha do banco: gere uma e guarde (é a do dono, o app não vai usar)
   - Região: **South America (São Paulo)**
2. Abra **SQL Editor → New query**.
3. Abra o arquivo [`db/instalar.sql`](../db/instalar.sql) aqui no GitHub, clique em **Copy raw file**, cole tudo no editor e clique em **Run**.
4. No final aparece uma linha com dois valores. **Copie os dois**:
   - `senha_rh_app`: a senha do usuário que o aplicativo vai usar
   - `token_secret`: o segredo que assina as sessões

> Se der erro no meio, rode o conteúdo de [`db/remover.sql`](../db/remover.sql) e depois o `instalar.sql` de novo.

## 2. Montar a string de conexão

1. No Supabase, clique em **Connect** (no topo do projeto).
2. Escolha **Transaction pooler** (porta `6543`). A conexão direta não funciona na Vercel.
3. Copie a string. Ela vem assim:

```
postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

4. Troque o usuário e a senha:
   - `postgres.abcdefghijkl` vira `rh_app.abcdefghijkl` (mantenha o código do projeto depois do ponto)
   - `[YOUR-PASSWORD]` vira a `senha_rh_app` do passo 1

Fica assim:

```
postgresql://rh_app.abcdefghijkl:rh_1a2b3c...@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Importante:** o aplicativo deve usar o `rh_app`, nunca o `postgres`. O dono do banco ignora as regras de segurança.

## 3. Baixar o certificado do Supabase

O Supabase assina a conexão com um certificado próprio. Para o aplicativo conferir que está falando com o banco certo:

1. No Supabase, vá em **Project Settings → Database → SSL Configuration** e clique em **Download certificate**.
2. Abra o arquivo baixado (`prod-ca-2021.crt`) no Bloco de Notas e copie **todo** o conteúdo, de `-----BEGIN CERTIFICATE-----` até `-----END CERTIFICATE-----`.

## 4. Publicar na Vercel

1. Na Vercel, clique em **Add New → Project** e importe o repositório `Oberon-23/painel-people-analytics`.
2. Em **Environment Variables**, crie quatro variáveis:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a string do passo 2, com `rh_app` |
| `DATABASE_CA` | o conteúdo do certificado do passo 3 |
| `TOKEN_SECRET` | o `token_secret` do passo 1 |
| `CRON_SECRET` | uma senha longa qualquer (ex.: gere em [1password.com/password-generator](https://1password.com/password-generator)) |

3. Clique em **Deploy**.

O agendamento diário já vem configurado no `vercel.json`. Na aba **Settings → Cron Jobs** da Vercel, ele aparece como `/api/cron`, todo dia às 6h de Brasília.

## 5. Conferir

1. Abra o site e entre como **Helena**. A visão geral deve mostrar cerca de 350 pessoas.
2. Entre como **Rafael** e abra **Pessoas**: deve aparecer "o banco devolveu 0 pessoas".
3. Abra **Segurança** com qualquer perfil: as tentativas devem aparecer como barradas ou filtradas.
4. Entre como **Helena** e abra **Auditoria**: os acessos dos outros perfis aparecem lá.

Se a página der erro, veja em **Vercel → Logs**:
- `self-signed certificate`: o `DATABASE_CA` está faltando ou incompleto.
- `password authentication failed` ou `Tenant or user not found`: confira o `rh_app.código-do-projeto` e a senha na `DATABASE_URL`.

## Alternativa: Neon

Também funciona com o [Neon](https://neon.tech): rode o mesmo `instalar.sql` no SQL Editor, use a conexão *pooled* trocando o usuário por `rh_app` e a senha pela `senha_rh_app`, e não precisa de `DATABASE_CA`.
