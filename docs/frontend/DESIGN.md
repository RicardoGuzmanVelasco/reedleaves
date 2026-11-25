# Guía de diseño

Esta guía reúne criterios generales para diseñar Reedleaves. No es una especificación completa, un registro de decisiones ni una fuente de verdad del producto.

## Criterios

- Priorizar la simplicidad funcional: cada pantalla debe ayudar a completar una tarea clara.
- Mantener una estética cálida, expresiva y amable. El juego visual debe apoyar la lectura y el aprendizaje.
- Evitar complejidad, adornos y casos de uso que no aporten valor directo.
- Escribir de forma breve, clara y humana. Incluir solo el texto necesario para usar la interfaz.
- Tratar la iconografía de las acciones clave como parte del sistema de producto: una acción recurrente debe conservar un símbolo reconocible en todos sus puntos de entrada. Cuando haya espacio, el icono acompaña al texto y no lo sustituye.
- Diseñar para distintos tamaños de pantalla y respetar accesibilidad, movimiento reducido y controles semánticos.
- Las portadas de libros conservan globalmente la proporción aprobada 176:240. Al cambiar de tamaño, texto, espaciado, lomo y arte interior escalan proporcionalmente; las cuadrículas evitan deformar el libro. Si un texto supera el espacio de la portada, se limita con elipsis y permanece completo en su nombre accesible y tooltip.
- Diseñar primero para uso táctil (touch first). Las acciones, el atractivo visual y las animaciones principales deben funcionar sin hover. El hover es un refuerzo opcional para dispositivos con cursor preciso, nunca el centro de la experiencia ni un requisito para descubrir una acción.
- Los botones circulares que muestran solo un icono deben parecer controles sólidos, no translúcidos: usar un fondo opaco, borde visible y una sombra ligera cuando corresponda, también sobre fondos variables. Mantener una zona táctil de al menos 44 × 44 px aunque el círculo visible sea más pequeño. Aplicar el mismo lenguaje a las acciones de cerrar, ayuda y navegación circular, salvo el cierre exterior de un modal sobre el fondo atenuado, que puede llevar superficie translúcida sin sombra.
- En diálogos con un panel delimitado, colocar la X de cierre fuera del panel, encima de su esquina superior derecha y alineada con el borde. En diálogos a pantalla completa, situarla arriba a la derecha fuera del contenido y respetar el margen seguro.
- Las respuestas de hover de un contenedor no deben sustituir, reiniciar ni mover la animación propia de una mascota. Separar las capas visuales cuando sea necesario.

## Paleta de reutilización · inventario preliminar

Inventario de las familias visibles en la app. No es una paleta nueva aprobada: son referencias existentes para reutilizar.

| Familia | Colores de referencia existentes | Uso actual / criterio de reutilización |
| --- | --- | --- |
| Bosque / tinta | `#173D2C` (`--ink`), `#1E4C2E` (`--shadow`); reverso `#376C49` → `#214C36` | Texto e iconos principales, profundidad de controles verdes y fondos oscuros de marca. |
| Papel cálido | `#FFF9ED` (`--paper`), `#FFFDF6`; tarjetas `#FFFEF9` → `#FFFBED` | Fondo de página, diálogos y superficies de lectura. Reutilizar papel antes de introducir otro blanco cálido. |
| Salvia / neutros verdes | `#51654C` (`--muted`), `#779A72` (`--sage`), `#DADCC9` (`--line`); tarjetas: borde `#6E916A`, sombra `#B7C69D` | Texto secundario, líneas, bordes y profundidad de superficies verdes. Son funciones distintas, no colores intercambiables. |
| Verde vivo / lima | `#58BE59` (`--green`), `#B9E877` (`--light`); hoja-moneda `#B7DE76` | Acciones destacadas, mascota y recursos de crecimiento. La pequeña diferencia entre las limas queda pendiente de revisar; no recalibrar el arte automáticamente. |
| Crema vegetal / verde pálido | `#E3EDC9` (círculo y marco del reverso), `#E4F0CC` (portadas), `#D9EDB6` (respuesta de repaso); pestaña inferior activa `#C5DD9C` con profundidad `#8CA868` | Superficies suaves de marca. El «crema» del reverso tiene matiz verde; distinguirlo del papel cálido y de la miel. |
| Miel / madera / arena | Base `#E8D3A4` (`--wood`), borde y profundidad `#BCA06D` (`--wood-edge`, `--wood-shadow`); tabs inferiores, recomendación del equipo y respuesta «Ver menos a menudo». «Ver más a menudo» usa la familia verde `#D9EDB6`, borde `#3F8850` y sombra `#91BB72` | Familia cálida reutilizable para controles neutros; base compartida aplicada a navegación, recomendación y respuestas del repaso. |
| Melocotón / rosa pétalo | Pétalo `#F4A6A0` y pliegue `#FAD7CE`; precio `#F3D8B2`, oferta `#F6B27D` | Moneda, precios y acentos cálidos. El melocotón del precio es más anaranjado que el pétalo; mantener esa distinción hasta revisarla. |
| Azul papel | `#E4EFFB` (`--quote-paper`), borde `#829FBD` (`--quote-edge`), sombra `#C1D4E8` (`--quote-shadow`); luz `#F1F7FD` | Tarjetas de cita y sus acciones. Ya tiene una familia coherente de superficie, borde y profundidad. |
| Estados funcionales | Error `#B42318` (`--error`); avisos cálidos `#FFF0DD` con texto `#704219`; indicador de novedad `#F2A83B` | Reservar para comunicar estado. No convertirlos en la identidad de respuestas neutras de frecuencia. |

### Primera oportunidad de unificación

- Unificados `#E8D3A4` (madera de navegación), la miel de recomendación y «Ver menos a menudo» bajo `--wood`. «Ver más a menudo» conserva la familia verde de la app, con borde y sombra verdes.
- Mantener juntos superficie, borde y sombra de cada familia: madera con profundidad marrón, melocotón con profundidad cálida, azul con profundidad azul. El texto conserva `--ink` para mantener identidad y contraste.
- Antes de crear más tonos, preferir las variables existentes y los tokens de `app/card-themes.css`.

Los colores internos de mascotas, iconos y portadas pertenecen a su arte; este inventario no autoriza recolorearlos.

## Iconos de saldo

- El pétalo usa la silueta diagonal rosa de `app/assets/brand/petal-token.svg`, con el pliegue lateral claro de P2 (`#FAD7CE`).
- La hoja usa `app/assets/brand/leaf-token.svg`, con dos planos longitudinales de H1: verde `#58BE59` y lima `#B7DE76`.
- Mantener tratamientos distintos para que cada forma conserve su lectura. Revisarlos también al tamaño de monedero (24–30 px).

## Iconografía de la interfaz nueva (biblia de iconos)

Fuente de verdad del estilo de iconos de la interfaz nueva (`?ui=2`). Los SVG viven en `app/assets/icons/ui2/`; su `README.md` es el catálogo (id, significado, dónde se usa). Esta sección fija las reglas; el catálogo, qué icono hay. Estilo elegido por el dueño del producto: muy redondeado, trazo gordo, perspectiva cuando el concepto es de conjunto, en la línea de SF Symbols (referencias: pila de tarjetas redondeadas, `rectangle.on.rectangle.angled`, libro cerrado).

**Sistema técnico**
- Rejilla 24×24 (`viewBox="0 0 24 24"`), dibujo dentro de 2–22, aire mínimo entre trazos de ~1 unidad.
- Un solo trazo de **2,2**, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`. Sin esquinas vivas.
- Radios: 3,5–4,5 en tarjetas, cajas y casas; 2–2,5 solo en libros cerrados.
- Solo `currentColor`: ningún color fijo. Todos llevan `aria-hidden="true"` y `focusable="false"`; el nombre accesible lo pone el botón. Zona táctil ≥ 44×44 px la da el botón, no el icono.
- Legibles a 20 px; comprobar también a 16 px. El icono acompaña al texto cuando hay espacio; va solo en controles circulares y filas de acciones.
- Formas macizas solo como glifo: `quote`, puntos de `more`, triángulo de `practice`.

**Perspectiva y composición**
- Pila recta (tarjeta delantera y las de detrás asomando por arriba): conceptos de baraja y colección (`deck`, `new-deck`, `finish-deck`, `cardcase`).
- Dos tarjetas en ángulo: notas y repaso (`take-note`, `practice`). La pila recta y las tarjetas en ángulo no se mezclan: así se distingue una baraja de una nota.
- Acciones y controles son planos (`close`, `back`, `check`, `share`, …).
- Mezcla: `book-stack` dibuja una pila plana de tres libros de lomo, de anchos distintos y desplazados entre sí, con una línea de lomo cada uno = «un poco de todo»; el de arriba sobresale más por la derecha. Los iconos de tema de Repaso son `book-stack` (Un poco de todo), `calendar` (La baraja del día), `new-gift` (Entre las novedades) y `team-pick` (Elegidas por el equipo).
- **Altas con `+`, ediciones con lápiz**, con el mismo marco: tarjeta abajo a la izquierda e insignia arriba a la derecha. `take-note` = dos tarjetas en ángulo con «+»; `edit` = una tarjeta con lápiz; `new-deck` = pila con «+».
- Un concepto, un icono: una sola aspa para cerrar, una sola familia para volver/anterior/siguiente, un solo marcapáginas (guardar tarjeta). Los libros de estado de lectura son siempre libro, nunca marcapáginas.

**Estados**
- Activo, una sola lógica: mismo contorno con relleno suave `fill="currentColor"` y `fill-opacity=".28"`. En `practice-active` cubre las dos tarjetas en un solo trazado. Nunca relleno sólido del mismo color que el borde, salvo glifos macizos.
- Excepción `quote`: glifo macizo; `quote-active` = núcleo macizo con contorno suave al .28, mismo tono que `idea-active`. Si no se distingue a 16 px, basta `quote` en ambos estados.
- Solo los iconos que alternan estado tienen variante `-active` (pestañas, tipo de tarjeta, guardar, valorar).

**Nombres**
- ids en kebab-case en inglés, con el término del glosario: `bookstore` (Librería), `library` (Biblioteca), `shelf` (Estantería), `cardcase` (Tarjetero), `deck`, `practice` (Repaso; nunca `review`), `take-note`, `place-under`. Variantes: `-active`, `-alt` (alternativas descartadas no se versionan en el repo).

**Para añadir un icono nuevo**
1. Comprobar que no existe ya el concepto en el catálogo; reutilizar antes que crear.
2. Dibujarlo con este sistema y revisarlo junto a sus vecinos de familia (`take-note`, `edit`, `deck`, `new-deck`, `practice` se comparan siempre a la vez).
3. Verificar legibilidad a 16 y 20 px, en claro y sobre verde oscuro.
4. Añadir el SVG a `app/assets/icons/ui2/` y su fila al `README.md`.
5. Si sustituye a uno antiguo, borrar el antiguo.

**Fuera de esta familia** (se mantienen tal cual): banderas de idioma, mascotas, Hoja, Pétalo, racha, arte de marca y emojis de intereses.

**Libros:** la portada va sin el ribete del lado del lomo (izquierda) para dar aire al contenido; `reading-guide` es la portada con una «i» latina (punto, asta y pie).

## Repaso

- El reverso de tarjeta (`app/assets/brand/card-back.svg`) es un recurso aprobado: mascota estática girada 12° sobre círculo y marco crema, brotes arriba y abajo, 17 % de opacidad.
- La sesión (hito 1, `app/ui2/repaso-sesion.mjs`) usa la vista inmersiva de tarjetas con cinco segmentos tipo stories; detalle en `docs/development/EDIT_NOTES_PLAN.md`.
- Principios: durante la tarjeta, solo el contenido (sin mascota); se pasa tocando o deslizando (izquierda = siguiente), con flechas y teclado en escritorio; los precios reutilizan `priceTag`; mostrar disponibilidad antes de comprar y que el servidor revalide; movimiento reducido elimina desplazamientos.
- Pruebas (hito 2, `app/ui2/repaso-pruebas.mjs`): tapa del color oscuro del tema con «?» que conserva el largo del texto; tocar descubre (el tercio izquierdo sigue siendo «anterior»); se responde con «No me acordaba» (izquierda) / «Me acordaba» (derecha) o deslizando a ese lado; cuentas monocromas ✓/✗ en los segmentos.
- Las barajas de tema (`.ui2-pack`) leen primero como baraja: el icono del tema va detrás, pequeño y suave.
- Racha: las dos opciones que cuentan («Un poco de todo», «La baraja del día») llevan la llama `flame` (gris al faltar, naranja al cumplirse); con 2/2, cuenta atrás hasta el siguiente día (fuente `app/daily-cycle.mjs`).

## Chips informativos

- Los chips informativos no llevan borde ni sombra propia. Mantener un estilo compartido para los que aparecen juntos: fondo, radio, tipografía y espaciado. El chip «En curso» comparte estilo con el del ojo. Esta regla también se aplica a los chips de estado e idioma del detalle de baraja.

## Selectores de cápsula

- Por defecto, ocupan el ancho necesario para sus opciones, sin estirarse para rellenar el contenedor. El selector de lectura de la ficha del libro se centra horizontalmente.
- Las pestañas Estantería / Shelf y Tarjetero / Cardcase de Biblioteca / Library mantienen por ahora su estilo propio. Posible unificación futura: revisar si conviene aplicarles el lenguaje visual del selector de cápsula.
- Los selectores de presentación de libros comparten los SVG aprobados de `app/assets/icons/book-layout/`: cuatro portadas en cuadrícula, dos lomos verticales y uno inclinado para Estantería, y tres libros horizontales para Apilados. Fondo e interiores transparentes, con trazo `currentColor` y máscaras CSS que heredan el color del control. Los iconos son negros en reposo y blancos en la opción activa, que conserva el fondo verde oscuro del selector compartido. Mantener las etiquetas accesibles en español e inglés.

## Cabecera compartida

- La cabecera mantiene sus controles globales y ofrece un espacio opcional de contenido a la izquierda. Cada vista decide qué inyectar en ese espacio; puede quedar vacío. No se determina su contenido mediante una lista central de rutas.
- Las vistas principales pueden mostrar ahí su icono y nombre, alineados con los saldos y Ajustes. El título semántico de cada pantalla se conserva dentro de `main` para el foco y la navegación accesible.

## Ficha del libro

- Sin bibliografía ni fuentes de investigación. Una única acción de contenido: «Ver barajas · N». Idioma, estado y progreso se muestran en cada baraja, no en la ficha.
- Marcar «Leído» guarda la lectura y, si hay barajas propias en curso, ofrece terminarlas juntas (título, aviso de que no se podrán editar, cancelar/terminar). «Barajas en curso» permite recuperar ese diálogo. Las notas en borrador deben guardarse o descartarse antes.
- Tras pasar a «Leyendo» o «Leído», se ofrece «Tomar nota» de forma temporal.

## Guías de lectura

- Escribir la guía es una sola tarea en pantalla completa, con mínimo de caracteres (`READING_GUIDE_MIN_LENGTH`) y recompensa en XP (`READING_GUIDE_REWARD_XP`) definidos en el código. Sin lista de guías ajenas: las guías son una baraja destacada que se lee como tarjetas.
- Un libro leído sin guía propia ofrece escribirla con un aviso verde y el premio.

## Baraja

- Orden de barajas en selectores y tarjetero: distintivo visible; alguna nota del usuario; título distinto del automático (`defaultNoteDeckTitle`); título sin «notas/personales/notes/personal». Si todo empata, orden previo. Incluye las guías.
- «Fuente de las citas»: un único enlace externo (otra pestaña) solo si la baraja tiene `quoteSourceUrl`; solo el equipo lo fija.
- La recomendación del equipo (`isRecommended`) lleva la etiqueta «Te recomendamos» con papel ondulado dorado; las guías de lectura llevan siempre «Destacada». No hay etiqueta de relleno en las demás.
- Idioma: chip con bandera (español, inglés) o globo con código (otros); nombre localizado en el nombre accesible. Las barajas terminadas no muestran estado; las en curso, el candado abierto. Recuento de tarjetas y de citas (también a cero) con sus iconos.
- Baraja personal propia en curso: su pantalla es **Editar baraja** (`#edit/<id>`; `#deck/<id>` redirige allí). No existe un botón «Editar». Desde el editor se comparte (el enlace abre la baraja para leer sus tarjetas, nunca el editor), se leen las tarjetas, se toman, editan, mueven y borran notas y se termina la baraja; la X vuelve al origen.
- La página de baraja es para barajas terminadas, ajenas o colectivas: **Compartir** es la acción principal. Quien no la tiene en su tarjetero ve «Añadir al tarjetero».

## Vista exclusiva de tarjetas

- La valoración («Me gusta» / «No me gusta») y las acciones «Guardar tarjeta» / «Quitar de guardadas» aparecen en la vista exclusiva y en las tarjetas completas del modo presentación, tanto en lista como en carrusel. Las miniaturas y la preview del calendario no incluyen estas acciones. Las tarjetas completas se ajustan al contenido; las atribuciones de libro, autor y usuario se agrupan de forma compacta.
- Si la baraja de la tarjeta está en curso, mostrar «Baraja en curso / Deck in progress» como chip informativo en su vista exclusiva.
- Al pulsar la tarjeta compacta de la idea del día, se abre su vista exclusiva. Las acciones de valoración y guardado viven dentro de esa vista.

## Enlaces de atribución

- Los enlaces con icono, nombre y flecha comparten el mismo estilo en tarjetas y fichas de libros, incluido «Añadido por».
- El nombre no lleva subrayado en reposo. Al pasar el cursor se subraya solo el nombre. Se mantiene el indicador visible de foco para teclado.
- Siguen siendo enlaces semánticos y pulsables a su destino. Reutilizar el componente `nameLink` de `app/views.mjs` (icono, nombre, destino e idioma opcional) y su estilo compartido `card-attribution-row`, sin definir variantes por pantalla.
- Sin destino, el componente muestra icono y nombre como texto, sin flecha ni interacción. Sin nombre, no se muestra.
- La autoría de barajas usa este mismo enlace, sin el prefijo «Creada por». Su texto es secundario respecto al título: 11 px y peso 500 en la tarjeta del selector. El enlace abre el perfil de forma independiente de la apertura de la baraja; no anidar enlaces dentro de botones.

## Compartir barajas

- Presentar «Compartir / Share» como botón principal con texto visible, también en móvil. Las barajas y las tarjetas comparten el icono de cuadrado con flecha ascendente.
- Compartir envía el texto funcional en el idioma de la interfaz elegida, con el título completo del libro traducido a ese idioma cuando exista y el nombre de la baraja. La copia empieza en inglés hasta que se elige un idioma de interfaz.
- La tarjeta de imagen es genérica: brote oficial con ojos y boca del componente compartido, grande sobre `#fff9ed`, sin nombres ni copy. Usarla como imagen de preview social; Web Share envía una propiedad de texto con el copy y el enlace juntos, siguiendo el patrón de compartir de Competi.
- Si el dispositivo no abre Web Share, copiar el texto y el enlace juntos.

## Compartir tarjetas

- El mensaje identifica si se comparte una idea, una cita u otra tarjeta y nombra el libro, en el idioma de la interfaz. La URL conserva el idioma en que se vio el contenido.
- La preview del enlace usa la imagen genérica del brote, el título de la idea o un fragmento de la cita u otra tarjeta y el nombre del libro. Si la tarjeta ya no existe, conserva la preview genérica.

## Glosario

Usar estos términos de forma consistente en la interfaz y en la documentación editorial vigente. Los nombres internos del código y los archivos de datos pueden conservar sus términos técnicos.

| Concepto | Español | Inglés |
| --- | --- | --- |
| Catálogo global | Librería | Bookstore |
| Colección personal | Biblioteca | Library |
| Libros de la colección personal | Estantería | Shelf |
| Barajas de la colección personal | Tarjetero | Cardcase |
| Conjunto de repaso | Baraja | Deck |
| Baraja que aún se escribe (`status=in_progress`) | En curso / Baraja en curso | In progress / Deck in progress |
| Baraja cerrada a cambios (`status=finished`) | Terminada (sin etiqueta de estado en la interfaz) | Finished (no status label in the interface) |
| Contenido pendiente del editor | Nota en borrador | Draft note |
| Texto sin guardar (el nombre «borrador» queda reservado para esto) | Borrador | Draft |
| Aprendizaje activo | Barajas en repaso | Decks being practiced |
| Tipo de selección de tarjetas de una sesión de repaso (`practiceMode`: leyendo, leídos, guardadas, mezcla, Descubrir) | Modo de repaso | Practice mode |
| Baraja que el equipo recomienda en un libro (una por libro) | Baraja recomendada | Recommended deck |
| Divisa con la que se repasa | Pétalo | Petal |
| Unidad al escribirla (baraja en curso) | Nota | Note |
| Unidad al leerla, repasarla y contarla (límite 25) | Tarjeta | Card |
| Texto citado | Cita | Quote |
| Relación entre tarjetas | Colocar debajo de | Place under |
| Actividad de aprendizaje | Repaso / repasar | Practice / practice |
| Capturar una idea o cita | Tomar nota | Take a note |
| Recompensa diaria | Hoja | Leaf |
| Contenido creado por usuarios | Contribuciones | Contributions |
| Progreso de una persona en un libro | Crecimiento | Growth |

**Vocabulario de secciones, aprobado y obligatorio.** Los cuatro destinos son Librería / Bookstore, Biblioteca / Library, Estantería / Shelf y Tarjetero / Cardcase. Usarlos siempre con ese significado en interfaz, documentación, conversaciones y mensajes entre agentes. En inglés, «Library» es la colección personal y nunca el catálogo; el catálogo es «Bookstore». Mayúscula inicial solo cuando el nombre designa la sección como título, pestaña, botón de navegación o inicio de frase; dentro de una frase, en español e inglés, va en minúscula («tu tarjetero», «desde la librería», «your cardcase», «the bookstore»). El código usa los mismos nombres: `bookstore` (Librería, `#bookstore`) y `library` (Biblioteca, `#library`); `bookshelf` queda para los libros de la Estantería.

**Nota y tarjeta.** Es la misma unidad en dos momentos. **Nota** es lo que se escribe y edita mientras la baraja está en curso («Tomar nota», «Editar nota», «Borrar nota», nota en borrador). **Tarjeta** es esa unidad al leerla y repasarla, en una baraja terminada, y en el recuento y límite de la baraja («6/25», el icono de tarjetas). En el editor no decir «tarjeta» para una nota concreta; al leer o practicar no decir «nota». **Cita** e **Idea** son los tipos. No usar **carta**. **Hoja** conserva el juego entre página y hoja de planta. En inglés, **Practice** es la actividad.

La Biblioteca contiene dos vistas: Estantería (libros) y Tarjetero (barajas). Las barajas propias aparecen solas en el tarjetero. Los costes (añadir una baraja ajena, repasar) viven en el código (`app/wallet.mjs`, `app/practice-modes.mjs`) y no se fijan aquí.

**Tomar nota** es la única forma de nombrar la captura de una idea o cita (botones, nombres accesibles, encabezados). Clave `takeNote`. Evitar «Añadir contenido/tarjeta/cita». Abre el editor directamente cuando la baraja ya está determinada; guardar o cancelar devuelve al punto de partida. Una nota hija se toma desde la hoja de la nota madre. Con el «+» de Inicio sin baraja propia en curso, se abre el editor y se avisa de que se creará «Notas de lectura»; la baraja nace al guardar la primera nota, en el idioma de la app. Cancelar no crea nada.

**Estado de la baraja.** «En curso» describe creación, no privacidad: guardar comparte la nota con quien tenga acceso al catálogo. **Terminar cierra la baraja para siempre: una baraja terminada no se puede editar ni corregir.** Al pulsar «Terminar baraja» el aviso debe decirlo con claridad. Solo se recuperan en el navegador y dispositivo donde se conservaron las notas en borrador. Mientras está en curso, el creador edita nombre, enfoque, idioma, notas y su jerarquía.

## Cómo usarla

Criterios, no descripción de la interfaz actual: para el comportamiento vigente, consultar la implementación; para el arte, los recursos de la app. Las exploraciones de marca son propuestas.

## Barra inferior

- Cinco piezas de madera con relieve; la activa es un marcapáginas verde con icono y nombre. Los demás nombres quedan solo accesibles. Cinco destinos, orden aprobado.
- Reaparece al entrar en una ruta; el scroll descendente la oculta y el ascendente la recupera. Se oculta en Repasar y con el teclado virtual abierto.
- Movimiento reducido omite animaciones. Dejar espacio inferior para que no tape contenido.



## Intereses de libros

- Cada interés tiene emoji y nombre localizado, ambos del catálogo; la interfaz no mantiene otra lista por ID. El emoji es decorativo y no sustituye el nombre accesible.
- Los chips de interés usan el color del interés, degradado hacia el papel en los extremos, sin borde, sombra ni interacción. Pueden ir solo con icono.
- En el perfil, primero los intereses positivos en su orden (tick verde) y después los descartados (aspa roja). Sin encabezados ni números.
- Portadas tintadas (Ajustes): No, Monocromático (interés principal) o Policromático. Local al navegador.
- Software y Mindfulness existen en español e inglés. Clasificar según el contenido del libro.
- Selección inicial: dos pasos, «Siguiente», «Volver» y «Guardar» siempre visibles fuera de la zona con scroll; la prioridad es el orden de selección.

## Orden de libros

- En la Librería, «Ordenar» ofrece «Más recientes» (inicial) y «A–Z» (por el título mostrado, sin acentos). No altera búsqueda, filtros ni vista. Se guarda por cuenta; visitantes, en el navegador.

## Novedades

- Librería e Idea del día muestran un punto naranja en la barra inferior; su nombre accesible incluye el estado (nº de libros nuevos o nueva idea). Reconocer la sección retira el punto; solo otra sección principal termina la visita.
- En la Librería, el grupo «Nuevo» se separa primero y cada libro aparece en un único grupo. Movimiento reducido deja el punto estático.
