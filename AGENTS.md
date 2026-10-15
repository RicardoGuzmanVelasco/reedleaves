# Reglas del proyecto

- Hablar con el usuario en español técnico simplificado: frases cortas, decisiones claras, sin verborrea.
- Antes de cambiar arte, UX, animaciones o interfaz, leer `docs/frontend/DESIGN.md`.
- Respetar siempre los tres pilares: simplicidad funcional, pomposidad estética y pocos casos de uso.
- Copy de interfaz: incluir solo texto funcional, necesario o ya aprobado. No inventar slogans, frases promocionales ni texto decorativo de relleno. Ejemplo: «Entrar / Sign in» sí; «Tus libros, allá donde estés…» no.
- Mantener el carácter expresivo, amable y animado de las referencias Duolingo y Forest.
- La interfaz y las traducciones editoriales de libros tendrán español e inglés. El idioma original de libros y barajas es independiente. La plataforma sigue pendiente de decisión.
- Las exploraciones en `brand/` son propuestas; no convertirlas en decisiones aprobadas.
- El primer logo de tarjetas y estrella está descartado.
- Entorno Node: usar la versión de `.node-version`; al abrir un worktree nuevo, ejecutar `npm ci` si falta `node_modules` antes de iniciar la app o las pruebas.
- Verificación: antes de cerrar un hito o publicar cambios de código, ejecutar `npm test` completo con la versión de `.node-version` y exigir salida 0. El comando incluye el build. Las pruebas relacionadas sirven durante la iteración; no sustituyen la suite al cerrar. Un fallo previo no se considera aceptado: corregirlo o informar del bloqueo sin declarar la verificación completa.
- Pruebas: reutilizar `test-support/reader-state.mjs` para estados base de vistas. Comprobar contratos funcionales y accesibles en su contexto, sin fijar envoltorios, SVG o copy incidental. En migraciones, usar esquemas históricos inmutables de `server/fixtures/migrations/`; no construir versiones antiguas mediante reemplazos del SQL actual ni rebajar solo su número de versión.
- Pruebas de IA: usar proveedores simulados. No hacer llamadas reales a OpenAI para comprobar el autorrelleno salvo petición expresa del usuario; consumen su saldo.
- Cuando haga falta contexto de avances recientes o estado operativo, leer `docs/development/README.md` y la entrada más reciente del diario. El código y la configuración del repo son la fuente de verdad técnica.
- Render: usar el workspace **RGV** (`tea-db59i2nlk1mc73978ao0`) para los servicios de este proyecto. La base de producción está en Supabase, no como instancia PostgreSQL de Render.
- Git: trabajar en una rama del worktree y publicar los hitos terminados mediante PR a `main`. La publicación de la rama y la apertura del PR forman parte del cierre normal del trabajo solicitado; no requieren otra confirmación. No hacer push directo a `main`.
- Integración: la CI ejecuta la suite completa y, si pasa, integra automáticamente con squash los PR listos del propio repositorio. No integrar a mano ni saltarse checks con `--admin`. Si hay conflictos, la rama queda desactualizada o falla CI, corregirlo antes de integrar. Los PR en borrador y los procedentes de forks no se integran automáticamente.
- Tras integrar, GitHub elimina la rama remota; actualizar `main` local y borrar la rama temporal local. Acumular cambios relacionados y hacer commit al cerrar hitos grandes. Prima el pragmatismo; no exigir commits atómicos ni nombres estrictos. No versionar bases locales, copias, credenciales o secretos.
