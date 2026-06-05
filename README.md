# Resultados de Pruebas Objetivas

Aplicación web estática para consultar resultados de pruebas objetivas desde GitHub Pages.

## Credenciales

- Administrador: `admin` / `admin`
- Estudiantes: ingresan con el ID del examen o con el documento registrado en `ESTUDIANTES/ESTUDIANTES.json`.
- Docentes: ingresan con el ID registrado en `INTERNO/CARGA.json`.

## Carpetas de datos

```text
config/
  data-manifest.json
  site-config.json

KEYS/
  KEYS_10.json

RESULTADOS/
  10S1.json
  10S2.json

ESTUDIANTES/
  ESTUDIANTES.json

INTERNO/
  CARGA.json

ICONOS/
  matematicas.svg
  lenguaje.svg
  ciencias-naturales.svg
  ingles.svg
  ciencias-sociales.svg
  etica.svg
  artistica.svg
  educacion-fisica.svg
  informatica.svg
  religion.svg
```

## Formato de resultados

Los archivos de resultados solo necesitan el ID de prueba y las opciones marcadas:

```json
[
  {
    "Roll No": "2585",
    "Q 1 Options": "A",
    "Q 2 Options": "B"
  }
]
```

La aplicación cruza `Roll No` con `ID_PRUEBA` en `ESTUDIANTES.json`.

## Cómo se calcula la nota por asignatura

La aplicación compara cada respuesta marcada contra la clave de `KEYS/KEYS_10.json`.

```text
nota = 20 + (correctas / total_de_preguntas) * 80
```

Estados de respuesta:

- Verde: correcta
- Rojo: incorrecta
- Amarillo: doble marca
- Azul: sin marcar

## Puntaje global tipo Saber

El puntaje global mostrado al estudiante usa esta fórmula:

```text
(((Matemáticas × 3) + (Lenguaje × 3) + (Ciencias Naturales × 3) + (Ciencias Sociales × 3) + (Inglés × 1)) × 5) / 13
```

Ética, Artística, Educación Física, Informática y Religión no cuentan dentro de este cálculo tipo Saber.

## Sesiones

En el ejemplo incluido:

- `10S1.json`: ítems 1 a 70.
- `10S2.json`: ítems 71 a 125, aunque EvalBee los exporte internamente como Q1, Q2, Q3...

Esa equivalencia está definida en `config/data-manifest.json`.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube todo el contenido de esta carpeta al repositorio.
3. Entra a `Settings > Pages`.
4. En `Build and deployment`, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda los cambios.

## Agregar otro grado

Agrega los archivos JSON correspondientes y actualiza `config/data-manifest.json`:

```json
{
  "keys": [
    { "grade": 10, "path": "KEYS/KEYS_10.json" },
    { "grade": 9, "path": "KEYS/KEYS_9.json" }
  ],
  "resultados": [
    { "grade": 10, "session": 1, "startItem": 1, "path": "RESULTADOS/10S1.json" },
    { "grade": 10, "session": 2, "startItem": 71, "path": "RESULTADOS/10S2.json" },
    { "grade": 9, "session": 1, "startItem": 1, "path": "RESULTADOS/9S1.json" },
    { "grade": 9, "session": 2, "startItem": 71, "path": "RESULTADOS/9S2.json" }
  ]
}
```

## Sobre el panel administrador

El panel permite:

- Cambiar banner, logo, textos, color principal y borde de botones.
- Subir logos por asignatura.
- Editar cargas docentes.
- Editar claves de respuesta.
- Ver todos los exámenes.

Como GitHub Pages no tiene base de datos ni servidor, los cambios hechos en el panel se guardan en el navegador mediante `localStorage`.

Para que los cambios queden publicados para todos:

1. Exporta el JSON desde el panel.
2. Reemplaza el archivo correspondiente en el repositorio.
3. Haz commit en GitHub.

## Cambios v6

- Transición más suave al abrir, cerrar o cambiar el detalle de una asignatura en la vista estudiante.
- Las barras de componentes y competencias usan el color principal configurado en admin y una variante más clara.
- El puntaje global ahora se calcula como estimación tipo Saber con la ponderación solicitada.
- El estudiante puede tocar el puntaje global para ver la fórmula aplicada con sus valores.
- En la vista docente las cargas quedan como pestañas visibles, sin scroll horizontal.
- La tabla docente incluye índice, nombre, ID de prueba, nota y correctas.
- La vista docente muestra promedio agregado por componentes y competencias.
- El docente puede abrir la clave de respuestas correctas de la asignatura activa.

## Advertencia de privacidad

GitHub Pages público no es un sistema seguro para publicar información sensible de estudiantes. Esta versión sirve como prototipo estático o para repositorios privados/controlados.

Para uso institucional real con datos personales, conviene montar autenticación y base de datos con Firebase, Supabase, un backend propio o datos anonimizados.
