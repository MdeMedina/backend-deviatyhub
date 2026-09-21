-- SQL que se aplica ANTES de `prisma db push`, en cada despliegue.
--
-- Por qué existe: `db push` se niega a ejecutar ciertos cambios sin
-- --accept-data-loss, aunque en nuestro caso no puedan perder nada. Activar ese
-- flag en el pipeline resolvería el síntoma y abriría un agujero mucho peor: un
-- despliegue futuro podría borrar una columna, o una tabla, en silencio. Este
-- archivo es la vía explícita para esos casos concretos.
--
-- REGLA: todo lo que se escriba aquí debe ser IDEMPOTENTE (IF NOT EXISTS o
-- equivalente), porque se ejecuta en todos los despliegues, no una sola vez.

-- Enlace entre la ficha de un profesional y la cuenta con la que entra.
-- prisma trata el alta de una restricción UNIQUE como potencialmente
-- destructiva aunque la columna sea nueva y no pueda tener duplicados. Al
-- crearla aquí, `db push` ya no encuentra nada que objetar.
-- El nombre del índice es el que prisma genera para un @unique de campo
-- (<tabla>_<columna>_key); con otro nombre, db push intentaría crear el suyo.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS doctors_user_id_key ON doctors (user_id);
