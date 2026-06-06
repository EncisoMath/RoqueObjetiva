# Resultados de Pruebas Objetivas

Aplicación web estática para consultar resultados de pruebas objetivas desde GitHub Pages.

## Credenciales

- Administrador: `admin` / `admin`
- Estudiantes: ingresan con el ID de prueba o con el documento registrado en `ESTUDIANTES/ESTUDIANTES.json`.
- Docentes: ingresan con el ID registrado en `INTERNO/CARGA.json`.

## Estructura de datos JSON

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

## Cómo se calcula cada nota de asignatura

La aplicación compara cada respuesta marcada contra la clave de `KEYS/KEYS_10.json`.

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
INTERNO/CARGA.json
KEYS/KEYS_10.json
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

1. Agrega la clave en `KEYS`, por ejemplo:

```text
KEYS/KEYS_9.json
```

2. Agrega los resultados en `RESULTADOS`, por ejemplo:

```text
RESULTADOS/9S1.json
RESULTADOS/9S2.json
```

3. Edita `config/data-manifest.json` y agrega las rutas:

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
