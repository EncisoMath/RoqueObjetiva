# Resultados por grado y sesión

Coloca aquí los resultados escaneados con este patrón:

- `6S1.json`, `6S2.json`
- `7S1.json`, `7S2.json`
- `8S1.json`, `8S2.json`
- `9S1.json`, `9S2.json`
- `10S1.json`, `10S2.json`

Cada archivo debe contener únicamente el `Roll No` y las respuestas:

```json
[
  {
    "Roll No": "2585",
    "Q 1 Options": "A",
    "Q 2 Options": "B"
  }
]
```

Por defecto, S1 empieza en el ítem 1 y S2 empieza en el ítem 71. Si algún grado cambia, ajusta `startItem` en `config/data-manifest.json`.
