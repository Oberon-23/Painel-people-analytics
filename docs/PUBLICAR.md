# Como publicar (Neon + Vercel)

Cerca de 15 minutos, tudo no plano gratuito. Você vai precisar de uma conta no [Neon](https://neon.tech) (pode entrar com o GitHub) e da sua conta na Vercel.

## 1. Criar o banco no Neon

1. No Neon, clique em **New Project**.
   - Nome: `rotalume-people`
   - Postgres: versão **16** ou mais nova
   - Região: **AWS São Paulo (sa-east-1)**, se aparecer; senão, a mais próxima
2. Abra o **SQL Editor** do projeto.
3. Abra o arquivo [`db/instalar.sql`](../db/instalar.sql) aqui do GitHub, clique em **Copy raw file**, cole tudo no editor e clique em **Run**.
4. No final aparece uma linha com dois valores. **Copie os dois**:
   - `senha_rh_app`: a senha do usuário que o aplicativo vai usar
   - `token_secret`: o segredo que assina as sessões

> Se der erro no meio, rode o conteúdo de [`db/remover.sql`](../db/remover.sql) e depois o `instalar.sql` de novo.

## 2. Montar a string de conexão

1. No Neon, clique em **Connect**.
2. Marque **Connection pooling** (pooled).
3. Copie a string. Ela vem assim:

```
postgresql://neondb_owner:SENHA_DO_DONO@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

4. Troque `neondb_owner:SENHA_DO_DONO` por `rh_app:` seguido da `senha_rh_app` do passo 1. Fica assim:

```
postgresql://rh_app:rh_abc123...@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

**Importante:** o aplicativo deve usar o `rh_app`, nunca o dono do banco. O dono ignora as regras de segurança.

## 3. Publicar na Vercel

1. Na Vercel, clique em **Add New → Project** e importe o repositório.
2. Em **Environment Variables**, crie três variáveis:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a string do passo 2, com `rh_app` |
| `TOKEN_SECRET` | o `token_secret` do passo 1 |
| `CRON_SECRET` | uma senha longa qualquer (ex.: gere em [1password.com/password-generator](https://1password.com/password-generator)) |

3. Clique em **Deploy**.

O agendamento diário já vem configurado no `vercel.json`. Na aba **Settings → Cron Jobs** da Vercel ele aparece como `/api/cron`, todo dia às 6h de Brasília.

## 4. Conferir

1. Abra o site e entre como **Helena**. A visão geral deve mostrar cerca de 350 pessoas.
2. Entre como **Rafael** e abra **Pessoas**: deve aparecer "o banco devolveu 0 pessoas".
3. Abra **Segurança** com qualquer perfil: as 10 tentativas devem aparecer como barradas ou filtradas.
4. Entre como **Helena** e abra **Auditoria**: os acessos dos outros perfis aparecem lá.
