# v175.3 — Navegación estudiantil sin doble cargador

Fecha: 2026-11-01. Alcance: `main`, interfaz JavaScript y PWA.

- La autenticación sí espera una consulta real a Supabase. Durante esa operación, el mensaje es neutral: "Consultando resultados".
- Se retiraron los mensajes aleatorios de aparente carga ("Invocando al espíritu del ICFES", etc.).
- Al entrar a los resultados de 2026-2S y 2026-1S para 2573, no se muestra el segundo `route-loader` con espera artificial de 620 ms: se ejecuta una breve disolvencia visual sin superponer cargadores.
- La cascada escalonada de tarjetas permanece en `css/student-dashboard.css` (v175.1), compatible con `prefers-reduced-motion`.
- Desde Historial, el botón del dock "2026-1S / Detalle" ahora abre estrictamente `state.studentSelectedEdition`, no el valor fijo 2026-2S que antes venía del modo de prueba.
- No se alteran la base de datos, las claves, los resultados, ni el control temporal de acceso.

Pruebas recomendadas en el sitio: iniciar sesión con 2573, cambiar a 2026-1S, abrir Historial, pulsar "2026-1S / Detalle" y confirmar el mismo semestre; después cambiar a 2026-2S y confirmar ceros y retorno coherente. Revisar móvil y escritorio, también después de refrescar PWA.
