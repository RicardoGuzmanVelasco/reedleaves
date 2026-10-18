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
- Inicio con sesión muestra los libros marcados Leyendo o con alguna baraja propia en borrador, incluidas las vacías, ordenados por la última nota creada en una baraja propia (sin fecha: orden estable del catálogo), como libros cerrados. El «+» abre Tomar nota si no hay destino propio editable. La baraja y primera nota se guardan juntas en una transacción; cancelar no deja una baraja vacía. Si hay una única baraja propia en borrador, abre directamente el editor; con varias abre un selector de destinos recientes. Al elegir se fija la baraja y se muestra su nombre. Los borradores locales se guardan por cuenta y baraja en este navegador, sin sincronización entre dispositivos; el lector migra automáticamente los IDs locales antiguos con sufijo `-v1`.
- Lectura y escritura son independientes: el selector único No leído / Leyendo / Leído de la ficha cambia el estado personal en cualquier dirección. Se sitúa bajo título/autor y cada opción tiene su icono. Un leído con baraja propia en borrador permanece en Inicio («Leído · Barajas en borrador»). Un libro Leyendo permanece aunque termine todas sus barajas. Sale cuando no está Leyendo y no queda ningún draft propio; repasos y barajas ajenas no lo retienen. Crear otra baraja propia lo devuelve sin cambiar la lectura. El «+» sigue operativo para los libros retenidos por notas. Todas las portadas abren esa ficha, con independencia del repaso pendiente. «Ver barajas» continúa el recorrido; «+» mantiene la captura directa. Se conserva la ficha abierta al cambiar el estado aunque el libro salga de Inicio y se mantiene el orden por la última nota creada.
- Cabecera: logo, saldos compactos de hojas y pétalos y ajustes de idioma, títulos originales y cuenta. Las hojas no tienen un uso activo; una cuenta nueva empieza con diez pétalos. El contador de pétalos muestra saldo sobre máximo. Sin lemas ni texto del saldo.
- El glosario distingue cuatro destinos: Librería / Library es el catálogo; Biblioteca / Bookcase es la colección personal; Estantería / Shelf reúne los libros; Tarjetero / Decks reúne las barajas elegidas y las creadas por la persona. La Biblioteca tiene dos vistas con iconos. El catálogo enlaza a la Biblioteca y esta vuelve a la Librería. En Estantería, dos filtros combinables separan lectura original y repaso; cada libro aparece una sola vez. Inicio conserva tres botones: perfil, idea del día y Librería.
- Una idea diaria global, compartida por todas las cuentas y fijada por fecha UTC. El calendario permite abrir las ideas de días anteriores.
- Géneros recibidos de la base: crecimiento personal, finanzas y productividad.
- Librería, accesible desde «Ir a la librería»: cuadrícula de libros cerrados con título, autor, intereses y número de barajas. Pulsar abre su ficha modal; ahí se consulta la descripción, se marca la lectura del original y se accede a las barajas. Tras marcar Leyendo o Leído, la ficha ofrece temporalmente «¿Quieres tomar una nota de este libro?» con acceso directo al editor. Si no hay baraja propia en borrador, se creará «Notas de lectura» al guardar; si hay varias, se elige destino. Cancelar o guardar devuelve a la misma ficha. Al marcar Leído con barajas en borrador, primero se resuelve el diálogo de cierre. La navegación no gasta hojas ni elige una baraja automáticamente.
- Elegir una baraja por libro: título, autoría enlazada y chips de tarjetas, personas repasando, idioma y Borrador. La recomendación del equipo muestra «Te recomendamos / We recommend» con estrella y etiqueta de papel ondulado; las distinciones de comunidad conservan datos y ordenación, pero siguen ocultas.
- Todas las tarjetas de las barajas se pueden abrir y repasar desde el principio, incluidas las hijas y las citas. El progreso registra tarjetas distintas y la última abierta; abrirlas directamente no gasta hojas ni pétalos. Las sesiones de cinco tarjetas cuestan 3 pétalos, o 2 si su tipo tiene el descuento actual. Solo empiezan con cinco tarjetas elegibles. El descuento se deriva de la fecha de la última sesión pagada completada; una sesión interrumpida conserva su coste y se puede reanudar. Las respuestas priorizan tarjetas «Quiero repasarla pronto», después las nuevas y al final las recordadas; ninguna se excluye.
- Crear barajas propias desde las barajas de un libro. «Tomar nota» abre el editor compartido con Inicio, con selector Idea / Cita y relación opcional «Colocar debajo de». Alternar conserva título, texto y relación; destino libro/baraja fijo. Desde el detalle, repaso o gestión de una baraja, «Tomar nota» abre el editor directamente y recupera su borrador.
- Citas en azul pastel y EB Garamond regular; fuente WOFF2 local con alternativa serif. Filtro «Solo citas». Las sueltas aparecen bajo «Citas sin clasificar», sin tarjeta ficticia en la base.
- Guardar o quitar una tarjeta desde su vista exclusiva o desde Idea del día. «Guardadas» aparece como primera tarjeta en las barajas del libro, solo para la cuenta, y muestra su contador. Abre una selección privada de tarjetas y citas de distintas barajas, más recientes primero. Mantiene el filtro de citas y permite reabrir las guardadas. Guardar no altera el progreso del repaso.
- Me gusta, no me gusta y guardar tienen respuesta optimista con React `useOptimistic` y Actions. El servidor confirma destinos absolutos; ante errores se recupera el estado confirmado y se ofrece reintento. La autoría propia permite guardar, pero no votar.
- Lectura protagonista: papel elevado por capas, fondo iluminado, entrada breve y texto progresivo a 4 ms por carácter, con un máximo aproximado de 2,5 segundos. El contenido completo permanece accesible; movimiento reducido omite la animación. La presentación se comparte entre repaso, autoría e idea del día.
- Las barajas y sus tarjetas se comparten al guardarlas; solo el creador puede añadir tarjetas mientras sean borradores. Sin rachas ni tareas. El selector y el repaso admiten barajas anidadas.

Lectura original y repaso son independientes. Una tarjeta aleatoria no registra progreso del repaso. Los números de tarjetas no están fijados en la interfaz: cada libro usa sus datos de la API.

## Datos y código

`draft` se presenta como «Baraja en borrador / Draft deck» y `published` como «Terminada». El endpoint `/api/author/decks/finish` verifica sesión, CSRF, propiedad y contenido, serializa contra añadir tarjetas y admite reintentos. El estado y el contenido viven en la propia baraja; no hay entidades de versión.

Crear libro ofrece «Rellenar con IA»: título (autor e idioma original opcionales para la búsqueda), indicador de carga y vista previa. La IA consulta la web y propone título original, autor, idioma original, títulos completos/cortos, descripciones y notas en español e inglés, intereses del catálogo y enlaces verificados disponibles. La ficha permite consultar traducciones; «Editar» conserva el borrador y ofrece los metadatos en controles plegados. Repetir la búsqueda con IA completa huecos sin sustituir valores ya escritos. Solo «Crear libro» persiste la propuesta; cancelar la descarta. La creación manual continúa disponible.

La integración requiere `OPENAI_API_KEY` en el servidor. Ver [configuración](../docs/deployment/render.md). Las pruebas usan un proveedor simulado, sin llamadas de pago. El prompt y el esquema están en `server/book-autofill.mjs`; no se comparte el contexto de esta conversación.

Los libros propios ya creados muestran un icono de información pendiente en Inicio, Librería, Biblioteca y la ficha si faltan títulos completos/cortos o descripciones ES/EN, o intereses. Pulsarlo abre «Completar información», reutiliza la búsqueda y vista previa, y ofrece «Guardar» para completar el mismo libro. Identidad y datos previos son de solo lectura; los campos nuevos se pueden corregir. El servidor combina la propuesta con los datos más recientes bajo bloqueo y conserva los valores existentes, también si otra sesión ha completado el libro. Los reintentos no duplican datos ni alteran barajas, progreso o saldo. Enlaces y notas opcionales no mantienen el indicador. Solo el creador puede completar sus libros; no hay migración.

Contenido editable: content/catalog/*.csv. Datos activos: var/catalog.sqlite, con libros, barajas y árboles. SQLite v29 y PostgreSQL v21. Las migraciones conservan cuentas, tarjetas y progreso; la migración actual elimina las entidades de versión y enlaza las referencias directamente a IDs de baraja.

Backend: server/database.mjs, seed.mjs, catalog-repository.mjs, author-repository.mjs, auth.mjs, reader-repository.mjs, reader-api.mjs y http.mjs.

Frontend: catalog.mjs (API), account-client.mjs (sesión y colas de peticiones), card-features.jsx (acciones y guardadas mediante portales React), card-interactions.mjs (reducer optimista y transporte), card-types.mjs (título, semántica e icono por tipo), card-themes.css (paleta y tipografía, incluidas las acciones), wallet.mjs (saldo de hojas), decks.mjs (selección y progreso del árbol), storage.mjs (idioma y borradores), views.mjs (render común), i18n.mjs (copy), reader-app.mjs (interacción) y reader.mjs (entrada).

La base y los CSV no se sirven por HTTP. Los JSON/NDJSON antiguos se conservan solo en fixtures de pruebas.

Editar contenido y actualizar explícitamente:

```sh
npm run db:seed
npm run db:check
npm test
```

Pruebas automatizadas: integridad SQL, persistencia, backup, rollback, API, formatos de idioma, filtros, cupo compartido, varias barajas, jerarquía, votos y migraciones de esquemas históricos.

## Límites actuales

El backend guarda saldo, progreso, posición, lectura original y preferencias de presentación por cuenta. También conserva la última respuesta de cada tarjeta: «Quiero repasarla pronto / Practice again soon» tiene prioridad en la próxima selección, las tarjetas nuevas van después y «La recordaba / I remembered it» queda al final; ninguna respuesta excluye una tarjeta. Los empates se ordenan al azar. La idea diaria se fija en común por fecha UTC. La fecha y el gasto se validan en servidor. Dobles clics, reintentos y dos sesiones no duplican gasto. Volver a entrar recupera el repaso; completarlo exige todas las tarjetas, incluidas las hijas.

La cuenta nueva empieza limpia. El progreso de la antigua prueba anónima se conserva en el navegador, sin borrarlo ni importarlo como verificado. El idioma sigue escribiéndose localmente. Sin sesión, también se conserva la preferencia de títulos originales en el navegador; con sesión se usa la preferencia de la cuenta.

La app está desplegada en producción. Recuperación de contraseña y revisión editorial siguen siendo cuestiones independientes del estado de creación de las barajas. Producción exige HTTPS y `REED_ORIGIN`. Ver ../docs/architecture/ACCOUNTS.md y ../docs/DEPLOYMENT.md.

Tarjetas editoriales propias y breves con fuentes de autores/editoriales; sin texto completo ni portadas comerciales. El campo `editorial_status` identifica la revisión editorial pendiente; no controla la visibilidad ni equivale al estado de creación `status`. Finanzas resume ideas de los autores, no ofrece asesoramiento.

Arquitectura, despliegue y limitaciones del controlador: ../docs/architecture/CATALOG.md. Contenido y próximos libros propuestos: ../content/catalog/README.md.

### Cerrar las notas de un libro leído

Al marcar un libro Leído, si quedan barajas propias en borrador se ofrece un diálogo con nombres y cantidades. Confirmar termina las no vacías y descarta las vacías (`archived`); Mantener en borrador conserva las barajas y el estado Leído. Barajas en borrador, junto al selector de lectura, permite recuperar el diálogo. Los borradores locales deben resolverse antes y pueden retomarse desde su fila. El cierre vuelve a la lista de origen sin entrar en repaso.

`POST /api/author/decks/finish-notes` valida el listado mostrado, propiedad, libro y recuentos bajo los mismos bloqueos de baraja que añadir notas. Es transaccional e idempotente; un conflicto exige revisar la lista actualizada.

`POST /api/author/notes` crea la baraja predeterminada y su primera nota de forma atómica. Nombre compartido en `app/note-defaults.mjs`; el idioma viaja con la nota y su borrador. El identificador estable permite reintentar sin duplicar. La creación manual de barajas sigue disponible por separado.

### Vocabulario de creación y repaso (17 de octubre de 2026)

Borrador no significa privado. Las barajas son visibles y repasables al guardarse; terminar cambia el estado de la propia baraja. Añadir tarjetas a una baraja en borrador conserva el progreso registrado; las tarjetas nuevas se pueden abrir desde el primer momento. Una nota sin guardar es contenido local del editor, no una baraja; se conserva por cuenta, libro y baraja en este navegador.
