# Guía de diseño

Esta guía reúne criterios generales para diseñar Reedleaves. No es una especificación completa, un registro de decisiones ni una fuente de verdad del producto.

## Criterios

- Priorizar la simplicidad funcional: cada pantalla debe ayudar a completar una tarea clara.
- Mantener una estética cálida, expresiva y amable. El juego visual debe apoyar la lectura y el aprendizaje.
- Evitar complejidad, adornos y casos de uso que no aporten valor directo.
- Escribir de forma breve, clara y humana. Incluir solo el texto necesario para usar la interfaz.
- Tratar la iconografía de las acciones clave como parte del sistema de producto: una acción recurrente debe conservar un símbolo reconocible en todos sus puntos de entrada. Cuando haya espacio, el icono acompaña al texto y no lo sustituye.
- Diseñar para distintos tamaños de pantalla y respetar accesibilidad, movimiento reducido y controles semánticos.
- Diseñar primero para uso táctil (touch first). Las acciones, el atractivo visual y las animaciones principales deben funcionar sin hover. El hover es un refuerzo opcional para dispositivos con cursor preciso, nunca el centro de la experiencia ni un requisito para descubrir una acción.
- Las respuestas de hover de un contenedor no deben sustituir, reiniciar ni mover la animación propia de una mascota. Separar las capas visuales cuando sea necesario.

## Iconos de saldo

- El pétalo usa la silueta diagonal rosa de `brand/reed/petal-token.svg`, con el pliegue lateral claro de P2 (`#FAD7CE`).
- La hoja usa `brand/reed/leaf-token.svg`, con dos planos longitudinales de H1: verde `#58BE59` y lima `#B7DE76`.
- Mantener tratamientos distintos para que cada forma conserve su lectura. Revisarlos también al tamaño de monedero (24–30 px).

## Modo Repasar

- Inicio ofrece «¡Vamos a repasar!» en una sola línea, sin flecha, con Plántula dentro de un círculo grande. Mascota y texto ocupan el mayor tamaño que admite el ancho del botón; el conjunto se adapta a móvil sin desbordarse y evita altura sobrante. El degradado conserva el extremo claro a la derecha, oscurece más el lado izquierdo y mantiene el tono medio hacia la derecha para distinguirse de Plántula. El fondo permanece fijo; un brillo estrecho cruza durante unos 0,75 s cada 7,5 s y una ola rápida recorre el texto carácter por carácter: las letras suben y bajan con easing y se solapan. Movimiento reducido desactiva ambas animaciones.
- La selección de tema y el cierre pueden dar protagonismo a Plántula. Mientras se muestra una tarjeta, retirar la mascota y concentrar la atención en el contenido.
- La elección de tema usa un fondo verde suave con luz en ambas esquinas de la diagonal, Plántula sobre el título y cuatro barajas en cuadrícula de 2×2. Cada baraja tiene tres tarjetas en abanico y un único icono grande, semitransparente y recortado por la tarjeta frontal. Mantener los cuatro iconos y sus posiciones calibradas por separado. El cierre es una X centrada dentro de un círculo fino con fondo claro opaco. Conservar la tipografía de la app.
- Los precios de Repasar reutilizan el componente `priceTag` de «Añadir a mi tarjetero». Comparten papel ondulado melocotón; varían moneda, cantidad y nombre accesible según el contexto. El tema rebajado muestra el precio anterior y el nuevo al mismo tamaño, aspas translúcidas sobre el anterior y un icono de oferta colgando a su derecha (43 px) y abajo (25 px). El icono recorta el porcentaje y el agujero para dejar ver el fondo. El precio rebajado usa un melocotón más vivo y conserva un brillo estrecho de unos 0,75 s cada 7,5 s. Movimiento reducido desactiva el brillo.
- Durante la tarjeta, reservar espacio superior para salir y separar las respuestas del contenido: tarjeta algo más arriba y botonera algo más abajo, sin fijarlas sobre el texto. Conservar siempre «Quiero repasarla pronto» a la izquierda y «La recordaba» a la derecha.
- Las respuestas conservan su paleta al pasar el cursor y al pulsar: fondo, texto, borde y tono de sombra. El feedback cambia solo el desplazamiento y la profundidad de sombra; no aplicar filtros de color.

## Chips informativos

- Los chips informativos no llevan borde ni sombra propia. Mantener un estilo compartido para los que aparecen juntos: fondo, radio, tipografía y espaciado. El chip «Borrador» comparte estilo con el del ojo. Esta regla también se aplica a los chips de estado e idioma del detalle de baraja.

## Selectores de cápsula

- Por defecto, ocupan el ancho necesario para sus opciones, sin estirarse para rellenar el contenedor. El selector de lectura de la ficha del libro se centra horizontalmente.
- Las pestañas Estantería / Shelf y Tarjetero / Decks de Biblioteca / Bookcase mantienen por ahora su estilo propio. Posible unificación futura: revisar si conviene aplicarles el lenguaje visual del selector de cápsula.

## Ficha del libro

- La ficha y la vista previa no muestran bibliografía, citas numeradas ni el desplegable de fuentes de investigación. El catálogo no guarda fuentes de investigación como metadatos.
- La zona inferior concentra el acceso al contenido en una única acción: «Ver barajas · N» / «View decks · N», con el número de barajas disponibles.
- Después de cambiar un libro a «Leyendo» o «Leído» desde Librería, la ficha abierta ofrece una sugerencia temporal para «Tomar nota». El atajo abre el editor o el selector de baraja que corresponda y regresar conserva la misma ficha.
- Idioma, estado de creación y progreso de repaso se muestran en el contexto de cada baraja. La ficha del libro no repite el número ni muestra idiomas o un resumen agregado de repaso como filas independientes.
- Marcar «Leído» guarda la lectura y, si quedan barajas propias en borrador, abre un diálogo flotante para cerrarlas juntas. Cada fila muestra nombre y número de tarjetas, o «Vacía (se descartará)». «Confirmar» termina las que tienen contenido y descarta las vacías; «Mantener en borrador», Escape o cerrar conserva sus estados. La advertencia de congelación se muestra antes de confirmar, sin otro diálogo encadenado.
- Un libro leído con notas pendientes permite recuperar ese diálogo desde «Barajas en borrador», junto al estado de lectura. El cierre devuelve al contexto de origen sin abrir un repaso. Los borradores locales deben guardarse o cancelarse antes de terminar sus barajas.

## Selector de barajas

- La recomendación del equipo (`deck.isRecommended`, procedente de `is_recommended`) se muestra en el selector con la etiqueta flotante «Te recomendamos / We recommend» y estrella de puntas redondeadas. Usar la opción aprobada de papel ondulado, fondo miel `#e7d6aa`, texto y estrella en el verde bosque existente `var(--ink)` (`#173d2c`), sin borde ni sombra. El nombre accesible incluye el texto de la etiqueta y el tooltip identifica al equipo. No depende de votos ni de que la baraja esté en borrador o terminada.
- Las distinciones de comunidad se conservan en datos y ordenación, pero siguen ocultas; el detalle no añade distintivos. No mostrar una etiqueta de relleno para barajas sin recomendación. Dar prioridad visual al título, con mayor tamaño que la autoría y todo el ancho disponible. Sus 26 px de margen superior dejan espacio al distintivo sin solapar el título.
- El idioma se representa con un chip después del ojo y antes del estado de creación. Usar los SVG suaves de `brand/icons/languages/` (España para español y Reino Unido para inglés); para otros idiomas, globo neutro con su etiqueta de idioma. Conservar el nombre localizado del idioma en el nombre accesible y el tooltip de apertura. No reservar espacio lateral en el título para la bandera.
- Las tarjetas de baraja terminadas no muestran un indicador de estado. Las barajas `draft` muestran «Borrador / Draft» después del chip de idioma. Conservar «Baraja en borrador / Draft deck» en el nombre accesible. En una baraja aún no añadida a Decks, indicar que puede previsualizarse y que hay que añadirla para repasarla. La fila de chips puede envolver en móvil estrecho.
- Antes del ojo, mostrar un chip con el icono de dos tarjetas cerradas y su número. Sustituye a «X tarjetas · Y niveles»; el selector omite los niveles también en su nombre accesible. El icono `cards.svg` deriva de `cards-pen.svg` y mantiene sus dos tarjetas sin lápiz; no sustituye al icono de «Tomar nota». Todos los chips de la fila comparten estilo sin borde.

## Vista exclusiva de tarjetas

- La valoración («Me gusta» / «No me gusta») y las acciones «Guardar tarjeta» / «Quitar de guardadas» aparecen únicamente dentro de la vista exclusiva de la tarjeta. Nunca aparecen en previsualizaciones fuera de esa vista, incluida la tarjeta del calendario de la idea del día.
- Si la baraja de la tarjeta está en borrador, mostrar «Baraja en borrador / Draft deck» como chip informativo en su vista exclusiva.
- Al pulsar la tarjeta compacta de la idea del día, se abre su vista exclusiva. Las acciones de valoración y guardado viven dentro de esa vista.

## Enlaces de atribución

- Los enlaces con icono, nombre y flecha comparten el mismo estilo en tarjetas y fichas de libros, incluido «Añadido por».
- El nombre no lleva subrayado en reposo. Al pasar el cursor se subraya solo el nombre. Se mantiene el indicador visible de foco para teclado.
- Siguen siendo enlaces semánticos y pulsables a su destino. Reutilizar el componente `nameLink` de `app/views.mjs` (icono, nombre, destino e idioma opcional) y su estilo compartido `card-attribution-row`, sin definir variantes por pantalla.
- Sin destino, el componente muestra icono y nombre como texto, sin flecha ni interacción. Sin nombre, no se muestra.
- La autoría de barajas usa este mismo enlace, sin el prefijo «Creada por». Su texto es secundario respecto al título: 11 px y peso 500 en la tarjeta del selector. El enlace abre el perfil de forma independiente de la apertura de la baraja; no anidar enlaces dentro de botones.

## Glosario

Usar estos términos de forma consistente en la interfaz y en la documentación editorial vigente. Los nombres internos del código y los archivos de datos pueden conservar sus términos técnicos.

| Concepto | Español | Inglés |
| --- | --- | --- |
| Catálogo global | Librería | Library |
| Colección personal | Biblioteca | Bookcase |
| Libros de la colección personal | Estantería | Shelf |
| Barajas de la colección personal | Tarjetero | Decks |
| Conjunto de repaso | Baraja | Deck |
| Creación abierta (`status=draft`) | Borrador / Baraja en borrador | Draft / Draft deck |
| Creación cerrada (`status=published`) | Terminada | Finished |
| Contenido pendiente del editor | Nota sin guardar | Unsaved note |
| Aprendizaje activo | Barajas en repaso | Decks being practiced |
| Coste de añadir una baraja ajena | Una hoja | One leaf |
| Unidad de contenido | Tarjeta | Card |
| Texto citado | Cita | Quote |
| Relación entre tarjetas | Colocar debajo de | Place under |
| Actividad de aprendizaje | Repaso / repasar | Practice / practice |
| Capturar una idea o cita | Tomar nota | Take a note |
| Recompensa diaria | Hoja | Leaf |
| Contenido creado por usuarios | Contribuciones | Contributions |
| Progreso de una persona en un libro | Crecimiento | Growth |

En castellano, llamar **tarjeta** a cada unidad de contenido; no usar **carta** como sinónimo. **Hoja** conserva el juego intencional entre página y hoja de planta. **Cita** se refiere a un texto citado dentro del contexto de tarjetas. Usar **Practice** para la actividad de aprendizaje en inglés. La Biblioteca / Bookcase personal contiene dos vistas: Estantería / Shelf para libros y Tarjetero / Decks para barajas. En los textos que llevan a la colección propia, decir «mi biblioteca / my Bookcase» para distinguirla de la Librería / Library, que es el catálogo. Las barajas creadas por la persona aparecen automáticamente en Decks. Añadir una baraja de otra persona a Decks cuesta una hoja; repasar sus tarjetas no gasta hojas.

Para iniciar la captura de una idea o cita, usar siempre **Tomar nota / Take a note**, incluidos botones, nombres accesibles, encabezados del editor y título de página. Reutilizar la clave de traducción `takeNote`. Evitar las variantes «Añadir contenido», «Añadir tarjeta» y «Añadir cita» para esta acción. Idea / Cita identifica el tipo dentro del editor; Tarjeta sigue nombrando la unidad de lectura y repaso.

«Tomar nota» abre el editor directamente cuando la baraja ya está determinada. Guardar o cancelar devuelve al punto de partida, conservando vista, filtros, posición y foco. «Gestionar baraja / Manage deck» es el acceso a revisar las notas propias y marcar la baraja como terminada; no es un paso previo para tomar una nota.

Si el «+» de Inicio no tiene una baraja propia en borrador, abre el editor de nota directamente. Se avisa de que se creará «Notas de lectura» / «Reading notes». La baraja nace al guardar la primera nota, con el idioma elegido para la app al abrir el editor, independiente del idioma original del libro. No se pide configurar nombre o idioma. Cancelar no crea una baraja vacía.

Borrador describe creación y no privacidad. Guardar comparte el contenido con quienes tienen acceso al catálogo; terminar cierra cambios, no lo hace visible por primera vez. El estado editorial `draft/reviewed` es independiente de `status`. Los nombres internos `deckInProgress` y `notesInProgress` conservan su contrato, pero su copy de creación usa Borrador. Las notas sin guardar solo se recuperan en el navegador y dispositivo donde se conservaron.

## Cómo usarla

Aplicar estos criterios con juicio en cada cambio; no asumir que describen la interfaz actual ni que anticipan decisiones futuras. Para entender el comportamiento vigente, consultar la implementación. Para conocer el arte vigente, consultar los recursos usados por la aplicación. Los archivos de exploración de marca son propuestas salvo confirmación explícita.
