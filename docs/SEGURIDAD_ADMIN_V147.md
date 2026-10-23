# Seguridad administrativa v147

Esta versión retira el acceso administrativo basado en una contraseña estática incorporada en el código público.

## Cambio aplicado en Supabase

Migración `roque_v147_invalidate_legacy_admin_and_secure_writes`:
- Sustituye la comprobación de contraseña de `roque_login` por `auth.uid()` asociado a `roque_private.operadores_admin` con `activo = true`.
- Elimina el cuerpo operativo de `roque_admin_sync` y `roque_upload_resultados_v109`.
- Retira privilegios públicos de funciones antiguas que modificaban resultados mediante contraseña.
- Agrega `roque_v3_admin_guardar_resultado`, con autenticación Supabase JWT, autorización individual y control de existencia de ID de prueba.
- Conserva las sesiones de alumnos/docentes y el límite v146.

## Acceso actualizado

Introduce el **correo electrónico** del usuario previamente creado en Supabase Authentication > Users y su contraseña exclusiva. No utilices el antiguo identificador genérico de administración. Los tokens y contraseñas no se escriben en almacenamiento persistente.

Después del cierre de sesión o al actualizar la página es necesario volver a entrar como administrador. La pestaña Ediciones y pruebas reutiliza el JWT autenticado.

## Registro histórico y aviso de seguridad

Eliminar una contraseña del código actual **no borra los commits anteriores**, los clones ni las cachés. Se invalidó la credencial en la base de datos para que conocerla ya no conceda permisos. Para limpiar historiales remotos haría falta una reescritura de Git cuidadosamente coordinada que no garantiza eliminar copias externas.

Revise los registros de auditoría y rote credenciales reutilizadas en otros sistemas. Recomendamos habilitar MFA para los operadores administrativos donde esté disponible.

La aplicación v147 debe publicarse con el caché PWA incrementado y verificarse en un navegador real usando el nuevo correo administrador.
