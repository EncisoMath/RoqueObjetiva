# Roque Objetiva v108 - Supabase

Esta versión usa Supabase como fuente privada de datos.

## Antes de subir esta app a GitHub

1. En Supabase ejecuta primero el SQL privado que ya tenías:
   - `01_schema.sql`
   - `02_seed_data.sql`
2. Luego ejecuta el nuevo archivo de esta versión:
   - `03_admin_write_rpc.sql`

Ese tercer archivo habilita la escritura administrativa desde el panel Admin.

## Qué cambia en v108

- El panel Admin ya no muestra "Publicar en GitHub".
- Ahora muestra "Subir a Supabase".
- Los cambios de estudiantes, docentes, cargas, directores, claves, resultados y ajustes públicos se sincronizan con Supabase mediante la función RPC `roque_admin_sync`.
- La pantalla de carga usa mensajes aleatorios más informales y no muestra "Conectando con Supabase".

## Seguridad

No subas archivos SQL privados al repositorio público.
La publishable key puede ir en la app, pero las secret keys y la contraseña de base de datos no.
