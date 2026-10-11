# Reedleaves

Catálogo real: cinco libros, seis barajas y 42 cartas. Cada baraja tiene un idioma original y puede añadir traducciones. Reedleaves es el nombre oficial del proyecto, la web y la app; logo y mascota aprobados sin cambios. Lemas: «Read. Plant a seed.» y «De hoja a hoja».

## Ejecutar

Node 24.15 o superior (rama 24), sin dependencias externas:

```sh
npm start
```

Abrir http://127.0.0.1:4173/app/. La primera ejecución crea y carga SQLite; las siguientes conservan los datos existentes. El servidor estático de Python ya no basta: la interfaz necesita la API.

## Recorrido

- Sin sesión: entrar o crear cuenta con usuario y contraseña; se pueden explorar los libros sin registrarse. El repaso necesita cuenta.
- Inicio con sesión muestra los libros con repasos pendientes como libros cerrados: portada, lomo y canto de páginas. Elegir una baraja la añade sin gastar hojas; se recuperan también los repasos ya empezados. El árbol solo aparece al entrar en el repaso.
- Cabecera: logo, hoja con saldo numérico y ajustes de idioma, títulos originales y cuenta. Sin lemas ni texto del saldo.
- Librería (Library / Librairie) es el catálogo completo. «Ir a mi biblioteca» (Go to my bookshelf) abre Biblioteca (Bookshelf / Bibliothèque), con libros propios, marcados como leyendo o leídos, barajas elegidas e historial de repaso. Dos filtros combinables separan lectura original y repaso; cada libro aparece una sola vez. Idea del día queda como acceso secundario, fuera de Inicio.
- Una idea aleatoria al día, estable tras recarga, idioma y cambio de filtros.
- Seis grupos: leyendo, leídos, repasando, repasados, intereses y todos. Unión sin duplicar; Todos sustituye al resto.
- Géneros recibidos de la base: crecimiento personal, finanzas y productividad.
- Librería, accesible desde «Añadir libro»: cuadrícula de libros cerrados con título, autor, intereses y número de barajas. Pulsar abre su ficha modal; ahí se consulta la descripción, se marca la lectura del original y se accede a las barajas. La navegación no gasta hojas ni elige una baraja automáticamente.
- Elegir una baraja por libro: creador, enfoque, cartas y profundidad. Recomendación del equipo y ganadoras reales, sin duplicados ni premios con cero actividad.
- Ganar una hoja al día y acumular hasta tres. Se pueden gastar varias el mismo día: hermana siguiente o hija cuestan una hoja si son nuevas. Volver a cartas repasadas es gratis. Los días ausentes suman hasta el máximo, sin guardar un exceso pendiente.
- Los filtros afectan al siguiente día una vez asignada la idea de hoy, pendiente de confirmación.
- Crear barajas personales desde las barajas de un libro. Añadir tarjetas o quotes con padre opcional, en el idioma de la baraja. La autoría es gratuita; el repaso mantiene las hojas.
- Quotes diferenciadas y filtro «Solo quotes». Las sueltas aparecen bajo «Quotes sin clasificar», sin carta ficticia en la base.
- Sin publicación del contenido personal, rachas ni tareas. El selector y el repaso admiten barajas anidadas.

Lectura original y repaso son independientes. Una tarjeta aleatoria no desbloquea esa posición en el repaso. Los números de tarjetas no están fijados en la interfaz: cada libro usa sus datos de la API.

## Datos y código

Crear libro ofrece «Autorellenar con IA»: título (autor e idioma original opcionales para la búsqueda), spinner y vista previa. La IA busca fuentes y propone título original, autor, idioma original, títulos completos/cortos, descripciones y notas en español, inglés y francés, intereses del catálogo y enlaces verificados disponibles. La ficha permite consultar traducciones y fuentes; «Editar» conserva el borrador y ofrece los metadatos en controles plegados. Repetir el autorellenado completa huecos sin sustituir valores ya escritos. Solo «Crear libro» persiste la propuesta; cancelar la descarta. La creación manual continúa disponible.

La integración requiere `OPENAI_API_KEY` en el servidor. Ver [configuración](../docs/deployment/render.md). Las pruebas usan un proveedor simulado, sin llamadas de pago. El prompt y el esquema están en `server/book-autofill.mjs`; no se comparte el contexto de esta conversación.

Los libros propios ya creados muestran un icono de información pendiente en Inicio, Librería, Biblioteca y la ficha si faltan títulos completos/cortos o descripciones ES/EN/FR, o intereses. Pulsarlo abre «Completar información», reutiliza la búsqueda y vista previa, y ofrece «Guardar» para completar el mismo libro. Identidad y datos previos son de solo lectura; los campos nuevos se pueden corregir. El servidor combina la propuesta con los datos más recientes bajo bloqueo y conserva los valores existentes, también si otra sesión ha completado el libro. Los reintentos no duplican datos ni alteran barajas, progreso o saldo. Enlaces, fuentes y notas opcionales no mantienen el indicador. Solo el creador puede completar sus libros; no hay migración.

Contenido editable: content/catalog/*.csv. Datos activos: var/catalog.sqlite, con libros, barajas, versiones, árboles y fuentes. SQLite v12 y PostgreSQL v4. La actualización desde v9/v1 conserva cuentas, cartas y progreso; añade quotes, libros personales y la preferencia de títulos originales. HTTP JSON es transporte, no almacenamiento del catálogo.

Backend: server/database.mjs, seed.mjs, catalog-repository.mjs, author-repository.mjs, auth.mjs, reader-repository.mjs, reader-api.mjs y http.mjs.

Frontend: catalog.mjs (API), account-client.mjs (sesión y cambios confirmados), rhythm.mjs (reglas de filtros y compatibilidad antigua), wallet.mjs (reglas de saldo compartidas con servidor), decks.mjs (selección y árbol), storage.mjs (idioma y lectura del estado antiguo, sin progreso actual), views.mjs (HTML), i18n.mjs (copy), reader-app.mjs (interacción) y reader.mjs (entrada).

La base y los CSV no se sirven por HTTP. Los JSON/NDJSON antiguos se conservan solo en fixtures de pruebas.

Editar contenido y actualizar explícitamente:

```sh
npm run db:seed
npm run db:check
npm test
```

Pruebas automatizadas: integridad SQL, persistencia, backup, rollback, API, formatos de idioma, filtros, cupo compartido, varias barajas, jerarquía, votos y versiones inmutables.

## Límites actuales

El backend guarda saldo, progreso, posición, lectura original, preferencias e idea diaria por cuenta. La fecha y el gasto se validan en servidor. Dobles clics, reintentos y dos sesiones no duplican gasto. Volver a entrar recupera el repaso; completarlo exige todas las cartas, incluidas las hijas.

La cuenta nueva empieza limpia. El progreso de la antigua prueba anónima se conserva en el navegador, sin borrarlo ni importarlo como verificado. El idioma sigue escribiéndose localmente. Sin sesión, también se conserva la preferencia de títulos originales en el navegador; con sesión se usa la preferencia de la cuenta.

Esta entrega no publica la app. Para otro dispositivo hace falta un servidor accesible; antes de publicar faltan recuperación de contraseña, operación y revisión de contenido. Producción exige HTTPS y `REED_ORIGIN`. Ver ../docs/architecture/ACCOUNTS.md y ../docs/DEPLOYMENT.md.

Tarjetas editoriales propias y breves con fuentes de autores/editoriales; sin texto completo ni portadas comerciales. Son borradores pendientes de revisión antes de publicar. Finanzas resume ideas de los autores, no ofrece asesoramiento.

Arquitectura, despliegue y limitaciones del controlador: ../docs/architecture/CATALOG.md. Contenido y próximos libros propuestos: ../content/catalog/README.md.
