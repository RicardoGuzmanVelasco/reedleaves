# Dirección de diseño

## Producto

Reedleaves es el nombre oficial del proyecto, la web y la app de repaso de ideas de libros de crecimiento personal. Usar siempre esta escritura, sin traducirla ni separar las palabras. Cada libro admite varias barajas creadas por usuarios. Cada baraja contiene un árbol de cartas. El usuario elige su recorrido en anchura o profundidad y recibe una idea aleatoria al día.

Logo y mascota quedan aprobados. El trabajo activo pasa a la funcionalidad: `app/index.html`, con cinco libros, seis barajas y 42 cartas. Los 7 hábitos conserva sus siete principales en nuestra baraja original y ofrece una segunda organización en dos niveles. Ver `docs/frontend/READER_SPIKE.md` y `docs/architecture/CATALOG.md`.

## Principios no negociables

1. **Simplicidad funcional.** Una pantalla, una decisión principal.
2. **Pomposidad estética.** La app debe sentirse viva, juguetona y recompensante, con el nivel de expresividad de productos como Duolingo o Forest.
3. **Pocos casos de uso.** Priorizar descubrir un libro, recorrer sus tarjetas y recibir la tarjeta del día.

Estas reglas aplican a dirección de arte, UX, animaciones, copy y componentes. Cualquier ampliación futura debe conservarlas.

## Modelo actual

- Libro: título, autor e intereses; varias barajas, no un único árbol.
- Baraja: libro, usuario creador, enfoque y versiones del árbol. Cartas y profundidad se calculan.
- Carta: versión, padre, título, texto, orden entre hermanas y etiqueta `isQuote`.
- Quote: carta con tratamiento visual de cita y filtro propio. Puede tener padre. Si no lo tiene, conserva `parentId: null` y aparece dentro de «Citas sin clasificar», un grupo virtual que no se guarda como carta.
- Hoja: una unidad de avance; una carta nueva cuesta una hoja, también si es hija. El abono diario acumula hasta tres; un ajuste manual puede superar ese saldo y se conserva hasta gastarlo.
- `DailyCard`: una idea aleatoria del día, independiente del avance del repaso.
- Lectura del libro original: sin empezar, leyendo o leído; selección manual.
- Repaso: cartas vistas por usuario y versión. Termina al recorrer todas, incluidas las hijas.

La estructura sigue siendo plana, textual y portable. Las cuentas pueden crear barajas personales y añadir contenido mientras leen.

## UX base

- Sin sesión: acceso con usuario y contraseña y opción de crear cuenta. Dos campos con etiquetas, errores breves y exploración del catálogo sin cuenta. No añadir correo, confirmación de contraseña ni proveedores. Al entrar, retomar la baraja solicitada; no gastar una hoja al registrarse.
- Inicio: solo libros con repasos activos, representados como libros cerrados. Contenedor propio con portada, lomo y canto de páginas; no un icono de libro dentro de una tarjeta genérica. Un libro por contenedor, aunque tenga varios repasos activos. Sin árbol, tarjeta diaria, lemas ni título visible redundante. Una baraja elegida aparece aunque aún no se haya gastado su primera hoja; las terminadas se consultan desde Biblioteca.
- «Ver biblioteca» desde el perfil abre una pantalla propia: Biblioteca / Bookshelf / Bibliothèque. Incluye libros marcados como leyendo o leídos, con barajas elegidas, con historial de repaso o contenido personal. Las recomendaciones sin relación con la cuenta quedan en Librería.
- Biblioteca tiene dos filtros independientes: lectura original (todos, sin empezar, leyendo, leído) y repaso (todos, pendientes, sin repasar, terminados). Se combinan por intersección y se conservan al abrir fichas, visitar barajas y volver o cambiar el idioma; se reinician al recargar o cambiar de cuenta. «Sin repasar» significa que no se ha abierto ninguna carta, aunque haya una baraja elegida.
- Cada libro aparece una sola vez en Biblioteca: primero Repasos pendientes si tiene alguna baraja activa, después Sin repasar y finalmente Repasos terminados. Un libro con una baraja terminada y otra pendiente cumple ambos filtros de repaso, pero solo aparece en el grupo pendiente. La lectura original sigue siendo independiente. Las barajas propias vacías elegidas cuentan como pendientes.
- Biblioteca reutiliza las portadas y fichas de Librería para consultar y cambiar la lectura original, y acceder a las barajas. «Ir a la librería» abre Librería con un único regreso «← Biblioteca». No mostrar filtros en Inicio ni añadir otra navegación permanente en la cabecera.
- Pulsar un libro con un solo repaso activo abre directamente su recorrido, sin gastar hojas. Si tiene varios, abre sus barajas para elegir. El árbol solo se muestra dentro del repaso.
- Cabecera: logo sin texto, icono de hoja con saldo numérico y botón de ajustes. Idioma y «Mostrar títulos originales» dentro de ajustes; etiquetas accesibles sin texto adicional visible.
- El logo es el único acceso a Inicio. No repetir «← Inicio» en Librería, Biblioteca, idea del día, acceso ni selección de barajas. Mantener un único regreso al contexto cuando sea distinto: Librería, Biblioteca o Idea del día desde las barajas del libro, Barajas desde el álbum y Baraja desde una carta. Conservar ese origen durante el recorrido y la recarga. Al volver a una lista, recuperar posición y foco si el libro sigue visible.
- Inicio muestra los accesos «Ir a mi perfil», «Idea del día» e «Ir a la librería» en una única fila encima de los libros, también cuando no hay repasos pendientes. Botones de la misma altura; Idea del día usa el botón verde principal y los otros dos, botones claros con borde continuo. En móvil pueden partir sus etiquetas en varias líneas sin truncarlas ni apilar los accesos.
- Idea del día: acceso principal desde Inicio. Conserva el sorteo y la acción de repasar el libro, en su propia pantalla. La composición pone un encabezado discreto y la carta protagonista primero, deja «Repasar este libro» debajo y pliega los filtros al final. El texto aparece completo desde el inicio; la carta conserva una entrada breve.
- Sorteo: filtros plegados con leyendo, leídos, repasando, repasados, intereses y todos los libros. Los grupos se unen sin duplicar candidatos. «Todos» sustituye al resto.
- Una idea aleatoria por fecha de la cuenta, calculada en servidor, estable al recargar y cambiar de idioma. Una vez asignada, los filtros afectan al siguiente día; esta decisión está pendiente de confirmación.
- Repasar un libro abre primero una cuadrícula compacta de barajas: título, usuario creador, recomendación, idioma, cartas y niveles. «Creada por» y el nombre del usuario aparecen bajo el título, sin truncar el nombre. Al elegir una se abre una ficha modal con autor, enfoque, métricas, progreso y «Repasar esta baraja».
- Recomendación del equipo primero. Más popular = personas que empezaron; preferida = más me gusta; más terminada = personas que terminaron. Deduplicar ganadoras y no conceder etiquetas con cero actividad.
- Pantalla de baraja: solo el álbum, título, usuario creador, libro, idioma y progreso (cartas repasadas sobre el total y porcentaje). «Creada por» y el nombre del usuario se muestran bajo el título en todas las barajas, también las propias y durante la autoría. Un único regreso a las barajas del libro; Inicio sigue accesible por el logo. Sin tarjeta preseleccionada, vista de lectura incrustada, leyenda, cabecera repetida ni mascota extra. El progreso cuenta todas las cartas, incluidas hijas y quotes, también durante la autoría.
- Abrir una carta del álbum lleva a una pantalla de lectura con un único regreso «← Baraja», sin repetir álbum ni progreso. Volver conserva el filtro, la posición y el foco en la carta. Entrar, continuar o recargar una baraja abre el álbum; solo los enlaces explícitos a cartas ya repasadas abren su lectura. Guardar contenido vuelve al álbum, sin abrir la nueva carta.
- Lectura: carta protagonista sobre un fondo iluminado, con papel elevado y capas posteriores. Entrada breve al abrir; después queda quieta para leer. El texto aparece progresivamente, con «Mostrar texto completo» accesible desde arriba durante la animación. Reservar el espacio final, ofrecer el texto completo a lectores de pantalla y omitir la animación con movimiento reducido. Usar la misma presentación en repaso, autoría e idea del día; las quotes usan papel azul pastel y EB Garamond regular. Alinear el cuerpo al inicio para evitar huecos variables, sobre todo con Courier; conservar el guionado automático según el idioma del contenido. Las actualizaciones de estado no repiten la animación de una carta ya abierta.
- Repasar: una hoja nueva por fecha local, acumulable hasta tres. Se pueden gastar las acumuladas el mismo día. El árbol completo se despliega de arriba hacia abajo y usa el scroll vertical de la página. Cartas ya repasadas se pueden abrir gratis; las siguientes válidas muestran el coste de una hoja; el resto aparece bloqueado y sin título visible.
- La divisa «hoja» usa una hoja única grande, sin círculo, rayitas ni cara; distinta de la mascota de dos hojas. En la cabecera aparece junto al saldo numérico, sin texto.
- No saltar a hijas sin ver su madre ni a hermanas posteriores sin la anterior. El orden no obliga a terminar las hijas antes de pasar al bloque siguiente.
- Ver una idea aleatoria no desbloquea esa posición en el repaso.
- Lectura y repaso son independientes: un libro puede estar leído y repasándose.
- Catálogo actual: cinco libros con cantidades de tarjetas distintas. El número y los géneros proceden de la API, nunca de condiciones específicas en la interfaz.
- Librería (Library en inglés): catálogo completo, accesible mediante «Ir a la librería». Cuadrícula de todos los libros disponibles, usando el mismo contenedor de libro cerrado de Inicio. Título, autor, intereses y número de barajas; sin formularios en la cuadrícula. Pulsar abre una ficha modal con título completo, descripción, intereses, número de barajas, idiomas de estas y «Ver barajas». La lectura original manual y el estado de repaso automático quedan en la ficha. Misma familia visual y comportamiento modal que las barajas; sin portadas comerciales ni iconos de libro dentro de tarjetas genéricas.
- Desde la ficha se pasa a las barajas del libro, con acceso de vuelta al catálogo. Explorar libros y barajas no añade un repaso ni gasta hojas; eso ocurre al elegir una baraja y abrir cartas, respectivamente.
- Catálogo: un único campo de búsqueda que filtra al escribir. Busca en todos los títulos completos, cortos y originales, en cualquier idioma disponible; ignora mayúsculas, tildes y puntuación. No busca en autores ni descripciones. La búsqueda se conserva al cerrar la ficha, volver de las barajas o cambiar el idioma; se borra al recargar. Sin resultados: mensaje breve y acción para borrar. Actualizar solo los resultados para no perder foco ni cursor al escribir.
- Ajustes permite activar «Mostrar títulos originales» con una sola casilla. La preferencia se guarda por cuenta y se aplica a Inicio, catálogo, fichas, barajas y atribuciones de las ideas. Usa el título original y su idioma propios del libro, sin deducirlos del inglés ni inventar abreviaturas. Por defecto se mantienen los títulos traducidos; la interfaz y el contenido de las barajas conservan sus idiomas. Sin sesión, la elección se conserva en el navegador. La búsqueda sigue encontrando todos los títulos disponibles.
- La ficha muestra siempre «Título original» y el título en su idioma original, aunque coincida con el título de la interfaz. Son datos propios del libro; no deducirlos de la traducción inglesa ni del idioma de una baraja. En las portadas pequeñas solo sustituyen al título traducido cuando está activada la preferencia; no mostrar ambos.
- Las portadas de Inicio, Biblioteca y Librería añaden «…» cuando el título corto es más breve que el título completo del mismo idioma. Es una señal de presentación: no se guarda en los metadatos. Las fichas y etiquetas accesibles conservan el nombre completo. «Mostrar títulos originales» usa el original completo.
- La ficha de cada libro ofrece dos enlaces secundarios: Amazon para comprar y Goodreads para reseñar. Icono de plataforma, nombre, acción y flecha de enlace externo. Se abren en otra pestaña, sin cambiar progreso ni gastar hojas. «Ver barajas» conserva la prioridad visual; no añadir enlaces dentro de las portadas ni botones de plataformas en el repaso. Las ediciones actuales de Amazon son españolas y la ficha lo indica aunque la interfaz esté en inglés.
- El saldo de hojas es global entre barajas. Los abonos diarios solo aumentan saldos menores de tres, hasta ese límite; los días excedentes no se guardan para después. Los saldos mayores concedidos manualmente no se recortan; el abono diario vuelve al bajar de tres. Revisitar lo ya repasado es gratis. No introducir compras ni recompensas económicas.
- Cuenta, monedero y repaso se guardan en servidor. Durante una petición no se aceptan nuevos clics; una carta se abre solo después de confirmar el gasto. Fallo de red: mensaje breve y reintento, sin progreso provisional. Las actualizaciones de otra sesión no interrumpen campos ni modales abiertos.
- No mostrar mapas numéricos de tarjetas, marcas de leído, portadas grandes ni un cierre extra.
- Las cartas de lectura tienen una altura mínima contenida y crecen con el texto. Las citas añaden comillas de cierre grandes y muy translúcidas en la zona inferior derecha, detrás del contenido; son decorativas, no reciben interacción y se ocultan a lectores de pantalla.

## Autoría personal para dogfooding

- Crear libro lo incorpora directamente al catálogo común, también para libros de usuarios ya guardados. Se conserva el creador y solo él puede completar los metadatos. Cualquier cuenta puede registrar su lectura y crear su propia baraja, aunque no haya barajas visibles. No añadir un selector de privacidad ni un paso de publicación. La gestión de libros privados se pospone: ver [ADR 0001](../adr/0001-libros-en-catalogo-comun.md).
- Entrada: «Crear baraja» en las barajas de un libro existente. Nombre, enfoque opcional e idioma propio; no cambiar el idioma del contenido al cambiar la interfaz.
- Idioma de libros y barajas: elegir entre «Español» y «English» con el patrón visual de Ajustes, sin texto libre. En libros puede quedar sin elegir para buscar con IA; el guardado manual exige selección. Conservar los idiomas originales ya guardados o identificados por IA, también fuera de estas dos opciones.
- La baraja nueva es personal, editable y visible solo para su dueño. Aparece en Inicio aunque esté vacía. No implementar publicación, edición de cartas existentes, borrado ni reordenación en este caso de uso.
- «Añadir contenido» abre la baraja propia. El álbum muestra todas sus cartas y permite abrirlas sin gastar hojas; «Repasar» mantiene el monedero y el progreso habitual.
- «Añadir tarjeta» exige título y texto. «Añadir cita» solo pide el texto y el padre. No tiene encabezado. Usar un fragmento del texto para identificarla en el árbol y en la selección de padre.
- Ambos formularios permiten elegir padre entre las cartas de la misma baraja. Las tarjetas pueden ir en el nivel principal. Las quotes sin padre se muestran dentro de «Citas sin clasificar».
- El grupo sin clasificar no cuenta como carta, no se desbloquea ni consume hojas. Sus quotes siguen un orden propio, independiente de las tarjetas principales. Las quotes con padre siguen las mismas reglas de sus hermanas.
- «Todas / Solo citas» filtra la autoría y el repaso. Conservar los padres como contexto sin convertirlos en resultados del filtro ni revelar títulos bloqueados.
- Quotes: papel azul pastel `#E4EFFB`, comillas y texto en EB Garamond regular, peso 400. Fuente WOFF2 latina incluida en la app; no depender de fuentes instaladas ni servicios externos. Usar `font-display: swap` y una serif alternativa si no carga. Conservar el melocotón en sus demás usos. Miniaturas, capas y grupo virtual comparten la familia azul; el grupo mantiene borde discontinuo y no parece una carta interactiva.
- Durante el guardado se bloquean los controles. Los errores conservan los campos; el reintento no duplica el contenido. Añadir una carta reabre un repaso terminado, conservando las cartas ya repasadas.

## Lenguaje

- Librería / Library / Librairie es el catálogo disponible. Biblioteca / Bookshelf / Bibliothèque es la colección personal. Los accesos usan «Ir a la librería» y «Ver biblioteca»; reservar «Añadir libro a la librería» para el formulario que registra un libro.
- En español usar «tarjeta» y «cita» en controles, estados y métricas. En inglés, card y quote. Baraja se traduce como deck, también en el perfil.
- Las acciones que borran búsqueda y filtros deben decirlo; «Borrar filtros» se reserva para los controles que solo reinician filtros.

Usar lenguaje técnico simplificado. El texto de interfaz debe ser corto, directo y humano. Evitar términos internos como `node`, `payload`, `tree`, `schema` o `CRUD`.

## Sistema visual inicial

- Tinta bosque: `#173D2C` — texto y estructura.
- Verde hoja: `#58BE59` — acciones y progreso.
- Verde luz: `#B9E877` — superficies y segunda hoja.
- Salvia: `#779A72` — contorno del libro.
- Verde sombra: `#1E4C2E` — sombra exterior del libro.
- Selectores segmentados: opciones inactivas en verde luz `#B9E877`; opción activa en verde de selección `#2F6B3C` con texto crema. Compartido por idioma en Ajustes y formularios, y por filtros de tarjetas.
- Melocotón: `#FFE0CB` — superficie de la idea del día.
- Azul pastel: `#E4EFFB` — citas; borde `#829FBD` y profundidad `#C1D4E8`.
- Crema: `#FFF9ED` — fondo cálido recomendado.
- Rojo error: `#B42318` — mensajes de fallo en formularios, ajustes y carga. Mantener texto explicativo y anuncio accesible; el color no es la única señal.
- Radios grandes, sombras suaves y profundidad por capas.

## Logo

El primer logo de tarjetas y estrella queda descartado. La dirección actual combina un libro abierto con la mascota de dos hojas de `brand/sprout/leaf.svg`. El pliegue central del libro debe coincidir con la separación entre las dos hojas. Las pruebas se encuentran en `brand/reed/index.html`.

El logo con libro no lleva ojos ni boca. La cara se reserva para la hoja cuando se transforma en mascota, sin el libro. La hoja ocupa gran parte del libro, con páginas estrechas y margen suficiente por arriba y abajo.

El usuario ha elegido la forma **D · Compacto** con el color **B · Salvia** (`#779A72`) en contorno y pliegue. Se recuperan exactamente las hojas del B original: sin separación adicional, sin estrecharlas y con sus sombras originales. Únicamente la sombra exterior del libro cambia de `#369247` a `#1E4C2E`. Mantener todos los trazados, proporciones y transformaciones del B original. La prueba actual está en `brand/reed/refinement.html`; los ajustes descartados quedan como historial.

El símbolo elegido debe funcionar en tres niveles:

1. Icono plano y reconocible a 24 px.
2. Marca expresiva en portada y navegación.
3. Mascota mínima con ojos, movimiento y estados; sin convertir la app en un juego complejo.

No se usará el símbolo descartado como base de futuras iteraciones.

## Historial de exploración: Sprout

Sprout fue la exploración inicial: lectura y crecimiento conectados por la doble lectura de «hoja» (página / planta). Ver `docs/frontend/SPROUT_SPIKE.md` y `brand/sprout/index.html` como historial, no como nombres vigentes.

**Reedleaves** es el nombre oficial, elegido por el usuario. Reed queda como nombre anterior en el historial. El lema inglés **Read. Plant a seed.** y **De hoja a hoja** en español se conservan. La mascota aprobada de la app es la pareja de hojas de la exploración Sprout, denominada **Brote** en el estudio de crecimiento. El logo aprobado es **D · Compacto** con líneas **B · Salvia**, hojas originales y sombra exterior del libro oscura. La cabecera de la app sigue usando solo el símbolo; el título de pestaña usa «Reedleaves · [pantalla]». Las rutas `brand/reed/`, los IDs y las claves de almacenamiento se conservan para no romper enlaces ni progreso.

La evolución de mascotas es propia de cada libro y agrega el progreso de todas sus barajas. **Maceta** se obtiene al añadir el libro (estado de lectura o repaso iniciado); **Semilla**, al gastar la primera hoja en una tarjeta; **Plántula**, al gastar hojas en tres fechas locales distintas; **Brote**, al gastar hojas en cinco fechas locales distintas. Reabrir una tarjeta no cuenta. La API calcula esas fechas desde `review_unlocks.local_day`, sin tabla ni migración extra.

La mascota actual del libro aparece solo en tres contextos: portada del libro en Inicio, selección de baraja y vista de repaso. No lleva una placa verde detrás; en repaso aparece grande a la derecha del nombre y los datos de la baraja, con su lema centrado debajo, en cursiva y gris, y una animación breve al entrar. En móvil mantiene esa disposición con un tamaño menor. Pulsarla abre «Mascotas», una línea vertical sin tarjetas contenedoras. Cada etapa muestra nombre, condición conocida (o «???»), y lema en cursiva si ya se obtuvo; si no, muestra «No desbloqueada». Las etapas obtenidas llevan un tick verde; la actual destaca con el marcador verde relleno. No aparece en la ficha modal del libro ni en autoría. La lista conserva este orden: Maceta, Semilla, Raíz, Plántula, Brote, Retoño, Tallo, Planta, Flor y Siempreviva. Plántula y Brote se obtienen tras gastar hojas en tres y cinco fechas locales distintas, respectivamente. Los estados aún no disponibles usan una silueta gris neutra; los posteriores a Brote no muestran arte identificable ni condición de desbloqueo. La pantalla no tiene acceso global ni entrada en navegación principal. Semilla y Plántula usan ojos bien separados.

`brand/reed/growth/` conserva las propuestas visuales completas para trabajo interno; el producto oculta las formas futuras con `mystery.svg`.

La UI y los metadatos editoriales de libros e intereses tendrán español e inglés. Con títulos traducidos, cada portada usa un título corto editorial y la ficha, el título completo. Con la preferencia de originales, ambas usan el título original del libro. El idioma original de cada libro o baraja es independiente de la interfaz y se muestra tal cual, incluso si es francés. No presentar traducciones inexistentes como disponibles. Los libros personales se crean desde «Librería → Añadir libro a la librería» con título, autor e idioma original; muestran ese título como alternativa cuando no hay traducción. No requieren metadatos editoriales ni enlaces. Tras guardarlos se abre la selección de barajas para crear la primera. La plataforma (web, móvil o ambas) sigue sin decidir. Mantener los prototipos adaptables hasta resolverlo.

## Límites

- Añadir libro a la librería incluye «Autorellenar con IA». Con el título y, opcionalmente, autor e idioma original, busca información, muestra un spinner y abre la vista previa. No guardar durante la búsqueda. La propuesta incluye traducciones ES/EN y los metadatos respaldados por fuentes; se conservan los valores escritos y se dejan vacíos los desconocidos. Fuentes clicables visibles y detalle plegado. Traducciones plegadas. «Añadir libro a la librería» guarda; «Editar» vuelve al formulario sin perder la propuesta y permite corregir metadatos en controles plegados. Cancelar descarta el borrador. Errores y reintentos conservan lo escrito. No añadir portadas comerciales ni generar barajas o cartas en este flujo.
- La IA propone un único título principal por idioma, sin subtítulo ni el original añadido por un catálogo internacional. Prioriza las ediciones publicadas en ese idioma. El título corto generado tiene como máximo 32 caracteres, conserva palabras reconocibles y no incluye puntos suspensivos; puede coincidir con un nombre que ya es breve. Los metadatos escritos por el usuario se conservan.

- Los libros propios incompletos muestran un icono de interrogación cálido en las portadas de Inicio, Librería y Biblioteca, y junto al autor en la ficha. Falta información cuando faltan títulos completos/cortos o descripciones ES/EN, o intereses. Los enlaces, fuentes y notas son opcionales y no mantienen el aviso. El icono abre «Completar información»: identidad de solo lectura, autorellenado con spinner y la misma vista previa. «Guardar» añade únicamente los datos que faltan al libro existente. Los campos previos no se pueden editar; la propuesta nueva sí. Cancelar vuelve al contexto de origen. No cambia barajas, progreso ni saldo; no permite modificar libros ajenos o editoriales.

- No usar estética de dashboard empresarial.
- No usar una pared de tarjetas sin jerarquía.
- No añadir gamificación que no ayude a leer o recordar.
- Los destinos principales son Inicio, Librería, Biblioteca e Idea del día. El Perfil propio se abre desde «Ir a mi perfil» en Inicio o desde la cuenta en Ajustes; los creadores de las tarjetas enlazan a sus perfiles. Inicio es la vista simplificada de los repasos pendientes; Biblioteca contiene la colección personal completa. Ajustes contiene idioma, preferencia de títulos originales, usuario y cerrar sesión. El acceso no introduce otra sección permanente.

- Atribución de tarjetas: tres filas, libro, autor y usuario creador de la baraja. Cada fila lleva un SVG sencillo relleno, negro al 30 % de opacidad, que toma el matiz del papel. Mismo componente en repaso, autoría e idea diaria.

- Librería combina búsqueda de títulos con filtros por autor, interés e idioma de baraja. La atribución del libro abre su ficha en Librería; la del autor abre Librería filtrada por ese autor. Los enlaces llevan una flecha SVG diagonal.

- Perfil: avatar provisional, nombre, fecha de creación, hojas gastadas y resúmenes de lector y archivista. Tarjetas repasadas y vistas cuentan tarjetas distintas; la idea diaria y consultar contenido propio son vistas sin gastar hojas ni desbloquear el repaso. Las citas creadas forman parte de las tarjetas creadas.
- Mascotas del perfil: contar solo la etapa actual de cada libro, con el mismo cálculo que sus portadas. No sumar las etapas anteriores desbloqueadas. Mostrar las etapas disponibles de la app.
- «Ver biblioteca» abre la propia con edición habitual. La ajena identifica al usuario y «Solo lectura», conserva los filtros y permite consultar fichas de libros compartidos; no cambia lectura, contenido ni progreso. Los borradores de barajas conservan sus permisos. Desde una ficha ajena se puede abrir el libro en Librería como contexto propio.
