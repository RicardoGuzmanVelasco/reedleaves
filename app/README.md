# Reedleaves

Catálogo real: cinco libros, seis barajas y 42 tarjetas. Cada baraja tiene un idioma original y puede añadir traducciones. Reedleaves es el nombre oficial del proyecto, la web y la app; logo y mascota aprobados sin cambios. Lemas: «Read. Plant a seed.» y «De hoja a hoja».

## Ejecutar

Usar Node 24.21.0, fijado en `.node-version`. Instalar las dependencias del lockfile:

```sh
npm ci
npm start
```

Abrir http://127.0.0.1:4173/app/. La primera ejecución crea y carga SQLite; las siguientes conservan los datos existentes. El servidor estático de Python ya no basta: la interfaz necesita la API.

`npm start` y `npm test` compilan primero el frontend. React/React DOM 19.3 gestionan las acciones de tarjeta y la colección personal; esbuild genera `app/generated/card-features.js`, ignorado en Git. Para editar JSX con recompilación continua, ejecutar `npm run watch:ui` en otra terminal. El build de Render también genera este módulo local.

## Recorrido

- Sin sesión: entrar o crear cuenta con usuario y contraseña; se pueden explorar los libros sin registrarse. El repaso necesita cuenta.
- Inicio con sesión muestra los libros marcados Leyendo o con alguna versión draft propia, incluidas las vacías, ordenados por la última nota creada en una baraja propia (sin fecha: orden estable del catálogo), como libros cerrados: portada, lomo y canto de páginas. El «+» abre directamente Tomar nota si no hay destino propio editable, con aviso de creación de Notas de lectura / Reading notes. La baraja y primera nota se guardan juntas en una transacción; cancelar no deja una baraja vacía. El idioma de esta baraja es el de la app al abrir el editor, no el del libro, y se conserva con el borrador local. Si existe una única versión draft propia, abre directamente el editor de idea; con varias abre un popover anclado con las dos barajas propias editables con notas más recientes y «Ver todas» para la lista completa. Los destinos sin fecha conocida aparecen en esa lista. Al elegir se fija la versión y se muestra el nombre de la baraja. Título, texto y guardado explícito. El selector Idea / Cita permite cambiar el tipo sin perder el borrador; cita no exige título y guarda con el modelo de citas existente. La entrada de cada nota nueva sigue siendo Idea. Si hay una nota pendiente, «+» recupera el borrador local más reciente del libro antes del selector de baraja, con el aviso «Nota sin guardar recuperada» y el nombre del destino. Tomar nota recupera el borrador de esa versión. Se conservan tipo, título, cuerpo, relación e identificador para reintentar; guardar con confirmación o cancelar elimina el borrador. Se guarda por cuenta y versión en este navegador, sin sincronización entre dispositivos; cambiar sesión oculta el editor anterior. Si no se puede persistir localmente o la baraja deja de ser editable, se avisa. Guardar o cancelar vuelve a Inicio. Elegir una baraja la añade sin gastar hojas; se recuperan también los repasos ya empezados. El árbol solo aparece al entrar en el repaso.
- Lectura y escritura son independientes: el selector único No leído / Leyendo / Leído de la ficha cambia el estado personal en cualquier dirección. Se sitúa bajo título/autor y cada opción tiene su icono. Un leído con baraja propia en borrador permanece en Inicio («Leído · Barajas en borrador»). Un libro Leyendo permanece aunque termine todas sus barajas. Sale cuando no está Leyendo y no queda ningún draft propio; repasos y barajas ajenas no lo retienen. Crear otra baraja propia lo devuelve sin cambiar la lectura. El «+» sigue operativo para los libros retenidos por notas. Todas las portadas abren esa ficha, con independencia del repaso pendiente. «Ver barajas» continúa el recorrido; «+» mantiene la captura directa. Se conserva la ficha abierta al cambiar el estado aunque el libro salga de Inicio y se mantiene el orden por la última nota creada.
- Cabecera: logo, saldos compactos de hojas y pétalos y ajustes de idioma, títulos originales y cuenta. Las hojas no tienen un uso activo; una cuenta nueva empieza con diez pétalos. Sin lemas ni texto del saldo.
- Librería (Library / Librairie) es el catálogo completo. «Ver biblioteca» desde el perfil abre Biblioteca (Bookshelf / Bibliothèque), con libros propios, marcados como leyendo o leídos, barajas elegidas e historial de repaso. Dos filtros combinables separan lectura original y repaso; cada libro aparece una sola vez. Inicio muestra una fila de tres botones encima de los libros: «Ir a mi perfil», «Idea del día» e «Ir a la librería», con este último en verde como acción principal.
- Una idea diaria global, compartida por todas las cuentas y fijada por fecha UTC. El calendario permite abrir las ideas de días anteriores.
- Géneros recibidos de la base: crecimiento personal, finanzas y productividad.
- Librería, accesible desde «Ir a la librería»: cuadrícula de libros cerrados con título, autor, intereses y número de barajas. Pulsar abre su ficha modal; ahí se consulta la descripción, se marca la lectura del original y se accede a las barajas. Tras marcar Leyendo o Leído, la ficha ofrece temporalmente «¿Quieres tomar una nota de este libro?» con acceso directo al editor. Si no hay baraja propia en borrador, se creará «Notas de lectura» al guardar; si hay varias, se elige destino. Cancelar o guardar devuelve a la misma ficha. Al marcar Leído con barajas en borrador, primero se resuelve el diálogo de cierre. La navegación no gasta hojas ni elige una baraja automáticamente.
- Elegir una baraja por libro: título, autoría enlazada y chips de tarjetas, personas repasando, idioma y Borrador. La recomendación del equipo muestra «Te recomendamos / We recommend» con estrella y etiqueta de papel ondulado; las distinciones de comunidad conservan datos y ordenación, pero siguen ocultas.
- Todas las tarjetas de las barajas se pueden abrir y repasar desde el principio, incluidas las hijas y las citas. El progreso registra tarjetas distintas y la última abierta. Por ahora, abrirlas no gasta hojas ni pétalos.
- Crear barajas propias desde las barajas de un libro. «Tomar nota» abre el editor compartido con Inicio, con selector Idea / Cita y relación opcional «Colocar debajo de». Alternar conserva título, texto y relación; destino libro/versión fijo. Desde el detalle, repaso o gestión de una baraja, «Tomar nota» abre el editor directamente y recupera su borrador. Guardar/cancelar restaura la entrada original, incluidos detalle abierto, vista, filtros, posición y foco. «Gestionar baraja» permite revisar las notas propias y terminar la baraja. El contenido se guarda en el idioma de la baraja.
- Citas en azul pastel y EB Garamond regular; fuente WOFF2 local con alternativa serif. Filtro «Solo citas». Las sueltas aparecen bajo «Citas sin clasificar», sin tarjeta ficticia en la base.
- Guardar o quitar una tarjeta desde su vista exclusiva o desde Idea del día. «Guardadas» en las barajas del libro abre una selección privada de tarjetas y citas de distintas barajas, más recientes primero. Mantiene el filtro de citas y permite reabrir las guardadas. Guardar no altera el progreso del repaso.
- Me gusta, no me gusta y guardar tienen respuesta optimista con React `useOptimistic` y Actions. El servidor confirma destinos absolutos; ante errores se recupera el estado confirmado y se ofrece reintento. La autoría propia permite guardar, pero no votar.
- Lectura protagonista: papel elevado por capas, fondo iluminado, entrada breve y texto progresivo a 4 ms por carácter, con un máximo aproximado de 2,5 segundos. El contenido completo permanece accesible; movimiento reducido omite la animación. La presentación se comparte entre repaso, autoría e idea del día.
- Las barajas y sus tarjetas se comparten al guardarlas; solo el creador puede añadir tarjetas mientras sean borradores. Sin rachas ni tareas. El selector y el repaso admiten barajas anidadas.

Lectura original y repaso son independientes. Una tarjeta aleatoria no registra progreso del repaso. Los números de tarjetas no están fijados en la interfaz: cada libro usa sus datos de la API.

## Datos y código

Las versiones `draft` se presentan como «Baraja en borrador / Draft deck», con una explicación distinta para propietario y lector y las `published` como «Terminada». El propietario puede marcar como terminada una versión no vacía desde autoría, con confirmación explícita e irreversible. La versión queda protegida por los triggers existentes; no se reabre. Con una nota local pendiente se pide guardarla o cancelarla antes de terminar. El endpoint `/api/author/decks/finish` verifica sesión, CSRF, propiedad y contenido, serializa contra añadir tarjetas y admite reintentos. Conserva progreso y saldos. La versión terminada sigue en el catálogo y el repaso, deja de ser destino del «+» y los enlaces antiguos de autoría llevan al repaso. Sin migración.

Crear libro ofrece «Rellenar con IA»: título (autor e idioma original opcionales para la búsqueda), indicador de carga y vista previa. La IA consulta la web y propone título original, autor, idioma original, títulos completos/cortos, descripciones y notas en español e inglés, intereses del catálogo y enlaces verificados disponibles. La ficha permite consultar traducciones; «Editar» conserva el borrador y ofrece los metadatos en controles plegados. Repetir la búsqueda con IA completa huecos sin sustituir valores ya escritos. Solo «Crear libro» persiste la propuesta; cancelar la descarta. La creación manual continúa disponible.

La integración requiere `OPENAI_API_KEY` en el servidor. Ver [configuración](../docs/deployment/render.md). Las pruebas usan un proveedor simulado, sin llamadas de pago. El prompt y el esquema están en `server/book-autofill.mjs`; no se comparte el contexto de esta conversación.

Los libros propios ya creados muestran un icono de información pendiente en Inicio, Librería, Biblioteca y la ficha si faltan títulos completos/cortos o descripciones ES/EN, o intereses. Pulsarlo abre «Completar información», reutiliza la búsqueda y vista previa, y ofrece «Guardar» para completar el mismo libro. Identidad y datos previos son de solo lectura; los campos nuevos se pueden corregir. El servidor combina la propuesta con los datos más recientes bajo bloqueo y conserva los valores existentes, también si otra sesión ha completado el libro. Los reintentos no duplican datos ni alteran barajas, progreso o saldo. Enlaces y notas opcionales no mantienen el indicador. Solo el creador puede completar sus libros; no hay migración.

Contenido editable: content/catalog/*.csv. Datos activos: var/catalog.sqlite, con libros, barajas, versiones y árboles. SQLite v19 y PostgreSQL v11. Las migraciones conservan cuentas, tarjetas y progreso; la última elimina la bibliografía almacenada y su relación con tarjetas. Las notas históricas mantienen fecha desconocida. HTTP JSON es transporte, no almacenamiento del catálogo.

Backend: server/database.mjs, seed.mjs, catalog-repository.mjs, author-repository.mjs, auth.mjs, reader-repository.mjs, reader-api.mjs y http.mjs.

Frontend: catalog.mjs (API), account-client.mjs (sesión y colas de peticiones), card-features.jsx (acciones y guardadas mediante portales React), card-interactions.mjs (reducer optimista y transporte), card-types.mjs (título, semántica e icono por tipo), card-themes.css (paleta y tipografía, incluidas las acciones), wallet.mjs (saldo de hojas), decks.mjs (selección y progreso del árbol), storage.mjs (idioma y borradores), views.mjs (render común), i18n.mjs (copy), reader-app.mjs (interacción) y reader.mjs (entrada).

La base y los CSV no se sirven por HTTP. Los JSON/NDJSON antiguos se conservan solo en fixtures de pruebas.

Editar contenido y actualizar explícitamente:

```sh
npm run db:seed
npm run db:check
npm test
```

Pruebas automatizadas: integridad SQL, persistencia, backup, rollback, API, formatos de idioma, filtros, cupo compartido, varias barajas, jerarquía, votos y versiones inmutables.

## Límites actuales

El backend guarda saldo, progreso, posición, lectura original y preferencias de presentación por cuenta. La idea diaria se fija en común por fecha UTC. La fecha y el gasto se validan en servidor. Dobles clics, reintentos y dos sesiones no duplican gasto. Volver a entrar recupera el repaso; completarlo exige todas las tarjetas, incluidas las hijas.

La cuenta nueva empieza limpia. El progreso de la antigua prueba anónima se conserva en el navegador, sin borrarlo ni importarlo como verificado. El idioma sigue escribiéndose localmente. Sin sesión, también se conserva la preferencia de títulos originales en el navegador; con sesión se usa la preferencia de la cuenta.

La app está desplegada en producción. Recuperación de contraseña y revisión editorial siguen siendo cuestiones independientes del estado de creación de las barajas. Producción exige HTTPS y `REED_ORIGIN`. Ver ../docs/architecture/ACCOUNTS.md y ../docs/DEPLOYMENT.md.

Tarjetas editoriales propias y breves con fuentes de autores/editoriales; sin texto completo ni portadas comerciales. El campo `editorial_status` identifica la revisión editorial pendiente; no controla la visibilidad ni equivale al estado de creación `status`. Finanzas resume ideas de los autores, no ofrece asesoramiento.

Arquitectura, despliegue y limitaciones del controlador: ../docs/architecture/CATALOG.md. Contenido y próximos libros propuestos: ../content/catalog/README.md.

### Cerrar las notas de un libro leído

Al marcar un libro Leído, si quedan barajas propias en borrador se ofrece un diálogo con nombres y cantidades. Confirmar termina las no vacías y descarta las vacías (`archived`); Mantener en borrador conserva las barajas y el estado Leído. Barajas en borrador, junto al selector de lectura, permite recuperar el diálogo. Los borradores locales deben resolverse antes y pueden retomarse desde su fila. El cierre vuelve a la lista de origen sin entrar en repaso.

`POST /api/author/decks/finish-notes` valida el listado mostrado, propiedad, libro y recuentos bajo los mismos bloqueos de versión que añadir notas. Es transaccional e idempotente; un conflicto exige revisar la lista actualizada. No añade migraciones ni elimina registros físicos.

`POST /api/author/notes` crea la baraja predeterminada y su primera nota de forma atómica. Nombre compartido en `app/note-defaults.mjs`; el idioma viaja con la nota y su borrador. El identificador estable permite reintentar sin duplicar. La creación manual de barajas sigue disponible por separado.

### Vocabulario de creación y repaso (17 de octubre de 2026)

Borrador no significa privado. Las barajas son visibles y repasables al guardarse; terminar cierra el contenido de forma irreversible. Añadir tarjetas a una baraja en borrador conserva el progreso registrado; las tarjetas nuevas se pueden abrir desde el primer momento. El perfil usa Barajas en repaso / Decks being practiced y Barajas con repaso completo / Fully practiced decks. Una nota sin guardar es el contenido local del editor, no una baraja; se conserva por cuenta/libro/versión en ese navegador. El selector usa banderas SVG suaves como chip entre el ojo y Borrador, con el título a todo el ancho.
