# Tomar nota de un libro desde Inicio

Estado: happy path aprobado e implementado en local el 14 de octubre de 2026. Pendiente de revisión del usuario y publicación. La prioridad es llegar rápidamente a escribir sobre un libro concreto.

## Propuesta confirmada por el usuario

- Inicio muestra únicamente los libros que el usuario está leyendo.
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

- Ya existe el estado manual del libro `reading`. Inicio pasa a usar ese estado de lectura, independiente de las barajas con repaso pendiente.
- El progreso de repaso y la posibilidad de añadir contenido son independientes. Se puede escribir únicamente en versiones `draft` de barajas propias. No existe todavía un estado independiente de escritura «en progreso / cerrada».
- El formulario vigente de idea exige título y cuerpo, y guarda mediante una acción explícita. Su borrador vive en memoria: no hay autosave ni recuperación tras recarga. Las citas no exigen título.
- Las nuevas notas registran `created_at`. La actividad de creación se agrega por libro y propietario de la baraja en el estado privado de la cuenta. Las notas antiguas mantienen NULL: no se inventa una fecha histórica.

## Decisiones aprobadas — primera ronda

1. Se confirma que «baraja en progreso» significa aquí una baraja propia abierta a añadir notas y que, para esta entrega, su correspondencia técnica es una versión `draft`, independiente del progreso de repaso.
2. Se reutiliza el formulario actual de idea (título, cuerpo y guardado explícito) en este incremento de acceso rápido.
3. Guardar/cancelar una nota iniciada en Inicio devuelve al usuario a Inicio.

## Escenarios alternativos para después del happy path

### Indicados por el usuario

- Más de una baraja propia en progreso para el libro: resolver la elección de destino.
- La baraja no está en progreso: definir el estado de escritura cerrado y qué ocurre al intentar añadir contenido.
- El usuario quiere una cita: permitir cambiar el tipo de nota o acceder a la captura de cita.

### Derivados del recorrido y de las interrupciones discutidas

- El libro no tiene una baraja propia elegible: definir cómo crearla o elegir un destino.
- La app se recupera en otra pantalla: contemplar el acceso a Inicio y el coste real de llegar al «+».
- El libro no está marcado leyendo o ya se ha terminado: decidir desde dónde se toma una nota fuera de Inicio.
- Inicio no tiene libros leyendo: definir la entrada al primer libro.
- Hay libros leyendo sin notas, o notas antiguas sin fecha: resuelto en este incremento: después de la actividad conocida, con el orden estable del catálogo.
- El móvil se bloquea, cambia la app activa o se cierra/recarga: recuperar la captura sin perder texto ni destino.
- Caduca la sesión o falla la conexión al guardar: conservar el texto y permitir reintentar sin duplicar la nota.

## Límites

Este incremento reutiliza el editor actual. No incluye un nuevo ciclo de vida de barajas, autosave, publicación de notas, accesos desde la pantalla bloqueada ni el rediseño del editor.

## Implementación local

- «+» visible por libro. Solo se habilita con una única versión `draft` propia; cero o varios destinos quedan pendientes, con explicación accesible.
- Destino fijado en el formulario; una nota nueva empieza en el nivel principal, sin heredar otra tarjeta.
- Orden por la última nota creada en cualquiera de las barajas propias de ese libro. Editar, votar, guardar tarjetas ajenas y repasar no cuentan como creación de notas.
- Migraciones SQLite 17→18 y PostgreSQL 9→10: fecha nullable e índice por versión/fecha. Se conserva el contenido histórico.
- Un fallo conserva el formulario en memoria y el identificador de petición para reintentar. Cerrar o recargar sigue sin recuperar el borrador.
- Revisión manual en copia aislada: captura en una pulsación, guardado en la versión correcta y nivel principal, vuelta a Inicio, orden persistente tras recarga, cancelación sin creación y rechazo del servidor con texto conservado. Sin ejecutar la suite.
