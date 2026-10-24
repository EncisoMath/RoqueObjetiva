# RoqueObjetiva v172 · historial multisemestre con autenticacion personal

## Cambios
- Se mantiene **intacto** el login tradicional v171 por ID de examen/documento, restringido en servidor al historico 2026-1S. El reporte general existente no se rediseña.
- Nuevo acceso «Mis evaluaciones · cuenta personal» desde la pantalla de inicio.
- Las cuentas personales usan **Supabase Auth**. Solo un administrador Auth presente en `roque_private.operadores_admin` puede vincular `auth.users.id` a `roque_private.personas.id`.
- `roque_private.cuentas_estudiante` mantiene dicha asociacion uno-a-uno, privada, con RLS y sin grants directos a clientes.
- `public.roque_v5_historial_autorizado(p_edicion)` (ejecutable solo por `authenticated`) se basa en `auth.uid()`. Lista exclusivamente ediciones con matricula activa, resultados visibles y estado publicada/cerrada. Una edicion borrador o de otra persona siempre se rechaza.
- Al abrir una edicion, la RPC entrega **unicamente una ficha estudiantil, las claves del grado para esa edicion, sus propias respuestas y un ranking personal**. No devuelve companeros. La fuente para ranking son `roque_private.resultados/items/inscripciones` de esa edicion.
- El navegador reconstruye mapas, respuestas y ranking al cambiar de semestre. Si hay una sola evaluacion visible entra directamente al informe; si hay varias muestra selector. La cuenta Auth y refresh token estan **solo en memoria**, sin persistencia.
- Nuevo `js/historial.js`, `css/historial.css`; cache PWA actualizado a v172. UI flat oscura, radios maximos 4px.

## Alta institucional (no realizada en v172)
La institucion debera crear una cuenta Auth para cada alumno autorizado y vincularla a la persona correcta mediante `public.roque_v5_admin_vincular_estudiante(p_usuario_auth,p_persona)`, ejecutada con JWT del administrador. Validar en privado la identidad antes de asociar; **no** se pueden inferir vinculos con IDs de examen. No se crean cuentas, contrasenas ni asociaciones ficticias durante el despliegue.

## Prueba disponible hoy
1. Abrir la PWA, actualizar a v172 y entrar normalmente con un ID historico **autorizado** de 2026-1S: el reporte, puntajes y medallas deben seguir iguales.
2. Cerrar sesion; pulsar «Mis evaluaciones · cuenta personal»: se mostrara la pantalla nueva de correo y contrasena.
3. Sin una cuenta Auth **ya vinculada** no sera posible abrir una evaluacion: eso es un bloqueo de seguridad esperado, no una averia.
4. Cuando se vincule una cuenta real, con una sola edicion visible se debe abrir directamente 2026-1S. Cuando 2S se publique oficialmente y tenga su inscripcion vinculada a la misma persona, aparecera la seleccion de semestres. Mientras 2S sea borrador no debe mostrarse.
5. Cerrar sesion o refrescar la pestaña exige nuevamente la contrasena de historial. El acceso por ID previo permanece disponible.

## Verificacion de seguridad
- `public.roque_v5_historial_autorizado`: EXECUTE solo para `authenticated`; valida `auth.uid()` y relacion explicita de persona.
- `public.roque_v5_admin_vincular_estudiante`: exige JWT administrativo y usuario habilitado, no concede acceso anonimo.
- Cero cambios en inscripciones, resultados y claves, y ninguna publicacion de 2026-2S.
- Una prueba sintactica de JS, inventario SQL y conteos no sustituyen QA de navegador con cuenta de prueba real.
- Migracion canonica: `supabase/22_historial_autenticado_v172.sql`. Ejecutada en proyecto `wkbczbjexnwbmyscrhah`.

## Rollback
- Revertir UI de v172 mediante nuevo PR y actualizar PWA; funciones v171 permanecen intactas.
- La tabla privada y RPC v172 no requieren borrarse para devolver frontend a v171; revocar explicitamente nuevas RPC si se decide retirar el acceso.
