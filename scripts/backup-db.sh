#!/usr/bin/env bash
# Respaldo diario de la base de datos de producción.
#
# Hasta el 23/10 no existía ninguno. Deja un pg_dump comprimido (formato
# custom, se restaura con pg_restore) en BACKUP_DIR y borra los de más de
# RETENCION_DIAS. Pensado para el cron del servidor:
#
#   15 4 * * * /home/ubuntu/backend-deviatyhub/scripts/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# OJO: un respaldo en el mismo servidor no protege si se pierde el servidor.
# Hay que copiarlo además fuera (S3, B2 o similar) cuando haya dónde.
#
# Restaurar (sobre una base vacía):
#   docker exec -i backend-deviatyhub-postgres-1 pg_restore -U postgres -d deviatyhub --clean --if-exists < archivo.dump
set -euo pipefail

CONTENEDOR="${CONTENEDOR:-backend-deviatyhub-postgres-1}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/postgres}"
RETENCION_DIAS="${RETENCION_DIAS:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

archivo="$BACKUP_DIR/deviatyhub-$(date +%Y%m%d-%H%M).dump"
tmp="$archivo.parcial"

# Usuario y base, del propio contenedor: la contraseña no sale de él.
docker exec "$CONTENEDOR" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp"

# Un dump vacío o truncado no cuenta como respaldo.
if [ ! -s "$tmp" ] || ! docker exec -i "$CONTENEDOR" pg_restore --list < "$tmp" > /dev/null; then
  echo "$(date -Is) ERROR: el respaldo salió vacío o ilegible" >&2
  rm -f "$tmp"
  exit 1
fi

mv "$tmp" "$archivo"
chmod 600 "$archivo"
echo "$(date -Is) OK $(du -h "$archivo" | cut -f1) $archivo"

find "$BACKUP_DIR" -name 'deviatyhub-*.dump' -mtime +"$RETENCION_DIAS" -delete
