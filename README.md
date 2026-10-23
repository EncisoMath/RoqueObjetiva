# RoqueObjetiva

Aplicación web para la consulta de resultados de pruebas objetivas de la **IED Roque de los Ríos Valle**.

Permite a estudiantes, docentes y directivos revisar resultados académicos, puntajes por área y rankings de desempeño de forma sencilla y visual.

## Versión

RoqueObjetiva v145

## Uso

Proyecto institucional para el seguimiento y análisis de resultados de pruebas objetivas.

## Administración multiedición (v145)

Desde el panel administrativo antiguo, abre **Ediciones y pruebas** y autentícate con tu usuario de **Supabase Auth**. Este módulo utiliza las RPC `roque_v2_admin_*`, instaladas previamente en Supabase. Los cambios solo se admiten en ediciones en borrador. Consulta la documentación en `docs/ADMIN_MULTIEDICION.md`.

## Protección de consultas v146

Las consultas estudiantiles usarán `roque_v2_login_controlado` y `roque_v2_ranking_controlado`. Instalación por etapas en `docs/CONTROL_CONSULTAS.md`. La fase 12 crea las RPC sin cambios visibles; luego se despliega el frontend, se prueba y se aplica la fase 13 para revocar los endpoints antiguos. **Sin fase 13 el límite puede eludirse llamando la API antigua.** No se utiliza dirección IP ni MAC.

## v147 Administrador
La antigua contraseña pública ha sido invalidada en Supabase y quitada del JavaScript de producción. Ingresa con la cuenta autorizada de Supabase Auth usando su correo electrónico. Los cambios individuales de resultados usan `roque_v3_admin_guardar_resultado` con verificación por JWT y rol privado.
