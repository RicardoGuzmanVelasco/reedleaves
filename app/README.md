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
- Inicio con sesión muestra solo los libros marcados Leyendo, ordenados por la última nota creada en una baraja propia (sin fecha: orden estable del catálogo), como libros cerrados: portada, lomo y canto de páginas. El «+» abre directamente el editor de idea si existe una única versión draft propia; título, texto y guardado explícito. El selector Idea / Cita permite cambiar el tipo sin perder el borrador; cita no exige título y guarda con el modelo de citas existente. La entrada de cada nota nueva sigue siendo Idea. Guardar o cancelar vuelve a Inicio. Elegir una baraja la añade sin gastar hojas; se recuperan también los repasos ya empezados. El árbol solo aparece al entrar en el repaso.
- Cabecera: logo, hoja con saldo numérico y ajustes de idioma, títulos originales y cuenta. Sin lemas ni texto del saldo.
- Librería (Library / Librairie) es el catálogo completo. «Ver biblioteca» desde el perfil abre Biblioteca (Bookshelf / Bibliothèque), con libros propios, marcados como leyendo o leídos, barajas elegidas e historial de repaso. Dos filtros combinables separan lectura original y repaso; cada libro aparece una sola vez. Inicio muestra una fila de tres botones encima de los libros: «Ir a mi perfil», «Idea del día» e «Ir a la librería», con este último en verde como acción principal.
- Una idea aleatoria al día, estable tras recarga, idioma y cambio de filtros.
- Seis grupos: leyendo, leídos, repasando, repasados, intereses y todos. Unión sin duplicar; Todos sustituye al resto.
- Géneros recibidos de la base: crecimiento personal, finanzas y productividad.
- Librería, accesible desde «Ir a la librería»: cuadrícula de libros cerrados con título, autor, intereses y número de barajas. Pulsar abre su ficha modal; ahí se consulta la descripción, se marca la lectura del original y se accede a las barajas. La navegación no gasta hojas ni elige una baraja automáticamente.
- Elegir una baraja por libro: creador, enfoque, tarjetas y profundidad. Recomendación del equipo y ganadoras reales, sin duplicados ni premios con cero actividad.
- Ganar una hoja al día y acumular hasta tres. Se pueden gastar varias el mismo día: hermana siguiente o hija cuestan una hoja si son nuevas. Volver a tarjetas repasadas es gratis. Los días ausentes suman hasta el máximo, sin guardar un exceso pendiente.
- Los filtros afectan al siguiente día una vez asignada la idea de hoy, pendiente de confirmación.
- Crear barajas personales desde las barajas de un libro. «Añadir contenido» abre el editor compartido con Inicio, con selector Idea / Cita y relación opcional «Colocar debajo de». Alternar conserva título, texto y relación; destino libro/versión fijo. Guardar/cancelar desde la baraja regresa a esa baraja. El contenido se guarda en el idioma de la baraja. La autoría es gratuita; el repaso mantiene las hojas.
- Citas en azul pastel y EB Garamond regular; fuente WOFF2 local con alternativa serif. Filtro «Solo citas». Las sueltas aparecen bajo «Citas sin clasificar», sin tarjeta ficticia en la base.
- Guardar o quitar una tarjeta desde su vista exclusiva. «Guardadas» en las barajas del libro abre una selección privada de tarjetas y citas de distintas barajas, más recientes primero. Mantiene el filtro de citas y permite reabrir gratuitamente las guardadas desde Idea del día. Guardar y abrir no gastan hojas ni desbloquean posiciones del repaso.
- Me gusta, no me gusta y guardar tienen respuesta optimista con React `useOptimistic` y Actions. El servidor confirma destinos absolutos; ante errores se recupera el estado confirmado y se ofrece reintento. La autoría propia permite guardar, pero no votar.
- Lectura protagonista: papel elevado por capas, fondo iluminado, entrada breve y texto progresivo a 4 ms por carácter, con un máximo aproximado de 2,5 segundos. El contenido completo permanece accesible; movimiento reducido omite la animación. La presentación se comparte entre repaso, autoría e idea del día.
- Sin publicación del contenido personal, rachas ni tareas. El selector y el repaso admiten barajas anidadas.

Lectura original y repaso son independientes. Una tarjeta aleatoria no desbloquea esa posición en el repaso. Los números de tarjetas no están fijados en la interfaz: cada libro usa sus datos de la API.

## Datos y código

Crear libro ofrece «Rellenar con IA»: título (autor e idioma original opcionales para la búsqueda), indicador de carga y vista previa. La IA busca fuentes y propone título original, autor, idioma original, títulos completos/cortos, descripciones y notas en español e inglés, intereses del catálogo y enlaces verificados disponibles. La ficha permite consultar traducciones y fuentes; «Editar» conserva el borrador y ofrece los metadatos en controles plegados. Repetir la búsqueda con IA completa huecos sin sustituir valores ya escritos. Solo «Crear libro» persiste la propuesta; cancelar la descarta. La creación manual continúa disponible.

La integración requiere `OPENAI_API_KEY` en el servidor. Ver [configuración](../docs/deployment/render.md). Las pruebas usan un proveedor simulado, sin llamadas de pago. El prompt y el esquema están en `server/book-autofill.mjs`; no se comparte el contexto de esta conversación.

Los libros propios ya creados muestran un icono de información pendiente en Inicio, Librería, Biblioteca y la ficha si faltan títulos completos/cortos o descripciones ES/EN, o intereses. Pulsarlo abre «Completar información», reutiliza la búsqueda y vista previa, y ofrece «Guardar» para completar el mismo libro. Identidad y datos previos son de solo lectura; los campos nuevos se pueden corregir. El servidor combina la propuesta con los datos más recientes bajo bloqueo y conserva los valores existentes, también si otra sesión ha completado el libro. Los reintentos no duplican datos ni alteran barajas, progreso o saldo. Enlaces, fuentes y notas opcionales no mantienen el indicador. Solo el creador puede completar sus libros; no hay migración.

Contenido editable: content/catalog/*.csv. Datos activos: var/catalog.sqlite, con libros, barajas, versiones, árboles y fuentes. SQLite v18 y PostgreSQL v10. Las migraciones conservan cuentas, tarjetas y progreso; la última añade `cards.created_at` nullable e índice de actividad de notas. Las notas históricas mantienen fecha desconocida. HTTP JSON es transporte, no almacenamiento del catálogo.

Backend: server/database.mjs, seed.mjs, catalog-repository.mjs, author-repository.mjs, auth.mjs, reader-repository.mjs, reader-api.mjs y http.mjs.

Frontend: catalog.mjs (API), account-client.mjs (sesión y colas de peticiones), card-features.jsx (acciones y guardadas mediante portales React), card-interactions.mjs (reducer optimista y transporte), card-types.mjs (título, semántica e icono por tipo), card-themes.css (paleta y tipografía, incluidas las acciones), rhythm.mjs (filtros y compatibilidad antigua), wallet.mjs (saldo compartido con servidor), decks.mjs (selección y árbol), storage.mjs (idioma y lectura antigua), views.mjs (render común), i18n.mjs (copy), reader-app.mjs (interacción) y reader.mjs (entrada).

La base y los CSV no se sirven por HTTP. Los JSON/NDJSON antiguos se conservan solo en fixtures de pruebas.

Editar contenido y actualizar explícitamente:

```sh
npm run db:seed
npm run db:check
npm test
```

Pruebas automatizadas: integridad SQL, persistencia, backup, rollback, API, formatos de idioma, filtros, cupo compartido, varias barajas, jerarquía, votos y versiones inmutables.

## Límites actuales

El backend guarda saldo, progreso, posición, lectura original, preferencias e idea diaria por cuenta. La fecha y el gasto se validan en servidor. Dobles clics, reintentos y dos sesiones no duplican gasto. Volver a entrar recupera el repaso; completarlo exige todas las tarjetas, incluidas las hijas.

La cuenta nueva empieza limpia. El progreso de la antigua prueba anónima se conserva en el navegador, sin borrarlo ni importarlo como verificado. El idioma sigue escribiéndose localmente. Sin sesión, también se conserva la preferencia de títulos originales en el navegador; con sesión se usa la preferencia de la cuenta.

Esta entrega no publica la app. Para otro dispositivo hace falta un servidor accesible; antes de publicar faltan recuperación de contraseña, operación y revisión de contenido. Producción exige HTTPS y `REED_ORIGIN`. Ver ../docs/architecture/ACCOUNTS.md y ../docs/DEPLOYMENT.md.

Tarjetas editoriales propias y breves con fuentes de autores/editoriales; sin texto completo ni portadas comerciales. Son borradores pendientes de revisión antes de publicar. Finanzas resume ideas de los autores, no ofrece asesoramiento.

Arquitectura, despliegue y limitaciones del controlador: ../docs/architecture/CATALOG.md. Contenido y próximos libros propuestos: ../content/catalog/README.md.
