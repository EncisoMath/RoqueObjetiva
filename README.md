# Resultados de Pruebas Objetivas - versión JSON

Aplicación estática para GitHub Pages orientada a consulta de resultados por estudiante, docente y administrador.

## Estructura de datos

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

## Accesos

- Administrador: usuario `admin`, contraseña `admin`.
- Estudiante: ID de prueba o ID de alumno, según `ESTUDIANTES/ESTUDIANTES.json`.
- Docente: ID del docente, según `INTERNO/CARGA.json`.

## Archivos JSON principales

### `KEYS/KEYS_10.json`
Contiene la clave de respuestas por ítem, área, componente y competencia.

Campos esperados:

```json
{
  "Área": "Matemáticas",
  "Número de ítem": "1",
  "Respuesta sugerida": "C",
  "Componente / pensamiento / entorno / factor / enfoque": "Pensamiento aleatorio y sistemas de datos",
  "Competencia": "Comunicación, representación y modelación"
}
```

### `RESULTADOS/10S1.json` y `RESULTADOS/10S2.json`
Contienen solo el ID del examen y las opciones marcadas.

```json
{
  "Roll No": "2585",
  "Q 1 Options": "A",
  "Q 2 Options": "B"
}
```

`10S1.json` inicia en el ítem global 1.  
`10S2.json` inicia en el ítem global 71.

### `ESTUDIANTES/ESTUDIANTES.json`

```json
{
  "ID_PRUEBA": "2585",
  "ID_ALUMNO": "1085109557",
  "APELLIDOS": "Berrio Díaz",
  "NOMBRES": "Jaime Luis",
  "SEDE": "Municipal",
  "GRADO": "10",
  "GRUPO": "2PPAL"
}
```

### `INTERNO/CARGA.json`

```json
{
  "ID": "36720104",
  "NOMBRE": "MONICA PATRICIA ALVAREZ DE LA ROSA",
  "ASIGNATURA": "Ingles",
  "SEDE": "Principal",
  "GRADO": "10",
  "CURSO": "2PPAL"
}
```

## Configuración visual

La configuración base está en:

```text
config/site-config.json
```

Desde el panel admin puedes cambiar color principal, textos, logo, banner, borde de botones y logos por asignatura. Los cambios hechos desde el navegador quedan guardados localmente. Para publicarlos para todos, exporta el JSON correspondiente y súbelo al repositorio.

## Publicación en GitHub Pages

1. Sube todos los archivos del proyecto al repositorio.
2. En GitHub, entra a `Settings -> Pages`.
3. Selecciona `Deploy from a branch`.
4. Rama: `main`.
5. Carpeta: `/root`.
6. Guarda y espera la URL generada.

## Nota de seguridad

GitHub Pages publica archivos estáticos. Si el repositorio es público, los JSON también serán accesibles. Para datos reales sensibles, conviene usar autenticación y base de datos externa.
