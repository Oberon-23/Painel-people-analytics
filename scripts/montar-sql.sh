#!/usr/bin/env bash
# Junta os arquivos de db/ em um só, para colar no editor SQL do Neon ou do Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- Gerado por scripts/montar-sql.sh. Não edite aqui: edite os arquivos 01 a 04."
  for f in db/01_estrutura.sql db/02_dados.sql db/03_seguranca.sql db/04_finalizar.sql; do
    echo; echo "-- >>> $f"; cat "$f"
  done
} > db/instalar.sql
echo "db/instalar.sql: $(wc -c < db/instalar.sql) bytes"
