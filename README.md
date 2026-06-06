# Resultados de Pruebas Objetivas

Aplicación web estática para consultar resultados de pruebas objetivas desde GitHub Pages.

## Credenciales

- Administrador: `admin` / `admin`
- Estudiantes: ingresan con el ID de prueba o con el documento registrado en `ESTUDIANTES/ESTUDIANTES.json`.
- Docentes: ingresan con el ID registrado en `INTERNO/CARGA.json`.

## Estructura de datos JSON multigrado

```text
config/
  data-manifest.json      ← define grados, rutas y sesiones
  site-config.json

KEYS/
  KEYS_6.json
  KEYS_7.json
  KEYS_8.json
  KEYS_9.json
  KEYS_10.json

RESULTADOS/
  6S1.json
  6S2.json
  7S1.json
  7S2.json
  8S1.json
  8S2.json
  9S1.json
  9S2.json
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

La aplicación ya no está amarrada solo al grado 10. Cuando un estudiante inicia sesión, el sistema toma su `GRADO` desde `ESTUDIANTES/ESTUDIANTES.json` y carga automáticamente:

```text
KEYS/KEYS_<GRADO>.json
RESULTADOS/<GRADO>S1.json
RESULTADOS/<GRADO>S2.json
```

Los archivos de grados que todavía no existan no bloquean la carga. Simplemente se activan cuando los subas al repositorio.

## Cómo se calcula cada nota de asignatura

La aplicación compara cada respuesta marcada contra la clave del grado correspondiente, por ejemplo `KEYS/KEYS_6.json`, `KEYS/KEYS_7.json` o `KEYS/KEYS_10.json`.

```text
nota = 20 + (correctas / total_de_preguntas) * 80
```

Los estados visuales son:

- Verde: correcta
- Rojo: incorrecta
- Amarillo: doble marca
- Azul: sin marcar

## Puntaje global tipo Saber

El puntaje global se calcula únicamente con Matemáticas, Lenguaje, Ciencias Naturales, Ciencias Sociales e Inglés:

```text
(((Matemáticas x 3) + (Lenguaje x 3) + (Naturales x 3) + (Sociales x 3) + (Inglés x 1)) x 5) / 13
```

Ética, Artística, Educación Física, Informática y Religión no cuentan en este cálculo tipo Saber.

## Publicar cambios desde el panel admin

El panel admin permite cambiar:

- color principal;
- textos del encabezado;
- logo principal;
- banner;
- logos por asignatura;
- cargas docentes;
- claves de respuesta.

Para que esos cambios queden visibles para todos los usuarios, entra a:

```text
Admin → GitHub → Publicar cambios en GitHub
```

Debes proporcionar:

- usuario o dueño del repositorio;
- nombre del repositorio;
- rama, normalmente `main`;
- token de GitHub con permiso de escritura sobre ese repositorio.

La aplicación publicará mediante commit los cambios en:

```text
config/site-config.json
config/data-manifest.json
ESTUDIANTES/ESTUDIANTES.json
INTERNO/CARGA.json
KEYS/KEYS_#.json
ICONOS/
assets/
```

No escribas el token dentro del código del sitio. Úsalo solo desde la pantalla admin.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube todo el contenido de esta carpeta al repositorio.
3. Entra a `Settings > Pages`.
4. En `Build and deployment`, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda los cambios.

GitHub generará una URL parecida a:

```text
https://tuusuario.github.io/nombre-del-repositorio/
```

## Agregar otro grado

La forma recomendada es editar `config/data-manifest.json` y agregar el grado dentro de `grades`:

```json
{
  "grades": [6, 7, 8, 9, 10, 11]
}
```

Después sube los archivos correspondientes:

```text
KEYS/KEYS_11.json
RESULTADOS/11S1.json
RESULTADOS/11S2.json
```

Por defecto, el sistema asume:

```text
S1: Q 1 Options → ítem 1
S2: Q 1 Options → ítem 71
```

Si un grado usa otra distribución, cambia `sessions` en `config/data-manifest.json`:

```json
{
  "sessions": [
    { "session": 1, "startItem": 1 },
    { "session": 2, "startItem": 71 }
  ]
}
```

## Advertencia de privacidad

GitHub Pages público no es un sistema seguro para publicar información sensible de estudiantes. Esta versión sirve como prototipo estático, repositorio privado/controlado o datos anonimizados. Para uso institucional real con datos personales, conviene usar autenticación y base de datos con un backend, Firebase o Supabase.


## v10

- El puntaje global vuelve a mostrarse como x/500.
- Se ajusto el espaciado visual de los digitos del puntaje global para que no se vean tan apinados.


## Configuracion predeterminada

El color institucional predeterminado es `#314b9b` y el logo principal predeterminado se lee desde `assets/logo-principal.png`.

## Nota v13

- El color base predeterminado sigue siendo `#314b9b`.
- El logo principal predeterminado sigue apuntando a `assets/logo-principal.png`, pero este paquete no lo incluye para no reemplazar tu logo institucional. Debes conservar o subir tu propio archivo con ese nombre en la carpeta `assets/`.
- El banner ahora usa un degradado oscuro: color principal hacia una versión más oscura del mismo color.


## Cambios v15

- Aumenta el espacio superior del detalle de estudiante en la vista docente.
- Evita que los encabezados de la tabla de respuestas correctas atraviesen el título del modal al hacer scroll.
- Mejora la visibilidad de rankings 1, 2 y 3 con números más grandes, glow y más estrellas animadas.


## Cambios v18

- La aplicación queda preparada para trabajar con varios grados: 6, 7, 8, 9 y 10.
- `config/data-manifest.json` ahora usa plantillas: `KEYS/KEYS_{grade}.json` y `RESULTADOS/{grade}S{session}.json`.
- Los archivos de grados faltantes son opcionales: no dañan la carga de grado 10.
- Para agregar nuevos grados, basta con añadirlos en `grades` y subir sus claves/resultados.
- Los cálculos de estudiante, docente y admin usan la clave del grado correspondiente a cada estudiante.


## Cambios v19

- Banner sin manchas/círculos laterales ni imagen de fondo aplicada por defecto.
- Fondo del banner: color principal seleccionado con degradado oscuro hacia la derecha.
- Figuras decorativas del banner más grandes, visibles y numerosas.


## v21

- Se retiró el interruptor de modo claro/oscuro.
- La pantalla de inicio conserva el estilo oscuro animado.
- Las vistas de estudiante, docente y admin quedan fijas en modo claro.
