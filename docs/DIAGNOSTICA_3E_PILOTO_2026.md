# Diagnóstica 3E · 2026-2S · piloto de grado 10°

Estado: **piloto privado**, versión de cliente v175.120.

## Alcance
- Resultados de 107 estudiantes de 10° (Municipal: 10°1, 10°2, 10°3; San Sebastián del Bongo).
- 254 preguntas, con respuestas, claves, componentes y competencias aportados en las sábanas corregidas.
- Puntajes globales y cinco áreas del PDF consolidado. Se comprueba la fórmula 3–3–3–3–1 en todos los resultados.
- La nueva tarjeta «DIAGNÓSTICA 3E» se coloca antes de 2026-2S **solo** tras una respuesta autorizada del servidor para el usuario piloto.
- 2026-2S y 2026-1S siguen en la ruta de historial y **no se cambian** sus tablas, autorizaciones ni puntajes.

## Aislamiento
- Datos en `roque_private.diagnostica_3e_2026` y `roque_private.diagnostica_3e_2026_catalogo`; ambas tablas tienen RLS habilitado y acceso directo revocado.
- `public.roque_v23_diagnostica_3e_piloto(text,uuid)` aplica una lista de autorización privada y verifica una sesión reciente y un navegador no bloqueado.
- Esta prueba **no está registrada como una tercera fila** en `roque_private.ediciones` durante el piloto. Así no afecta la regla de bloqueo temporal de evaluaciones históricas ni la lógica de docentes.
- El cliente nunca guarda en GitHub notas personales o el documento permitido. La autorización efectiva solo existe en SQL.

## Publicación general posterior
No publicar ni ampliar permisos sin una instrucción expresa. Para un despliegue general se deberá incorporar la nueva prueba al catálogo de ediciones sin activar bloqueos erróneos de 2026-2S, adaptar los RPC de estadísticas/rankings institucionales y someter el flujo a pruebas de regresión. No reutilizar la escala lineal 20–100 de la prueba objetiva; esta diagnóstica usa las notas oficiales del informe.

## Validaciones
- 107 registros privados y 254 ítems.
- 0 diferencias entre puntajes globales oficiales y fórmula ponderada redondeada.
- La RPC niega otras cuentas, terminal nulo y navegadores sin sesión reciente.
- 2026-1S y 2026-2S mantienen sus conteos y hashes originales después de la carga.
