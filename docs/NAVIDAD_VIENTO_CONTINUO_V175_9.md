# v175.9 — Viento continuo, sin pausas ni cambios bruscos

- El desplazamiento principal es siempre diagonal y **lineal en el tiempo**, desde fuera de la parte superior hasta fuera de la parte inferior del hero; nunca frena para cambiar de dirección.
- Una segunda animación, independiente y superpuesta al emoji, aporta un vaivén lateral/rotación sutil sin afectar la velocidad de caída.
- Cada partícula conserva su propia duración, desfase, velocidad y dirección de viento. Las figuras siguen midiendo entre 29 y 45 px.
- La animación queda recortada estrictamente dentro del hero y respeta `prefers-reduced-motion`.
- Durante Navidad (1/nov–6/ene, America/Bogota), los banners normales usan figuras navideñas; las **estrellas de oro, plata y bronce siempre tienen prioridad** y mantienen su animación.
- Fuera de temporada se recuperan las figuras geométricas originales.
- Sin modificaciones en Supabase, notas, dock ni ranking.
