# Catálogo y barajas: base real de desarrollo

Contenido CSV → importación validada → SQLite local / PostgreSQL producción → repositorio SQL → API.
No se simula la base mediante JSON. JSON solo transporta la respuesta HTTP.

## Modelo actual

- Libro: autor, título original e idioma original propios, títulos localizados e intereses. No contiene un único árbol.
- Los libros creados por cuentas se incorporan directamente al catálogo común, incluidos los ya guardados. Se conserva `creator_user_id` para atribución y para completar metadatos; no controla visibilidad. Todas las cuentas pueden registrar su lectura y crear su propia baraja sobre ellos. Fichas mínimas sin traducciones, intereses, enlaces o barajas visibles son válidas. Ver [ADR 0001](../adr/0001-libros-en-catalogo-comun.md): la gestión de privacidad de libros queda pospuesta.
- Enlace de libro: plataforma y URL de su ficha, en `book_links`; único por libro y plataforma. Amazon para comprar, Goodreads para reseñar; no ejecutamos esas acciones desde Reedleaves.
- Baraja: libro, usuario creador autorizado, idioma principal, estado editorial y recomendación opcional. Puede tener una URL HTTPS de fuente para sus citas, que el equipo fija al crearla mediante MCP. La API omite el campo cuando no existe; la autoría de cuentas no puede editarlo.
- Tarjeta: baraja, padre opcional, orden entre hermanas y texto en el idioma de la baraja; otras traducciones son opcionales.
- Usuario: identidad interna y permiso de creación. Las cuentas de lectores tienen acceso mediante usuario y contraseña; las sesiones y el progreso se guardan en servidor. Ver `ACCOUNTS.md`.
- Lectura: estado por usuario y libro, independiente de las barajas añadidas al Tarjetero.
- Barajas añadidas: relación por usuario y baraja elegida. No se guarda posición ni avance de lectura por tarjeta.
- Monedero de hojas: usuario, saldo entero no negativo y última fecha de abono. Los abonos diarios acumulan hasta tres; los ajustes manuales pueden superar ese saldo.
- Monedero de pétalos: usuario, saldo y última fecha de recarga; nueve al día hasta quince. `practice_sessions` registra cada sesión breve pagada y sus fechas de inicio/finalización. `practice_answers` conserva la última respuesta por tarjeta para ordenar sesiones futuras.
- Voto: usuario y baraja; +1, -1 o ausencia de fila. Un único voto, modificable y retirable.
- Valoración de tarjeta: usuario y tarjeta en `card_votes`, con destino −1, 0 o 1; no se permite votar contenido propio.
- Tarjeta guardada: usuario, tarjeta y fecha en `card_saves`. Selección privada por libro, independiente de votos y repaso. La clave compuesta impide duplicados; el origen y el libro proceden de la tarjeta, sin copiar contenido.

Número de cartas y profundidad se calculan a partir del árbol; una baraja plana tiene profundidad 1.
No guardar contadores editables ni duplicar el árbol en una columna JSON.
El padre de una tarjeta debe pertenecer a la misma baraja.
No se permiten ciclos, posiciones duplicadas entre hermanos ni recomendaciones múltiples por libro.

El idioma identifica el texto original y se mantiene en la baraja. Se guarda como etiqueta BCP 47 (es, en, pt-BR…). Cada baraja y tarjeta requiere texto en ese idioma; las traducciones son opcionales. El lector muestra una traducción si existe y, si no, usa el original.
Los metadatos editoriales requeridos de libros e intereses cubren español e inglés; otros idiomas guardados se conservan como datos opcionales. `book_translations.title` guarda el título completo; las portadas pequeñas limitan visualmente los títulos a tres líneas mediante CSS. Estas traducciones no declaran disponibilidad de barajas en ese idioma: las seis actuales siguen siendo monolingües ES/EN. Las columnas SQL de idioma admiten etiquetas nuevas sin volver a cambiar el esquema; la importación exige español e inglés, definidos en `app/core.mjs`.
Una baraja puede corregirse directamente sin cambiar sus IDs ni los de sus tarjetas. El borrado de tarjetas y traducciones sigue protegido. Los repasos y votos apuntan a tarjetas y barajas estables.
La importación valida orden consecutivo, referencias, textos, estructura y derechos de creación antes de completar la transacción.

## Métricas reales

La API devuelve me gusta y no me gusta por baraja. Sin actividad, todo vale cero. La cuadrícula distingue la recomendación editorial del equipo; las distinciones de comunidad están pendientes de activarse.

## Archivos y ejecución

- `server/schema.sql` y `server/schema.postgres.sql`: esquemas actuales para SQLite y PostgreSQL; migraciones de versiones anteriores en `server/database.mjs`.
- `var/catalog.sqlite`: datos activos, privados y fuera del repositorio.
- `content/catalog/users.csv`, `books.csv`, `genres.csv`, `decks.csv`, `cards.csv`, `links.csv`: carga inicial en texto.
- En `books.csv`, `genres` es una lista separada por `|`; su secuencia es el orden editorial y se importa sin ordenar ni deduplicar. La API devuelve esa misma secuencia en `book.genres`.
- `server/seed.mjs`: importación transaccional; reiniciar no sobrescribe datos.
- `server/catalog-repository.mjs`: consulta relacional y métricas.
- `server/leaf-wallet-repository.mjs`: abono fechado y persistente por usuario; comparte las reglas con `app/wallet.mjs`.
- `/api/catalog`: contrato actual de libros, barajas, idiomas y tarjetas.
- `app/catalog.mjs`: valida cada árbol dentro de su baraja, sin mezclar barajas del mismo libro.

```sh
npm run db:init
npm run db:seed
npm run db:check
npm start
npm test
npm run db:backup -- var/backups/mi-copia.sqlite
```

La base contiene 5 libros, 6 barajas y 42 cartas. Los ejemplos alternan entre inglés y español, con un solo idioma por baraja. Todas las barajas tienen un usuario creador obligatorio.
El usuario `reed-team`, «Equipo Reedleaves», representa al equipo que redacta este catálogo. No es una sesión ni una persona inventada. No sembramos lectores, votos ni repasos. Otras identidades de prueba viven solo en bases temporales. Su ID se conserva tras el cambio de nombre; cambian solo las etiquetas públicas. Las variables `REED_*`, las rutas históricas y las claves de almacenamiento se mantienen compatibles.
La inicialización es repetible y migra las versiones anteriores compatibles dentro de transacciones, conservando los datos. Un esquema desconocido falla explícitamente.

Variables: `DATABASE_URL` selecciona PostgreSQL; `REED_DB_PATH` selecciona la ruta SQLite local. `REED_HOST` (127.0.0.1), `REED_PORT` (4173), `REED_ORIGIN` (origen HTTPS obligatorio con `NODE_ENV=production`). Producción exige `DATABASE_URL` y no inicia sobre SQLite.
SQLite usa WAL, claves foráneas, tipos STRICT y sincronización FULL. Su backup es consistente con la API SQLite; no copiar solo el archivo principal si hay escrituras WAL. En PostgreSQL, usar las copias y restauración del proveedor.

La base anterior a barajas quedó respaldada en `var/backups/pre-decks-2026-10-06.sqlite`. El esquema con barajas previo al campo de idioma está en `var/backups/pre-language-2026-10-06.sqlite`.
Los archivos originales también se archivaron, sin eliminación irreversible.
El esquema anterior al saldo acumulable está en `var/backups/pre-leaf-wallet-2026-10-06.sqlite`; el original está archivado en `var/backups/pre-leaf-wallet-original-2026-10-06.sqlite`.

El esquema v6 añadió metadatos de libros e intereses con etiquetas de idioma extensibles. La base anterior v5 está respaldada en `var/backups/pre-french-2026-10-06.sqlite` y su original archivado en `var/backups/pre-french-original-2026-10-06.sqlite`.

El esquema v7 añadió `book_links` y los diez enlaces editoriales. La base anterior v6 está respaldada en `var/backups/pre-book-links-2026-10-06.sqlite` y su original archivado en `var/backups/pre-book-links-original-2026-10-06.sqlite`. Se ha comparado el contenido de todas las tablas previas, excluyendo las fechas técnicas de importación: se conserva entero. No había votos, repasos ni monederos SQL de usuarios que perder. El progreso del navegador no cambia. No hay migraciones ni reinicios destructivos automáticos.

El esquema v8 añadió `books.original_title` y `books.original_language`, obligatorios y separados de `book_translations`. La API entrega `originalTitle` y `originalLanguage`; los valida junto con las traducciones. La base v7 queda respaldada en `var/backups/pre-original-titles-2026-10-06.sqlite`, con su archivo original archivado en `var/backups/pre-original-titles-original-2026-10-06.sqlite`. Todas las tablas previas conservan sus datos, comparados excluyendo fechas técnicas y las dos columnas nuevas.

El esquema v9 añadió cuentas, sesiones, límites de acceso, barajas elegidas, posiciones, filtros, intereses e idea diaria por usuario. Añade comprobación SQL del recorrido y finalización con todas las cartas. La base v8 y su original están archivados antes del cambio; ver `ACCOUNTS.md`. No se migra progreso anónimo del navegador.

El esquema actual es SQLite v30 / PostgreSQL v22. No hay tablas ni columnas de versión de baraja: tarjetas, textos, selección, biblioteca y prácticas usan IDs estables de baraja o tarjeta. La migración aborta de forma transaccional si encuentra un caso histórico ambiguo con más de una versión o sin una versión identificable; así evita combinar o perder árboles editoriales. Las tarjetas de una baraja se consultan sin guardar avance por tarjeta ni una posición de lectura. Los propietarios pueden corregir el título y el idioma de una baraja mientras siga en borrador; al cambiar idioma, los textos en el idioma anterior se renombran solo cuando no existe ya una traducción en el nuevo idioma. `practices`, `practice_cards` y `practice_positions` se eliminaron; el tipo con descuento de los repasos se calcula con la fecha de creación de cuenta o de la última sesión completada, sin guardar el tipo elegido. Las sesiones breves de cinco tarjetas viven en `practice_sessions`; persisten tema, tarjetas, avance, coste y fechas para cobrar una vez y reanudar la sesión pagada. `practice_session_cards` normaliza las cinco tarjetas y conserva su orden; al completar la sesión se fija el día local para contar crecimiento por libro. Cada cuenta recibe nueve pétalos diarios hasta quince. PostgreSQL usa `BIGINT` para monederos; ambos motores limitan la representación a enteros exactos de JavaScript. La migración de guardadas añade `card_saves` con claves foráneas e índice por cuenta/fecha.

`app/book-search.mjs` filtra el catálogo recibido de la API por todos los títulos originales, completos y cortos, sin idioma activo como filtro. La consulta es estado temporal de la vista: no se escribe en SQLite ni en localStorage. Para este catálogo pequeño se consulta localmente el resultado SQL ya cargado; no hay una base simulada en JSON. Cuando el volumen requiera paginación, habrá que trasladar esa búsqueda a un endpoint con índices SQL, conservando las mismas reglas de coincidencia.

La API entrega `book.links.amazon` y `book.links.goodreads`, sin codificar libros concretos en la vista. `app/book-links.mjs` valida dominio y ruta de ficha en importación, repositorio, consumidor y render. Los iconos son SVG locales en `brand/platforms/`; no cargan rastreadores de plataformas externas.

## Límites explícitos

El selector de barajas, el repaso, la creación autenticada de libros y barajas, los votos de tarjeta y las guardadas están implementados. Los libros, las barajas de cuentas y sus tarjetas se comparten al guardarlos. La edición de barajas sigue reservada a su creador.
La API de catálogo sigue siendo de lectura. Los endpoints de cuenta, repaso, autoría y acciones escriben con sesión, origen y CSRF. `/api/cards/vote` y `/api/cards/save` aceptan destinos absolutos idempotentes; `/api/cards/:cardId/actions` y `/api/reader/saved/:bookId` leen las acciones y la selección propia. Guardadas no aparece en perfiles ni bibliotecas ajenas.
El progreso actual guarda prácticas y respuestas por usuario y tarjeta en SQL. Las barajas ya no tienen entidades de versión ni avance propio.
Las claves locales antiguas se conservan sin borrar, pero no se usan como fuente verificada ni se importan en la cuenta nueva.
Archivar una baraja no elimina sus tarjetas, historial de prácticas ni referencias de usuarios.

Cada usuario recibe una hoja al día cuando su saldo está por debajo de tres. Un nuevo monedero empieza con una. Los días ausentes suman hasta tres; las fechas excedentes no se guardan para después. El ciclo diario de hojas y pétalos empieza a las 11:11 locales de la cuenta. Un ajuste manual puede dejar 100 hojas y se conserva el saldo. Añadir una baraja de otra persona a Decks cuesta una hoja; las barajas propias aparecen automáticamente. Repasar tarjetas no gasta hojas.
Cada cuenta nueva recibe diez pétalos. Cada sesión de cinco tarjetas cuesta tres pétalos, o dos si coincide con el tipo rebajado. El descuento se deriva de la fecha de la última sesión completada y cambia al completar una sesión.
Finalizar exige todas las tarjetas, incluidas las hijas; no solo las raíces.
La tabla `leaf_wallets` guarda el saldo y la última fecha de abono por usuario. Las hojas se aíslan por usuario y se comparten entre sus barajas. `card_views` registra la primera visualización de cada tarjeta para el perfil; no se usa para secuencia, acceso ni crecimiento de mascotas.
La autenticación identifica al usuario y el servidor calcula la fecha en la zona horaria fijada de su cuenta. Un doble clic o reintento no duplica el progreso. Borrar almacenamiento local o cambiar el reloj del navegador no altera el progreso SQL.
Las métricas SQL se incrementan con actividad real de cuentas: primera carta y finalización completa, no al añadir, elegir baraja ni explorarla. Para el crecimiento de mascotas, las sesiones completadas se agrupan por fecha local de la cuenta.

La idea aleatoria sigue siendo independiente: no altera el repaso ni los monederos.
Se sortea entre las cartas principales de la baraja elegida para cada libro; cambiar elección no sustituye la idea ya asignada hoy.
Las respuestas registradas ordenan la selección de tarjetas de práctica. El detalle de baraja no mantiene posición ni progreso propio. La lectura del libro sigue siendo independiente de `status=draft/published/archived`.

El contrato 4 del catálogo entrega cada baraja con su estado y metadatos; las tarjetas referencian directamente el ID estable de la baraja.
Las barajas y tarjetas creadas por cuentas se incluyen en el catálogo compartido aunque la baraja siga como borrador. Compartir el contenido no concede permisos de edición: solo el creador puede modificar sus tarjetas y textos. El estado publicado o archivado no crea copias de una baraja.

Producción usa PostgreSQL gestionado, `DATABASE_URL`, TLS del proveedor, backups, supervisión y HTTPS. SQLite se conserva para desarrollo y pruebas. `node:sqlite` sigue siendo experimental en el Node 24.11 local; el runtime requerido se fija en `.node-version`.

Las tarjetas son borradores editoriales propios. Revisar traducciones, contenido y derechos antes de publicación.

## Vocabulario vigente de estado

`decks.status=draft` es Borrador / Draft: el creador puede añadir y corregir tarjetas, y el catálogo ya comparte su contenido. `published` es Terminada / Finished; ya no impide correcciones de contenido. `editorial_status=draft/reviewed` en libros y barajas representa revisión editorial, no creación ni privacidad. Los registros de pruebas internas anteriores son contexto histórico.
