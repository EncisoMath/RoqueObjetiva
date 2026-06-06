# Claves por grado

Coloca aquí las claves de cada grado con este patrón:

- `KEYS_6.json`
- `KEYS_7.json`
- `KEYS_8.json`
- `KEYS_9.json`
- `KEYS_10.json`

La estructura debe ser igual a la de `KEYS_10.json`:

```json
[
  {
    "Área": "Matemáticas",
    "Número de ítem": "1",
    "Respuesta sugerida": "C",
    "Componente / pensamiento / entorno / factor / enfoque": "Pensamiento aleatorio y sistemas de datos",
    "Competencia": "Comunicación, representación y modelación"
  }
]
```

Para agregar otro grado, añade el número en `config/data-manifest.json` dentro de `grades`.
