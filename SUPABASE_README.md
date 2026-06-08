# Roque Objetiva v107 - modo Supabase

Esta version ya no debe publicar datos confidenciales en JSON publicos. Los JSON de ESTUDIANTES, INTERNO, KEYS y RESULTADOS quedan vacios en esta copia.

Antes de subir esta version a GitHub Pages:

1. Ejecuta `01_schema.sql` en Supabase.
2. Ejecuta `02_seed_data.sql` en Supabase.
3. Verifica que `config/supabase-config.js` tenga tu URL y publishable key.
4. Sube esta carpeta a GitHub.

URL configurada:

```text
https://wkbczbjexnwbmyscrhah.supabase.co
```

No subas el paquete privado de SQL al repositorio publico.
