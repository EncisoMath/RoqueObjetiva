# Resultados de Pruebas Objetivas

Aplicación web estática para consultar resultados de pruebas objetivas desde GitHub Pages.

## Credenciales

- Administrador: `admin` / `admin`
- Estudiantes: ingresan con el ID del examen o con el documento registrado en `ESTUDIANTES.csv`
- Docentes: ingresan con el ID registrado en `INTERNO/CARGA.csv`

## Carpetas de datos

```text
KEYS/
  ANSWER_10.csv

RESULTADOS/
  10S1.csv
  10S2.csv

ESTUDIANTES/
  ESTUDIANTES.csv

INTERNO/
  CARGA.csv

config/
  data-manifest.json
```

## Cómo se calcula la nota

La aplicación compara cada respuesta marcada contra la clave de `ANSWER_10.csv`.

La nota se calcula en escala de 20 a 100:

```text
nota = 20 + (correctas / total_de_preguntas) * 80
```

También clasifica las respuestas así:

- Verde: correcta
- Rojo: incorrecta
- Amarillo: doble marca
- Azul: sin marcar

## Sesiones

En el ejemplo incluido:

- `10S1.csv`: ítems 1 a 70
- `10S2.csv`: ítems 71 a 125, aunque EvaluBee los exporte internamente como Q1, Q2, Q3...

Esa equivalencia está definida en `config/data-manifest.json`:

```json
{
  "resultados": [
    { "grade": 10, "session": 1, "startItem": 1, "path": "RESULTADOS/10S1.csv" },
    { "grade": 10, "session": 2, "startItem": 71, "path": "RESULTADOS/10S2.csv" }
  ]
}
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube todo el contenido de esta carpeta al repositorio.
3. Entra a `Settings > Pages`.
4. En `Build and deployment`, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda los cambios.
6. GitHub generará una URL parecida a:

```text
https://tuusuario.github.io/nombre-del-repositorio/
```

## Agregar otro grado

1. Agrega la clave en `KEYS`, por ejemplo:

```text
KEYS/ANSWER_9.csv
```

2. Agrega los resultados en `RESULTADOS`, por ejemplo:

```text
RESULTADOS/9S1.csv
RESULTADOS/9S2.csv
```

3. Edita `config/data-manifest.json` y agrega las rutas:

```json
{
  "keys": [
    { "grade": 10, "path": "KEYS/ANSWER_10.csv" },
    { "grade": 9, "path": "KEYS/ANSWER_9.csv" }
  ],
  "resultados": [
    { "grade": 10, "session": 1, "startItem": 1, "path": "RESULTADOS/10S1.csv" },
    { "grade": 10, "session": 2, "startItem": 71, "path": "RESULTADOS/10S2.csv" },
    { "grade": 9, "session": 1, "startItem": 1, "path": "RESULTADOS/9S1.csv" },
    { "grade": 9, "session": 2, "startItem": 71, "path": "RESULTADOS/9S2.csv" }
  ]
}
```

## Sobre el panel administrador

El panel permite:

- Cambiar banner, logo, textos y color principal.
- Subir logos por asignatura.
- Editar cargas docentes.
- Editar claves de respuesta.
- Ver todos los exámenes.

Como GitHub Pages no tiene base de datos ni servidor, los cambios hechos en el panel se guardan en el navegador mediante `localStorage`.

Para que los cambios queden publicados para todos:

1. Exporta el CSV o JSON desde el panel.
2. Reemplaza el archivo correspondiente en el repositorio.
3. Haz commit en GitHub.

## Advertencia importante de privacidad

GitHub Pages público no es un sistema seguro para publicar información sensible de estudiantes. Esta versión sirve como prototipo estático o para repositorios privados/controlados.

Para uso institucional real con datos personales, conviene montar autenticación y base de datos con una solución como Firebase, Supabase, un backend propio o GitHub Pages con datos anonimizados.

## Cambios de diseño v2

- En celular el banner superior queda más compacto.
- Se retiraron los percentiles, la barra de desempeño, el texto de habilidades y el botón de imprimir.
- En celular las asignaturas aparecen en cascada. Al tocar una asignatura, el detalle se abre dentro de la misma página.
- En escritorio las asignaturas quedan a la izquierda y el detalle de la prueba a la derecha.
- Las opciones marcadas muestran solo el ítem y la opción marcada. No se muestra la respuesta correcta en el reporte.
- Debajo de las opciones se calculan barras por componente y por competencia usando las columnas de `ANSWER_10.csv`.
- Los botones usan borde rectangular configurable desde el panel admin, por defecto `4px`.
- La carpeta `ICONOS` contiene los logos base de las asignaturas. Puedes reemplazarlos por tus propios archivos.

### Logos de asignaturas

La aplicación carga por defecto estos archivos desde `ICONOS`:

- `ICONOS/matematicas.svg`
- `ICONOS/lenguaje.svg`
- `ICONOS/ciencias-naturales.svg`
- `ICONOS/ingles.svg`
- `ICONOS/ciencias-sociales.svg`
- `ICONOS/etica.svg`
- `ICONOS/artistica.svg`
- `ICONOS/educacion-fisica.svg`
- `ICONOS/informatica.svg`
- `ICONOS/religion.svg`

El panel admin permite subir logos, pero en GitHub Pages esos cambios quedan guardados en el navegador. Para que todos los usuarios vean los mismos logos, reemplaza los archivos de la carpeta `ICONOS` y vuelve a subir el repositorio.
