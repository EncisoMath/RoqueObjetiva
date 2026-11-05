# v175.48 — Coordinación sin PIN adicional

**Implementado en Supabase (5 de noviembre de 2026).**

## Tablas

- `roque_private.coordinator_sessions`: `token_hash` (SHA-256), `id_docente`, `terminal`, `creado_en`, `expira_en`, `revocado`. RLS habilitado y SELECT directo denegado a `anon` y `authenticated`.
- `roque_private.movimientos_curso`: registro de auditoría que se conserva. Incluye edición, ID de prueba, alumno, grado, sede, curso anterior, curso nuevo, coordinador y momento.

## API

- `public.roque_v8_login_controlado_private(p_user,p_password,p_terminal,p_device,p_mode)`: utiliza el login controlado preexistente. Si hay sesión docente válida y el docente tiene `coordinador=true`, emite un token temporal aleatorio de 64 caracteres (32 bytes), válido 90 minutos, retornado como `coordinator_session`. Solo el hash se almacena en Supabase.
- `roque_private.validar_coordinador_sesion(p_docente,p_token)`: comprueba hash, vigencia y condición de docente coordinador activo; el procedimiento no está expuesto por la API pública.
- `public.roque_v8_coordinador_listar(p_docente,p_sesion,p_edicion)`: lista estudiantes y cursos solo con sesión temporal válida.
- `public.roque_v8_coordinador_mover(p_docente,p_sesion,p_edicion,p_roll,p_curso_anterior,p_curso_nuevo)`: modifica exclusivamente `grupo` del estudiante; exige que el curso destino pertenezca a la misma sede y grado, verifica que el curso original no haya cambiado y escribe auditoría. Para 2026-1S sincroniza además `public.estudiantes`.

## Cambios respecto a v175.47

La pantalla ya no pide ninguna clave individual. Se retiraron de la base de datos las antiguas funciones `roque_v7_coordinador_listar`, `roque_v7_coordinador_mover`, `roque_private.verificar_coordinador_curso` y la tabla `roque_private.coordinator_move_keys`. El frontend no almacena el token en localStorage ni lo expone en GitHub.

**Limitación de seguridad existente:** el inicio de sesión de docentes de RoqueObjetiva se basa actualmente en identificación sin contraseña propia. Una sesión temporal verifica que el acceso sigue vigente, pero no prueba por sí misma la identidad de quien conoce el documento de un coordinador. La institución debería implementar autenticación personal antes de considerar estos movimientos plenamente protegidos.

## Verificación

- Inicio de sesión docente coordinador: respuesta válida, token temporal de 64 caracteres y listado 2026-1S de 877 inscripciones.
- La tabla de PIN ya no existe, las RPC antiguas fueron retiradas, y las sesiones temporales no tienen SELECT anónimo.
- Ningún alumno se movió durante la instalación o las pruebas.
