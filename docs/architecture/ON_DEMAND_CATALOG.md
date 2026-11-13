# Catálogo bajo demanda

Estado: en curso. Las capas 1 y 2 están hechas (ver «Ya resuelto»); las demás siguen como propuesta. El código y sus pruebas son la referencia vigente.

Vocabulario: Librería = catálogo global; Biblioteca = colección personal; Estantería = libros de la Biblioteca; Tarjetero = barajas de la Biblioteca.

## Problema

El cliente descarga el catálogo completo (libros, barajas, tarjetas, traducciones, intereses) y lo trata como su base de datos local. El coste crece con el contenido, no con lo que el lector mira.

Dónde se paga hoy:

1. **Carga completa.** `GET /api/catalog` devuelve todo. `readCatalog` ya usa un número fijo de consultas (b903536), pero el payload, la serialización y `prepareCatalog` (validación y mapas en memoria) siguen creciendo con el catálogo.
2. **Sincronización.** `sync()` corre cada 30 s con la app visible, y también al volver el foco, cambiar la visibilidad o recuperar la red. Descarga `/api/reader/state` y el catálogo entero y compara con `JSON.stringify`. Es el coste más repetido.
3. **Mutaciones.** Casi todas terminan con `loadCatalog()` completo (guía, título, idioma, colaboradores, nota, baraja nueva) y `409` también.
4. **Práctica.** Las cinco tarjetas las elige el servidor (`startPracticeSession`, `availableCards`; `practiceDeckIds` recorre todas las barajas). El cliente las resuelve con `catalog.cardsById` en `restorePracticeSession`, y `cardMarkup`/`cardAttribution` necesitan libro, baraja (`decksById`, `isReadingGuideDeck`) y creador. Por eso la práctica exige el catálogo completo.

## Ya resuelto

- Home, Perfil y `#practice` (elección de modo) abren sin catálogo completo (`opensWithoutFullCatalog`). Home usa `/api/reader/home-books`. `#practice` ya no precarga el catálogo (ver capa 2).
- `readProfile` ya no carga catálogo ni Estantería. La Biblioteca ajena pide `GET /api/profiles/:id/bookshelf` aparte.
- Los idiomas de tarjeta son fijos (`CONTENT_LANGUAGES`; `availableLanguages()`), sin recorrer barajas.
- **Sincronización barata (capa 1, parcial).** `GET /api/catalog` lleva ETag y responde 304 si no cambió (petición condicional con `If-None-Match`). El cliente reutiliza el catálogo ya procesado cuando el texto no cambia, y `sync()` se salta la comparación con `JSON.stringify`. El servidor sigue consultando la base de datos en cada petición; ahorrarlo exigiría un contador de revisión del catálogo.
- **Tarjeta con contexto.** `readCardContexts` (server/catalog-repository.mjs) devuelve tarjetas con su libro y baraja, con las mismas formas y visibilidad que `readCatalog` (que no filtra por usuario salvo el motivo de rechazo de guías, solo para su creador). La baraja lleva `isReadingGuide` calculado en servidor. Una prueba compara cada tarjeta del seed con el catálogo.
  - `GET /api/cards/:id/context`: enlace compartido. La ruta `#card/…` pinta sin catálogo; al seguir un enlace de la atribución se carga el catálogo completo.
  - `GET /api/cards/context?ids=`: lote (máx. 20), para retomar una sesión de práctica.
  - `practice/start` incluye `context` con las tarjetas de la sesión.
- **Práctica sin catálogo completo (capa 2).** Empezar, responder y retomar tras recargar usan un catálogo parcial (`practiceCatalog`). `#practice/*` abre sin catálogo; al retomar pide `/api/reader/state` (Home no lo trae) y el lote de tarjetas. El selector de modos ya no precarga el catálogo.
- **Comprobado en producción** (2026-11-12): tarjeta compartida sin sesión, seguir un enlace de la atribución, revalidación con 304 del catálogo y repaso completo (empezar, responder, retomar tras recargar). Dos lecciones: Cloudflare vuelve débil el ETag (`W/"…"`), así que `If-None-Match` se compara sin el prefijo `W/`; y las consultas de `readCardContexts` corren en PostgreSQL con columnas enteras (`is_reading_guide=1`, no un booleano), algo que las pruebas HTTP en SQLite no detectan. Pendiente: prueba de esas consultas contra PostgreSQL.
- Feedback de espera unificado: navegar y esperar → Brote dormido; esperar con la pantalla ya lista → `lockControls(verb)`. Estrategia del Brote (`app/pending-feedback.mjs`): espera lenta → Brote al instante; espera rápida → Brote solo tras 300 ms, y mientras tanto se mantiene la pantalla actual. Ver `docs/frontend/LOADING_FEEDBACK_GAPS.md`.

## Modelo propuesto

- **Tarjeta autosuficiente.** La respuesta lleva id, texto y un resumen ya hecho de libro, autor, baraja y creador. Pintarla no necesita el resto del catálogo.
- **Detalle bajo demanda.** Libro, baraja y autor se piden al seguir un enlace; con la estrategia unificada, navegar espera con el Brote dormido.
- **Listados paginados y con búsqueda.** La Librería deja de recibirse entera: páginas, filtros por interés y búsqueda por texto en servidor.
- **Caché local por id.** `catalog` deja de ser «todo el catálogo» y pasa a ser un mapa de lo ya visto (`booksById`, `decksById`, `cardsById`). Las vistas piden lo que falta.
- **Sincronización por cambios.** Sustituir la descarga con `JSON.stringify` por una señal barata (versión del catálogo/etag, o `updatedAt` desde un cursor) y refrescar solo lo afectado.

## Revisión independiente (resumen)

Un agente sin contexto previo valoró la idea «tarjeta con contexto siempre»:
- Es una práctica habitual (modelo de vista desnormalizado, `resource embedding`) y el repo ya la usa en `home-books`.
- Conviene acotarla a vistas de **una** tarjeta o un lote pequeño. En pantallas con muchas tarjetas del mismo libro o baraja (baraja, Tarjetero, guías) repetiría libro, baraja y creador por tarjeta.
- Riesgos: catálogo parcial como tercer estado de `catalog`/`catalogIsFull`, validación distinta a `prepareCatalog`, reconciliar con el catálogo completo cuando llegue, peor experiencia sin conexión.
- Alternativa más general: índice ligero (libros, barajas, creadores, sin textos de tarjetas) más tarjetas por baraja. Resuelve el peso para todas las pantallas sin un segundo formato; decidir tras medir lo ya hecho.

## Capas (de más a menos dolor)

1. **Sincronización barata.** *Hecha en parte:* ETag y 304. Pendiente: contador de revisión del catálogo para que el servidor tampoco trabaje cuando no hay cambios (migración SQLite y PostgreSQL; todo punto de escritura, MCP incluido, debe incrementarlo).
2. **Práctica autosuficiente.** *Hecha* (la «parte 4»). Pendiente la «parte 2»: animación en paralelo a `practice/start`.
3. **Detalle por id.** `GET` de libro y de baraja (con tarjetas). Las vistas de detalle usan la caché y piden lo que falte. Las mutaciones refrescan solo su objeto.
4. **Listados paginados.** Librería con páginas/búsqueda/intereses en servidor; Biblioteca con sus propios endpoints.
5. **Retirar `/api/catalog` completo** y `prepareCatalog` global; la validación pasa a cada respuesta.

Cada capa se entrega por separado y deja la app funcionando.

## Riesgos y decisiones abiertas

- **Validación.** `prepareCatalog` valida invariantes globales (orden consecutivo, referencias, dimensiones de baraja, baraja diaria por libro). Con carga parcial hay que decidir qué valida el servidor y qué el cliente.
- **Coherencia entre objetos.** Una caché por id puede mezclar versiones. Conviene que cada respuesta lleve versión y que la sincronización invalide por id.
- **Sin conexión.** Hoy el catálogo completo permite navegar ya cargado. Con carga bajo demanda, cada navegación nueva puede fallar sin red: usar el estado «No hay conexión con el servidor» (Brote triste).
- **Búsqueda.** Decidir si el filtrado de la Librería (hoy local) pasa a servidor desde la capa 4.
- **Enlaces profundos.** Una URL a un libro/baraja debe cargar su detalle sin catálogo previo (Brote dormido al navegar).
- **Pruebas.** Mantener los contratos de `/api/catalog` mientras exista; añadir pruebas por endpoint nuevo con `test-support/reader-state.mjs`.

## No incluido

Cambios de nombres en código, animaciones del Brote y copys de interfaz.
