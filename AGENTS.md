# Reglas del proyecto

- Hablar con el usuario en español técnico simplificado: frases cortas, decisiones claras, sin verborrea.
- Antes de cambiar arte, UX, animaciones o interfaz, leer `docs/frontend/DESIGN.md`.
- Respetar siempre los tres pilares: simplicidad funcional, pomposidad estética y pocos casos de uso.
- Copy de interfaz: incluir solo texto funcional, necesario o ya aprobado. No inventar slogans, frases promocionales ni texto decorativo de relleno. Ejemplo: «Entrar / Sign in» sí; «Tus libros, allá donde estés…» no.
- Mantener el carácter expresivo, amable y animado de las referencias Duolingo y Forest.
- La interfaz tendrá español, inglés y francés. El idioma de las barajas es independiente. La plataforma sigue pendiente de decisión.
- Las exploraciones en `brand/` son propuestas; no convertirlas en decisiones aprobadas.
- El primer logo de tarjetas y estrella está descartado.
- Entorno Node: usar la versión de `.node-version`; al abrir un worktree nuevo, ejecutar `npm ci` si falta `node_modules` antes de iniciar la app o las pruebas.
- Cuando haga falta contexto de avances recientes o estado operativo, leer `docs/development/README.md` y la entrada más reciente del diario. El código y la configuración del repo son la fuente de verdad técnica.
- Git: usar `main` como destino por defecto; no publicar ramas salvo petición explícita. Tras integrar cambios, borrar la rama temporal local y remota. Acumular cambios relacionados y hacer commit al cerrar hitos grandes. Prima el pragmatismo; no exigir commits atómicos ni nombres estrictos. No versionar bases locales, copias, credenciales o secretos.
