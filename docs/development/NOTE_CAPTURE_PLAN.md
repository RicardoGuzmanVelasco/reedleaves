# Archivo histórico: tomar nota de un libro desde Inicio

> Este documento conserva el diseño y la implementación históricos del flujo de notas. Describe el modelo anterior basado en versiones y no es una especificación vigente. El modelo actual usa IDs estables de baraja y tarjeta; véase [ADR 0002](../adr/0002-barajas-en-catalogo-comun.md). El vocabulario actual es Borrador / Draft y Nota sin guardar; véase [DESIGN.md](../frontend/DESIGN.md).


Estado: happy path aprobado el 14 de octubre de 2026 e integrado para publicación en main tras compactar el botón y separar la mascota. La prioridad es llegar rápidamente a escribir sobre un libro concreto.

## Propuesta confirmada por el usuario

- Inicio muestra los libros que el usuario está leyendo o para los que mantiene alguna baraja propia en progreso, incluidas las vacías (ampliación acordada después del happy path).
- Los libros se ordenan por la nota añadida más recientemente: el último libro al que se añadió una nota aparece primero.
- Cada libro ofrece un botón con icono «+» para iniciar una nota.
- Happy path: existe exactamente una baraja propia en progreso para ese libro. El sistema resuelve el destino y abre directamente la pantalla de añadir una idea.

## Recorrido principal implementado

1. El usuario abre o recupera la app y llega a Inicio.
2. Identifica el libro concreto y pulsa su «+».
3. El sistema identifica la única baraja propia elegible, fija libro y versión y abre una nota nueva de idea, sin heredar la tarjeta de otra pantalla.
4. El usuario escribe título y texto en el editor existente y pulsa Guardar.
5. El libro pasa al primer lugar de Inicio al confirmar la nueva nota. Guardar y Cancelar devuelven a Inicio y recuperan el foco en el «+» del libro.

Desde Inicio con el libro visible: una pulsación hasta el editor. Desde fuera de la app: abrir la app y pulsar «+», dos pulsaciones si la app llega a Inicio. Desbloquear el dispositivo, desplazarse o volver a Inicio desde otra pantalla puede añadir acciones; esos casos no están incluidos en esa cifra.

## Hechos del modelo actual

- La lectura del libro usa `unread` / `reading` / `read` y es personal. Inicio conserva los libros `reading` o con alguna versión `draft` propia, incluso vacía. El repaso pendiente es independiente y no decide esta lista.
- El progreso de repaso y la posibilidad de añadir contenido son independientes. Se puede escribir únicamente en versiones `draft` de barajas propias. Los estados existentes de versión se presentan como «En progreso» (`draft`) y «Terminada» (`published`). Terminar congela la versión y es irreversible; el creador lo confirma explícitamente.
- El formulario vigente de idea exige título y cuerpo, y guarda mediante una acción explícita. Las notas guardan un borrador local por cuenta, libro y versión, recuperable tras recarga con el aviso «Borrador recuperado». Las citas no exigen título.
- Las nuevas notas registran `created_at`. La actividad de creación se agrega por libro y propietario de la baraja en el estado privado de la cuenta. Las notas antiguas mantienen NULL: no se inventa una fecha histórica.

### Primera nota sin configurar una baraja — incremento 1, aprobado el 15 de octubre

- Sustituye el paso previo Crear baraja cuando el «+» de Inicio no tiene ninguna versión propia draft. Abre Tomar nota directamente, inicialmente Idea, con aviso «Se creará una baraja con el nombre predeterminado «Notas de lectura»». Nombre localizado en el idioma de la app (Reading notes en inglés), compartido por cliente y servidor.
- La baraja y la primera nota se crean al guardar, en una única transacción. Cancelar no crea registros. La primera nota queda en nivel principal; no se pregunta dónde colocarla porque aún no hay tarjetas. Idea/Cita conserva el funcionamiento común.
- El idioma se toma de la app al abrir esta nota y se conserva con el borrador. No se infiere del idioma original del libro ni se añade un selector nuevo en este incremento.
- El borrador local conserva la creación pendiente y una referencia futura de versión derivada del identificador de petición. Puede recuperarse antes de existir la baraja, con el mismo texto, tipo, idioma e identidad para reintentar. Los borradores antiguos siguen siendo válidos.
- POST `/api/author/notes` reutiliza las escrituras de baraja y tarjeta dentro de una transacción; los endpoints manuales mantienen sus transacciones independientes. Sesión/CSRF, validación de libro/idioma/contenido y reintentos por identidad. No hay migraciones ni gasto de hojas. Al guardar, vuelve a Inicio y la siguiente nota reutiliza la baraja creada.
- El atajo de tomar nota tras marcar Leyendo/Leído desde Librería queda para el incremento 2, por petición expresa de abordar los casos por separado.

## Decisiones aprobadas — primera ronda

1. Se confirma que «baraja en progreso» significa aquí una baraja propia abierta a añadir notas y que, para esta entrega, su correspondencia técnica es una versión `draft`, independiente del progreso de repaso.
2. Se reutiliza el formulario actual de idea (título, cuerpo y guardado explícito) en este incremento de acceso rápido.
3. Guardar/cancelar una nota iniciada en Inicio devuelve al usuario a Inicio.

## Escenarios alternativos para después del happy path

### Indicados por el usuario

- Más de una baraja propia en progreso para el libro: implementado con popover de accesos recientes y «Ver todas»; publicación aprobada.
- La baraja no está en progreso: implementado en local con `draft` → `published`, visible como En progreso → Terminada. Se excluye de los destinos del «+»; si no quedan destinos se ofrece Crear baraja. Pendiente de publicación.
- El usuario quiere una cita: implementado en local con selector Idea / Cita dentro del editor; publicación aprobada.

### Derivados del recorrido y de las interrupciones discutidas

- El libro no tiene una baraja propia elegible: implementado en local: Crear baraja → Tomar nota automático; pendiente de revisión y publicación.
- La app se recupera en otra pantalla: contemplar el acceso a Inicio y el coste real de llegar al «+».
- El libro no está marcado leyendo o ya se ha terminado: decidir desde dónde se toma una nota fuera de Inicio.
- Inicio no tiene libros leyendo: definir la entrada al primer libro.
- Hay libros leyendo sin notas, o notas antiguas sin fecha: resuelto en este incremento: después de la actividad conocida, con el orden estable del catálogo.
- El móvil se bloquea, cambia la app activa o se cierra/recarga: recuperación local implementada con aviso explícito; pendiente de publicación. Sin sincronización de borradores entre dispositivos.
- Caduca la sesión o falla la conexión al guardar: conservar el texto y permitir reintentar sin duplicar la nota.

## Límites

Este incremento reutiliza el editor actual. Reutiliza los estados existentes de versión para terminar una baraja. No incluye reapertura, creación de nuevas versiones desde la interfaz, sincronización de borradores entre dispositivos, publicación automática de notas, accesos desde la pantalla bloqueada ni el rediseño del editor. El guardado local automático se limita a notas de idea/cita; Crear libro y Crear baraja conservan sus formularios en memoria.

## Implementación local

- «+» disponible por libro: cero destinos abre Crear baraja; una única versión `draft` propia abre directamente el editor; varias abren el popover de elección.
- Destino fijado en el formulario; una nota nueva empieza en el nivel principal, sin heredar otra tarjeta.
- Orden por la última nota creada en cualquiera de las barajas propias de ese libro. Editar, votar, guardar tarjetas ajenas y repasar no cuentan como creación de notas.
- Migraciones SQLite 17→18 y PostgreSQL 9→10: fecha nullable e índice por versión/fecha. Se conserva el contenido histórico.
- Un fallo conserva el formulario y el identificador de petición para reintentar. El borrador local de la nota permite recuperar texto y destino tras cerrar o recargar.
- Revisión manual en copia aislada: captura en una pulsación, guardado en la versión correcta y nivel principal, vuelta a Inicio, orden persistente tras recarga, cancelación sin creación y rechazo del servidor con texto conservado. Sin ejecutar la suite.

## Primer escenario alternativo: tomar una cita — publicación aprobada

1. El usuario pulsa «+» en el libro. El editor sigue entrando como Idea.
2. Pulsa Cita en el selector compartido. Es una pulsación adicional respecto al happy path.
3. El título deja de exigirse y se oculta. Texto, título previo, relación elegida y destino libro/versión permanecen en memoria al alternar tipos.
4. Guarda mediante el endpoint existente, con `isQuote:true`. El servidor deriva el título del texto como en la captura de citas actual; no se añade migración ni nuevo modelo.
5. Vuelve a Inicio, con el libro primero. Cancelar regresa sin crear tarjetas. Cada nota nueva vuelve a comenzar como Idea.

Revisión manual en copia aislada (4174): ida/vuelta Idea–Cita conserva el borrador; guardado de cita sin título en la versión correcta, como cita sin clasificar; fecha y orden de Inicio actualizados, sin gasto de hojas. Validación de texto vacío con mensaje específico y borrador conservado. Selector con teclado y tamaños 320/1280 px, sin desbordamiento. Sintaxis y build correctos; sin ejecutar la suite. Publicación aprobada.

## Editor compartido con autoría de barajas — publicación aprobada

- Una única acción «Tomar nota» sustituye a las dos acciones separadas de tarjeta/cita en la baraja.
- Reutiliza el mismo formulario y selector Idea / Cita de Inicio. El destino queda fijado al abrir también en autoría; cambiar el tipo conserva texto, título y relación elegida.
- El origen determina el regreso: Inicio → Inicio; baraja → misma baraja. Cancelar en autoría devuelve el foco al botón común.
- La validación de idea/cita es común. Crear libro y baraja conservan sus formularios propios.
- Revisado manualmente en la base de demostración; publicación aprobada.

### Acceso directo desde una baraja — aprobado el 15 de octubre

- «Tomar nota» desde el detalle de baraja, su repaso o gestión abre directamente el editor compartido. La baraja y versión ya están fijadas. Se valida que sea propia y esté en progreso, y se recupera su borrador local si existe. Una nota nueva comienza como Idea y en nivel principal.
- Guardar o cancelar mantiene la ruta de origen, restaura el detalle si estaba abierto y conserva árbol/preview, columnas, filtro, posición y foco en la acción. El editor muestra libro y baraja de destino. El retorno es propio de la entrada actual y no se guarda como parte del borrador.
- «Gestionar baraja» conserva el recorrido a las notas propias y a marcar la baraja como terminada. Esta navegación tiene un nombre distinto a la captura.
- La ficha del libro conserva solo «Ver barajas · N»; añadir allí «Tomar nota» queda expresamente pospuesto por el usuario.

- Ajuste visual posterior: selector compartido de 34 px e iconos de 14 px. Idea/Cita ajusta el ancho a su contenido; comparte medidas con vista/filtro de baraja y ajustes. Slider de columnas conserva la alineación con la misma altura.

## Segundo escenario alternativo: varias barajas — publicación aprobada

- Popover anclado al «+», con los títulos de las dos barajas propias editables donde el usuario añadió notas más recientemente y «Ver todas» abajo. Sin pantalla intermedia ni selección arbitraria.
- Los accesos requieren fecha de nota conocida. Barajas sin notas y notas históricas sin fecha siguen accesibles en la lista completa. La actividad de cualquier versión de la baraja determina su recencia; se ofrece una sola entrada reciente por baraja.
- «Ver todas» muestra todos los destinos propios editables del libro en el mismo popover; si una baraja tiene varios borradores, la lista completa muestra también el número de versión.
- Al elegir se fija el destino, se abre una idea en nivel principal y se muestra el nombre de la baraja. Idea/Cita comparten el editor; guardar o cancelar vuelve a Inicio. Escape/toque fuera cierra el popover y devuelve el foco al «+».
- Dos pulsaciones desde Inicio para empezar a escribir en un destino reciente (frente a una con un único destino). La lista completa añade una pulsación. Guardar sigue siendo explícito.
- La fecha por baraja se añade al estado privado de la cuenta, manteniendo el orden por libro. Se reutiliza created_at e índice existente, sin migración. Guardar una nota actualiza ambas recencias; votar, guardar tarjetas ajenas o repasar no cuentan.
- Revisado manualmente en copia aislada: destinos reales, lista completa, orden después de guardar/recargar, privacidad, cierre/foco y tamaños de pantalla. Publicación aprobada.

## Tercer escenario alternativo: cero barajas editables — local

1. El usuario pulsa «+» en su libro Leyendo; se abre Crear baraja.
2. Completa nombre, enfoque opcional e idioma en el formulario existente y confirma Crear baraja.
3. Se abre automáticamente Tomar nota en la nueva versión, como Idea y en nivel principal. Puede cambiar a Cita.
4. Guardar o cancelar devuelve a Inicio. La primera nota guardada actualiza el orden del libro.

- Cancelar antes de crear no añade barajas. Cancelar la nota conserva la baraja recién creada: la siguiente entrada ya usa el happy path.
- Libro y versión nueva quedan fijados. La creación utiliza su identificador idempotente; la nota tiene un identificador distinto. Un error conserva el formulario para corregir/reintentar.
- No cambia el ciclo de vida de las barajas ni el esquema. La creación sigue siendo explícita y conserva las opciones del editor de barajas vigente.
- Revisado manualmente en la copia local: cancelación, error, creación única, apertura automática, guardado en el destino correcto, orden y tamaños de pantalla. Pendiente de producción.

## Cuarto escenario alternativo: interrupción de la nota — local

- Idea y Cita guardan localmente título, texto, tipo, libro, versión, relación e identificador idempotente mientras se escribe. Se refuerza la captura al ocultar o abandonar la página, sin depender de ese último evento para conservar lo ya escrito.
- Un borrador por versión, bajo una clave de cuenta/libro. Inicio recupera el más reciente del libro al pulsar «+», antes de ofrecer destinos. Tomar nota recupera solo el borrador de esa versión. El acceso actual determina dónde se vuelve al terminar.
- El editor muestra «Borrador recuperado» / «Draft restored» y, desde Inicio, la baraja del borrador. No se abre automáticamente al arrancar la app.
- Guardar con confirmación del servidor o cancelar descarta ese borrador. Los errores conservan texto e identificador. Si el catálogo confirma que la tarjeta ya existe con ese identificador en esa versión, no se recupera como pendiente.
- Cambiar o cerrar sesión retira el formulario visible y conserva el borrador bajo su cuenta original. No hay sincronización entre dispositivos, navegadores u orígenes. Si el almacenamiento local falla, se informa; el respaldo en memoria sirve solo para la sesión actual.
- Si el destino deja de ser editable, se recupera el contenido con aviso y se impide guardar en ese destino; no se mueve la nota automáticamente.
- Revisión manual en copia aislada: recuperación tras recarga con título/cuerpo, cambio Idea/Cita y relación conservados; recuperación directa en libro con varias barajas; recuperación del mismo borrador desde autoría; guardado y cancelación seguidos de una nota nueva vacía. Móvil 320 px sin desbordamiento y escritorio. Sintaxis/build/diff correctos; sin añadir ni ejecutar la suite. Sin cambios de backend ni esquema. Pendiente de producción.

## Quinto escenario alternativo: baraja terminada — local

- Decisión del usuario: `draft` es En progreso y `published` es Terminada. La versión se congela definitivamente; no hay reapertura. El estado pertenece a la creación del contenido y es independiente de cuánto haya repasado cada cuenta.
- Copy aprobado: «Baraja en progreso» y «Sus tarjetas podrían cambiar», sin atribuir el aviso al creador. Se muestra en la ficha, edición y repaso; las piezas del catálogo muestran el estado compacto. Las versiones publicadas muestran «Terminada». ES/EN.
- El propietario dispone de «Marcar como terminada» en la vista de autoría. Confirmación con foco inicial en Cancelar y advertencia de irreversibilidad. Cancelar, Escape o toque exterior vuelve a la acción.
- No se puede terminar una versión vacía. Si hay una nota local pendiente de esa versión, se pide guardarla o cancelarla antes. Se vuelve a comprobar justo antes de confirmar. Los borradores pendientes en otros dispositivos conservan la recuperación con destino ya no editable.
- POST `/api/author/decks/finish`, con sesión/CSRF y validación de propiedad en servidor. Transacción y mismo bloqueo de versión que añadir tarjeta; reintento de una versión ya publicada devuelve éxito. Se reutilizan los triggers de inmutabilidad de SQLite/PostgreSQL, sin migración. No modifica tarjetas, repasos ni saldo.
- Tras confirmar se pasa a repaso, se ocultan controles de edición y se excluye la versión de destinos de notas. Los enlaces antiguos de autoría de una versión publicada llevan al repaso. Si falla la recarga del catálogo después de la confirmación, se conserva localmente el estado publicado confirmado y se muestra el error de conexión.
- Revisión manual en copia aislada 4174: estado en catálogo/ficha/autoría/repaso, cancelación y foco, finalización real persistida tras recarga, ausencia en recientes y lista completa del «+», nota local pendiente, versión vacía y enlace antiguo de autoría. Móvil 320 px y escritorio, sin desbordamiento. Sintaxis/build/diff correctos; sin añadir ni ejecutar la suite. Pendiente de publicación.

## Lectura del libro y trabajo pendiente — local

Regla única de Inicio: **leyendo el libro O alguna baraja propia en `draft`**. El usuario elige explícitamente contar también las barajas vacías.

| Lectura | Versiones propias en progreso | Inicio |
| --- | --- | --- |
| Leyendo | Ninguna o todas terminadas | Permanece |
| Leyendo | Una o varias | Permanece |
| Leído | Una o varias, incluso vacías | Permanece por sus notas |
| Leído | Ninguna o todas terminadas | Sale |
| Sin empezar | Alguna | Aparece por sus notas |
| Sin empezar | Ninguna | No aparece |

- El selector único Sin empezar / Leyendo / Leído en la ficha reutiliza el estado personal y el endpoint existentes. Cualquier cambio es explícito y reversible en ese selector. Todas las portadas abren la misma ficha; el «+» conserva la entrada directa al editor. Sin confirmación irreversible ni cambios de esquema. ES/EN y anuncio accesible.
- Marcar leído no termina ninguna baraja. Terminar una baraja no cambia la lectura. Terminar la última versión en progreso solo retira el libro si ya no está leyendo. No se deduce haber leído el original por completar notas o repasar.

### Cierre de notas al terminar la lectura — aprobado el 15 de octubre

- Tras confirmar Leído, si hay versiones propias draft, se abre un diálogo flotante «¿Marcar barajas como terminadas?». Explica la congelación y el descarte de vacías. Lista todas las versiones elegibles con nombre y cantidad de tarjetas; las vacías indican «Vacía (se descartará)».
- «Confirmar» procesa todo el listado en una transacción: las no vacías pasan a published; las vacías se descartan usando archived, sin borrado físico ni migración. «Mantener en progreso», Escape y toque fuera conservan las barajas y el estado Leído ya guardado. La ficha permite volver al diálogo desde Notas en progreso.
- El cierre vuelve a la lista de origen, conserva los estados de lectura y repaso y no abre el repaso. Si desaparece de Inicio por no quedar borradores propios, el foco vuelve al encabezado.
- Un borrador local bloquea la confirmación y ofrece Retomar borrador; guardar/cancelar vuelve a este diálogo con recuentos actualizados. El contexto de retorno no se persiste en el borrador.
- POST `/api/author/decks/finish-notes` valida sesión/CSRF, propiedad y libro de cada versión. Bloquea versiones en orden estable, compartiendo el bloqueo de añadir notas. Verifica los recuentos que el usuario vio antes de modificar nada: si hay cambios, devuelve conflicto y actualiza la lista para otra confirmación. Los reintentos de los mismos estados son idempotentes. El catálogo admite versiones archivadas vacías; siguen excluidas de las barajas disponibles y de Inicio.
- Solo cuentan versiones propias `draft`. Las barajas ajenas, las publicadas/archivadas, las guardadas y el progreso de repaso no retienen el libro. Salir de Inicio conserva el libro en Biblioteca y su contenido/repasos. Crear una nueva baraja propia lo hace volver y no cambia automáticamente un libro leído a Leyendo.
- Inicio explica la presencia dentro de la cubierta: Leyendo/Leído y, si hay versiones draft propias, Notas en progreso en otra línea. Ambas van apiladas y ancladas abajo a la izquierda (solo Notas en progreso si no está empezado). Los guardas de entrada del «+» usan la misma regla de visibilidad, por lo que se puede seguir escribiendo sobre un libro leído.
- Orden por la última nota creada, sin moverlo por cambiar la lectura o terminar una baraja. Con un libro Leyendo sin destinos propios abiertos, «+» conserva Crear baraja → Tomar nota.
- Arista pendiente: una baraja vacía retiene el libro pero no se puede publicar vacía. Se propone resolver el descarte de una baraja vacía como otro caso de uso; no se descarta automáticamente ni se cambia la decisión del usuario.
- Revisión manual en copia aislada: marcar Leído/revertir, persistencia tras recarga, conservar leído con notas y abrir editor desde «+», terminar única baraja sin cambiar Leyendo, cero destinos abre Crear baraja, marcar Leído sin destinos propios retira de Inicio aunque haya barajas ajenas draft, crear una propia vacía devuelve el libro leído y abre su editor. Móvil 320 px sin desbordamiento. Build/sintaxis/diff correctos; sin añadir ni ejecutar la suite. Pendiente de producción.

## Acceso estable a la información y lectura — local

- Las portadas siempre abren la información del libro; el progreso de repaso deja de decidir el destino del toque. «+» mantiene su caso de uso de tomar nota. Ver barajas continúa hacia las barajas desde la ficha.
- Un selector compacto con texto e icono para cada estado, situado junto a título/autor, sustituye los controles de lectura anteriores. Sin empezar usa libro cerrado, Leyendo libro abierto y Leído libro con check. Permite pasar directamente entre los tres estados y conserva permisos de solo lectura.
- Marcar Leído desde Inicio conserva abierta la ficha aunque el libro deje de ser elegible, permitiendo corregir el cambio antes de cerrar. Cierre con foco de retorno seguro; fallos visibles junto al selector. Las reglas de pertenencia y orden de Inicio se mantienen.

### Atajo de toma de nota desde Librería — incremento 2, implementación local

- Al cambiar un libro a Leyendo o Leído en su ficha abierta desde Librería, aparece allí una invitación discreta «¿Quieres tomar una nota de este libro?» con la acción «Tomar nota».
- La entrada reusa el editor compartido: recupera un borrador del libro si existe; con cero destinos crea «Notas de lectura» al guardar; con un destino abre directamente; con varios permite elegir las dos barajas recientes o ver todas.
- Cancelar vuelve a la misma ficha y devuelve el foco al atajo. Guardar también conserva la ficha, actualiza su recuento y retira la invitación. El cambio de estado fallido no muestra la invitación.
- Si marcar Leído abre el diálogo existente de cierre de barajas, la invitación queda disponible en la ficha al elegir «Mantener en progreso». Confirmar el cierre cierra la ficha y descarta el contexto temporal de invitación.
- Solo aparece tras cambios de estado iniciados desde Librería, no al cambiar lectura desde otras fichas. No consume hojas ni necesita migración.
- Revisión manual en demo SQLite aislada: estado Leyendo y Leído sin baraja propia, creación de la primera baraja/nota y regreso, destino múltiple, cancelar con retorno/foco, y convivencia con el diálogo de cierre al marcar Leído. Build/sintaxis/diff correctos; sin ejecutar la suite. Pendiente de revisión del usuario.
