# Catálogo y barajas: base real de desarrollo

Contenido CSV → importación validada → SQLite local / PostgreSQL producción → repositorio SQL → API.
No se simula la base mediante JSON. JSON solo transporta la respuesta HTTP.

## Modelo actual

- Libro: autor, título original e idioma original propios, títulos localizados, fuentes e intereses. No contiene un único árbol.
- Los libros creados por cuentas se incorporan directamente al catálogo común, incluidos los ya guardados. Se conserva `creator_user_id` para atribución y para completar metadatos; no controla visibilidad. Todas las cuentas pueden registrar su lectura y crear su propia baraja sobre ellos. Fichas mínimas sin traducciones, intereses, enlaces o barajas visibles son válidas. Ver [ADR 0001](../adr/0001-libros-en-catalogo-comun.md): la gestión de privacidad de libros queda pospuesta.
- Enlace de libro: plataforma y URL de su ficha, en `book_links`; único por libro y plataforma. Separado de las fuentes de contenido. Amazon para comprar, Goodreads para reseñar; no ejecutamos esas acciones desde Reedleaves.
- Baraja: libro, usuario creador autorizado, idioma principal y recomendación opcional.
- Versión de baraja: título, descripción del enfoque, nota editorial, número de versión y estado.
- Carta: versión, padre opcional, orden entre hermanas y texto en el idioma de la baraja; otras traducciones son opcionales.
- Usuario: identidad interna y permiso de creación. Las cuentas de lectores tienen acceso mediante usuario y contraseña; las sesiones y el progreso se guardan en servidor. Ver `ACCOUNTS.md`.
- Lectura original: estado por usuario y libro, independiente del repaso.
- Repaso: usuario y versión elegida. Las cartas desbloqueadas pertenecen a ese repaso.
- Monedero de hojas: usuario, saldo entero no negativo y última fecha de abono. Los abonos diarios acumulan hasta tres; los ajustes manuales pueden superar ese saldo.
- Voto: usuario y baraja; +1, -1 o ausencia de fila. Un único voto, modificable y retirable.

Número de cartas y profundidad se calculan a partir del árbol; una baraja plana tiene profundidad 1.
No guardar contadores editables ni duplicar el árbol en una columna JSON.
La fuente de una carta debe pertenecer al mismo libro. Su padre debe pertenecer a la misma versión.
No se permiten ciclos, posiciones duplicadas entre hermanos ni recomendaciones múltiples por libro.

El idioma identifica el texto original y se mantiene en la baraja. Se guarda como etiqueta BCP 47 (es, en, pt-BR…). Cada versión y carta requiere texto en ese idioma; las traducciones son opcionales. El lector muestra una traducción si existe y, si no, usa el original.
Los metadatos de libros e intereses cubren los idiomas de interfaz: español, inglés y francés. `book_translations.title` guarda el título completo; `short_title`, la versión editorial de portada. No se recorta el título mediante CSS. Estas traducciones no declaran disponibilidad de barajas en ese idioma: las seis actuales siguen siendo monolingües ES/EN. Las columnas SQL de idioma admiten etiquetas nuevas sin volver a cambiar el esquema; la importación exige los idiomas de interfaz definidos en `app/core.mjs`.
El contenido publicado o archivado es inmutable en SQL. Para editarlo se crea otra versión con nuevos IDs de carta.
Los repasos anteriores siguen apuntando a su versión. Los votos pertenecen a la baraja, no a una versión.
La importación valida orden consecutivo, referencias, textos, estructura y derechos de creación antes de completar la transacción.

## Métricas reales

La API devuelve me gusta, no me gusta, personas que empezaron y personas que terminaron.
Los recuentos de personas son únicos por baraja, incluso si alguien repasa varias versiones.
Sin actividad, todo vale cero. No hay usuarios, votos ni popularidad inventados.

Más popular cuenta personas que empezaron. Más terminada es una categoría distinta, por personas que terminaron.
“Preferida por la comunidad” contará me gusta, no me gusta menos no me gusta.
La cuadrícula muestra primero la recomendación, después las ganadoras reales deduplicadas y finalmente otras propuestas. No otorga etiquetas por cero actividad.

## Archivos y ejecución

- `server/schema.sql` y `server/schema.postgres.sql`: esquemas actuales para SQLite y PostgreSQL; migraciones de versiones anteriores en `server/database.mjs`.
- `var/catalog.sqlite`: datos activos, privados y fuera del repositorio.
- `content/catalog/users.csv`, `books.csv`, `genres.csv`, `decks.csv`, `cards.csv`, `links.csv`: carga inicial en texto.
- `server/seed.mjs`: importación transaccional; reiniciar no sobrescribe datos.
- `server/catalog-repository.mjs`: consulta relacional y métricas.
- `server/leaf-wallet-repository.mjs`: abono fechado y persistente por usuario; comparte las reglas con `app/wallet.mjs`.
- `/api/catalog`: contrato versión 3, con libros, barajas, versiones, idiomas y cartas.
- `app/catalog.mjs`: valida cada árbol por versión, sin mezclar barajas del mismo libro.

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

El esquema actual es SQLite v14 / PostgreSQL v6. La migración de monederos elimina el tope de tres del saldo total, conservando cuentas, fechas, saldos y progreso. PostgreSQL usa `BIGINT`; ambos motores limitan la representación a enteros exactos de JavaScript. El máximo de tres solo afecta al abono diario.

`app/book-search.mjs` filtra el catálogo recibido de la API por todos los títulos originales, completos y cortos, sin idioma activo como filtro. La consulta es estado temporal de la vista: no se escribe en SQLite ni en localStorage. Para este catálogo pequeño se consulta localmente el resultado SQL ya cargado; no hay una base simulada en JSON. Cuando el volumen requiera paginación, habrá que trasladar esa búsqueda a un endpoint con índices SQL, conservando las mismas reglas de coincidencia.

La API entrega `book.links.amazon` y `book.links.goodreads`, sin codificar libros concretos en la vista. `app/book-links.mjs` valida dominio y ruta de ficha en importación, repositorio, consumidor y render. Los iconos son SVG locales en `brand/platforms/`; no cargan rastreadores de plataformas externas.

## Límites explícitos

El selector, el repaso por versión y la creación autenticada de libros y barajas están implementados. Los libros se comparten al guardarlos; los borradores de barajas de cuentas siguen privados. La publicación de barajas desde la aplicación y los votos siguen fuera de esta entrega.
La API de catálogo sigue siendo de lectura; los endpoints de cuenta, repaso y autoría escriben con sesión, origen y CSRF. No hay endpoints de voto ni publicación de barajas.
El progreso actual guarda cartas por usuario y versión en SQL. Nunca se hereda progreso entre barajas o versiones.
Las claves locales antiguas se conservan sin borrar, pero no se usan como fuente verificada ni se importan en la cuenta nueva.
Cambiar la publicación de una baraja no cambia el repaso iniciado: el selector permite retomar la versión con historial.

Cada usuario recibe una hoja al día cuando su saldo está por debajo de tres. Un nuevo monedero empieza con una. Los días ausentes suman hasta tres; las fechas excedentes no se guardan para después. Un ajuste manual puede dejar 100 hojas: se conservan hasta gastarlas, sin recortarlas a tres al pasar los días. El abono diario vuelve cuando el saldo baja de tres. Una carta nueva cuesta una hoja y se pueden gastar varias el mismo día. La hermana siguiente y la primera hija son alternativas.
Volver a una carta repasada, subir a la madre y cambiar baraja no gasta hojas.
Finalizar exige todas las cartas, incluidas las hijas; no solo las raíces.
La tabla `leaf_wallets` guarda saldo y fecha por usuario. En SQLite, el trigger de desbloqueo abona días pendientes y descuenta una hoja en la misma operación SQL. En PostgreSQL, el repositorio realiza el débito condicional dentro de la transacción del desbloqueo; la actualización atómica evita saldo negativo ante peticiones concurrentes. En ambos motores, un error revierte el avance. Ya no existe la restricción de un avance por usuario y fecha. Los monederos se aíslan por usuario y se comparten entre sus barajas.
La autenticación identifica al usuario y el servidor calcula la fecha en la zona horaria fijada de su cuenta. Un doble clic o reintento no cobra dos veces la misma carta. Borrar almacenamiento local o cambiar el reloj del navegador no concede hojas ni elimina progreso SQL.
Las métricas SQL se incrementan con actividad real de cuentas: primera carta y finalización completa, no al elegir baraja ni explorarla.

La idea aleatoria sigue siendo independiente: no gasta ni regala hojas y no desbloquea la carta en el repaso.
Se sortea entre las cartas principales de la baraja elegida para cada libro; cambiar elección no sustituye la idea ya asignada hoy.
Los filtros repasando y repasado agrupan el progreso de todas las barajas de un libro. Un libro puede pertenecer a ambos grupos si tiene una baraja terminada y otra en curso.

La versión 3 del catálogo todavía expone nuestros borradores editoriales para la prueba interna.
Los borradores de barajas de cuentas se filtran por autor; compartir la ficha de un libro no publica sus barajas ni sus tarjetas. Las versiones publicadas conservan las reglas de validación e inmutabilidad.

Producción usa PostgreSQL gestionado, `DATABASE_URL`, TLS del proveedor, backups, supervisión y HTTPS. SQLite se conserva para desarrollo y pruebas. `node:sqlite` sigue siendo experimental en el Node 24.11 local; el runtime requerido se fija en `.node-version`.

Las tarjetas son borradores editoriales propios. Revisar traducciones, contenido y derechos antes de publicación.
