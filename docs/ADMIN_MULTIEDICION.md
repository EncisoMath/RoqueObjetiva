# Administración multiedición — RoqueObjetiva v145

## Estado de despliegue

Se incorpora una pestaña **Ediciones y pruebas** al admin tradicional.
Hasta migrar todo el sitio, el login tradicional, resultados y rankings siguen funcionando sobre las tablas públicas originales.
La pestaña utiliza una segunda autenticación con **Supabase Auth** que no reutiliza la contraseña antigua.

## Acceso

1. Entrar al panel admin tradicional.
2. Abrir **Ediciones y pruebas**.
3. Introducir correo y contraseña del usuario creado previamente en Supabase → Authentication → Users y autorizado en roque_private.operadores_admin.
4. Seleccionar edición. 2026-1S es histórica y se consulta sin modificaciones; 2026-2S es borrador.
5. Usar los formularios para guardar grado, sesión, área e ítem, o crear una edición futura con una plantilla.

Las operaciones de escritura pasan por public.roque_v2_admin_guardar_parametro,
que valida auth.uid(), rol administrador y borrador sin resultados.
El navegador no guarda la contraseña ni los tokens de esta segunda cuenta en almacenamiento persistente.

## Preguntas masivas (requiere paso de base de datos)

Instalar el SQL de solo creación de funciones \`supabase/11_generar_items_borrador.sql\` en el SQL Editor del proyecto.
Tras instalarlo, desde un grado nuevo con áreas y sesiones configuradas y sin ítems existentes,
se asigna una sesión por área y se presiona **Generar preguntas**.
La función crea la numeración automáticamente y deja las claves como NULL.

**Protección:** jamás regenera un grado que ya tenga ítems; tampoco opera sobre
2026-1S, ediciones publicadas o una edición con resultados.
Para cambios masivos sobre grados clonados hay que diseñar una operación de reconciliación con vista previa y respaldo; no se permite un borrado implícito.

## Limitaciones pendientes

- El frontend y el login tradicional siguen leyendo las tablas legacy para resultados estudiantiles.
- Todavía no se implementan inscripciones de una nueva edición, lectura de resultados por edición ni publicación.
- Las funciones legacy roque_admin_sync y otras funciones públicas antiguas requieren auditoría; la interfaz nueva NO las utiliza.
- Deben probarse login de Supabase Auth, escritura de un borrador sin estudiantes y despliegue PWA desde un navegador real antes de dar la integración por validada.

## Seguridad

No añadir secretos de servicio ni contraseñas a GitHub o al frontend.
Mantener RLS y accesos privados del esquema roque_private.
No confundir permiso EXECUTE para authenticated con autorización administrativa: las RPC comprueban además la tabla operadores_admin.
La versión 145 añade una interfaz de gestión, no sustituye todavía la base de resultados pública.