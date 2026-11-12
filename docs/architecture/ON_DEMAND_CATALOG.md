# Catálogo bajo demanda

Estado: propuesta de arquitectura. No hay decisión aprobada sobre el orden de las capas ni sobre los endpoints. El código y sus pruebas son la referencia vigente.

Vocabulario: Librería = catálogo global; Biblioteca = colección personal; Estantería = libros de la Biblioteca; Tarjetero = barajas de la Biblioteca.

## Problema

El cliente descarga el catálogo completo (libros, barajas, tarjetas, traducciones, intereses) y lo trata como su base de datos local. El coste crece con el contenido, no con lo que el lector mira.

Dónde se paga hoy:

1. **Carga completa.** `GET /api/catalog` devuelve todo. `readCatalog` ya usa un número fijo de consultas (b903536), pero el payload, la serialización y `prepareCatalog` (validación y mapas en memoria) siguen creciendo con el catálogo.
2. **Sincronización.** `sync()` corre cada 30 s con la app visible, y también al volver el foco, cambiar la visibilidad o recuperar la red. Descarga `/api/reader/state` y el catálogo entero y compara con `JSON.stringify`. Es el coste más repetido.
3. **Mutaciones.** Casi todas terminan con `loadCatalog()` completo (guía, título, idioma, colaboradores, nota, baraja nueva) y `409` también.
4. **Práctica.** Las cinco tarjetas las elige el servidor (`startPracticeSession`, `availableCards`; `practiceDeckIds` recorre todas las barajas). El cliente las resuelve con `catalog.cardsById` en `restorePracticeSession`, y `cardMarkup`/`cardAttribution` necesitan libro, baraja (`decksById`, `isReadingGuideDeck`) y creador. Por eso la práctica exige el catálogo completo.

## Ya resuelto

- Home, Perfil y `#practice` (elección de modo) abren sin catálogo completo (`opensWithoutFullCatalog`). Home usa `/api/reader/home-books`. `#practice` precarga `ensureFullCatalog()` en segundo plano; elegir modo sin catálogo espera con el Brote dormido.
- `readProfile` ya no carga catálogo ni Estantería. La Biblioteca ajena pide `GET /api/profiles/:id/bookshelf` aparte.
- Los idiomas de tarjeta son fijos (`CONTENT_LANGUAGES`; `availableLanguages()`), sin recorrer barajas.
- Feedback de espera unificado: navegar y esperar → Brote dormido; esperar con la pantalla ya lista → `lockControls(verb)`. Ver `docs/frontend/LOADING_FEEDBACK_GAPS.md`.

## Modelo propuesto

- **Tarjeta autosuficiente.** La respuesta lleva id, texto y un resumen ya hecho de libro, autor, baraja y creador. Pintarla no necesita el resto del catálogo.
- **Detalle bajo demanda.** Libro, baraja y autor se piden al seguir un enlace; con la estrategia unificada, navegar espera con el Brote dormido.
- **Listados paginados y con búsqueda.** La Librería deja de recibirse entera: páginas, filtros por interés y búsqueda por texto en servidor.
- **Caché local por id.** `catalog` deja de ser «todo el catálogo» y pasa a ser un mapa de lo ya visto (`booksById`, `decksById`, `cardsById`). Las vistas piden lo que falta.
- **Sincronización por cambios.** Sustituir la descarga con `JSON.stringify` por una señal barata (versión del catálogo/etag, o `updatedAt` desde un cursor) y refrescar solo lo afectado.

## Capas (de más a menos dolor)

1. **Sincronización barata.** Versión/etag del catálogo en `/api/reader/state` o endpoint mínimo; si no cambió, no descargar nada. Quita el coste repetido sin cambiar el modelo.
2. **Práctica autosuficiente** (la «parte 4» diferida). `practice/start` devuelve las cinco tarjetas con sus libros y barajas resumidos; la práctica deja de exigir catálogo completo. La animación paralela a `practice/start` («parte 2») encaja aquí.
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
