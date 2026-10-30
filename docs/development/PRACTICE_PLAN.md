# Repasar · Plan de implementación

Estado: primera versión integrada en la app, con la elección de tema ya diseñada. Este documento conserva los acuerdos de la conversación del 17 de octubre de 2026 y separa los incrementos futuros de las decisiones pendientes. Las reglas de la experiencia continúan en diseño.

## Pendiente posterior

- Valorar si hace falta una experiencia específica de «Repasar una baraja». No se implementa en esta iteración; las tarjetas se pueden consultar sin posición ni progreso por baraja.

## Objetivo y entrada acordados

- Repasar es una sesión propia, satisfactoria y expresiva. Complementa a Idea del día; no la sustituye.
- Inicio ofrece un botón muy atractivo, llamativo y animado con el texto «¡Vamos a repasar!».
- Al pulsarlo se entra en un modo visual separado de la interfaz exterior: fondo limpio, sin HUD ni barra superior global.
- La primera pantalla pregunta «¿Qué te apetece repasar?» y ofrece cuatro opciones:
  - Lo que estoy leyendo.
  - Lo que ya he leído.
  - Mis tarjetas guardadas.
  - Un poco de todo.
- Las tres primeras representan acompañar la lectura actual, recuperar lecturas anteriores y volver a la selección personal. Un poco de todo mezcla esas fuentes; no significa sortear contenido de todo el catálogo.
- La clasificación de lectura del libro es independiente de la creación de barajas y del progreso de repaso.

## Incremento 1 · Tarjeta completa y dos botones

Recorrido base: Inicio → ¡Vamos a repasar! → elegir una de las cuatro opciones → leer tarjeta completa → responder → siguiente tarjeta.

- Mostrar el contenido completo desde el principio, sin invitación previa a recordar, ocultación ni paso de revelación.
- Usar una botonera con exactamente dos respuestas, con asociación espacial clara y estable:

| Posición | Texto aprobado | Intención |
| --- | --- | --- |
| Izquierda | Quiero repasarla pronto | Solicitar que la tarjeta vuelva a aparecer pronto. |
| Derecha | La recordaba | Indicar recuerdo y espaciar su próxima aparición. |

- Ambas respuestas avanzan a la siguiente tarjeta. El comportamiento de selección posterior debe concretarse antes de implementar; todavía no hay intervalos aprobados.
- La posición izquierda/derecha forma parte del contrato de interacción, también en móvil. No invertirla ni convertir la botonera en una columna que pierda esa asociación.
- El primer incremento usa botones. El gesto de swipe queda para el tercer incremento.
- Las otras dos respuestas futuras no aparecen en este incremento.
- La animación debe respetar movimiento reducido. Los botones deben poder usarse con teclado y tener nombres accesibles completos.

### Primera versión local

- Inicio conserva Idea del día y añade el acceso animado «¡Vamos a repasar!» con la mascota Brote.
- «¿Qué te apetece repasar?» ofrece las cuatro categorías acordadas. Leyendo y Leído usan el estado de lectura del libro; Guardadas usa la selección personal; Un poco de todo mezcla las tres fuentes. Una categoría sin tarjetas muestra un estado vacío y permite volver a elegir.
- La elección usa la composición aprobada: fondo degradado estático con luz suave en las esquinas, Brote y pregunta, cierre circular, y cuatro abanicos de tres tarjetas en cuadrícula. La tarjeta frontal recorta un icono grande y semitransparente, con posición y escala propias para cada tema. La cuadrícula se conserva en móvil estrecho. La X tiene fondo claro opaco.
- La sesión muestra el contenido completo sin mascota, con la tarjeta algo más arriba y las dos respuestas separadas algo más abajo. La tarjeta siguiente se monta debajo, ligeramente desplazada y reducida, pero no afecta la altura del escenario ni muestra su contenido mientras queda detrás; permanece fuera del árbol accesible hasta entrar al frente. Al responder, el botón elegido confirma con un pequeño hundimiento y rebote de 180 ms, sin cambiar su paleta. Tras 90 ms, la tarjeta actual sale hacia el lado de la respuesta durante 420 ms; mantiene la opacidad durante la mayor parte del recorrido y se desvanece al final. La siguiente sube y se acerca durante 360 ms. El ciclo hasta que queda estable dura unos 870 ms. Movimiento reducido elimina los movimientos y el retardo.
- El botón de entrada muestra «¡Vamos a repasar!» en una línea, sin flecha, con Brote dentro de un círculo grande. Mascota y texto ocupan el mayor tamaño que admite el ancho; se adaptan a móvil y evitan altura sobrante. El degradado conserva el extremo claro a la derecha, oscurece más el lado izquierdo y mantiene el tono medio hacia la derecha para distinguirse de Brote. El fondo permanece fijo; un brillo estrecho cruza durante unos 0,75 s cada 7,5 s y una ola rápida recorre el texto carácter por carácter: las letras suben y bajan con easing y se solapan. No hay una franja crema permanente. Movimiento reducido desactiva ambas animaciones. Su superficie y contenido responden al cursor sin desplazar Brote ni interrumpir su flotación. El feedback de pulsación sigue disponible en táctil; hover solo refuerza la interacción con cursor preciso. Las respuestas conservan todos sus colores y el tono de sombra al interactuar.
- Para poder revisar ritmo con contenido local, la primera versión toma hasta cinco tarjetas barajadas. Cinco es un valor provisional, no una decisión de producto.
- Terminar muestra un cierre breve. Salir vuelve a Inicio. No se conserva la selección ni se aplican intervalos a respuestas todavía.
- Prueba local de interacción únicamente; no registra estas tarjetas como lecturas ni altera hojas, desbloqueos o crecimiento. La decisión de persistencia y selección futura sigue pendiente.

## Incremento 2 · Alcance pendiente

- Continuar el refinamiento estético tras revisar en local el degradado móvil y la composición centrada en la tarjeta.
- El resto del alcance está pendiente. La invitación a recordar queda registrada como posibilidad futura, sin asignarla todavía a este incremento ni convertirla en requisito del primero.

### Filtro persistente por idioma · idea para después

- Permitir elegir qué idiomas de tarjetas entran en las sesiones de Repasar. El usuario detecta una mezcla de tarjetas en español e inglés.
- Explorar el ajuste en el perfil o en el inicio de Repasar. Si aparece en el inicio, la selección debe persistir entre sesiones y dispositivos mediante la cuenta, no resetearse al cerrar el modo.
- Decidir si el filtro afecta también a Idea del día o solo a Repasar, cómo tratar «Un poco de todo» cuando algunos idiomas quedan excluidos y qué idiomas se incluyen al crear una cuenta sin preferencias.
- Distinguir el idioma del contenido de la tarjeta del idioma de la interfaz y del idioma original del libro. La preferencia y sus efectos quedan por diseñar; no implementados.

## Incremento 3 · Swipe y cuatro respuestas

Dirección futura solicitada por el usuario: explorar una mecánica de swipe tipo Tinder y ampliar a estas cuatro respuestas:

1. La tengo clara.
2. La recordaba.
3. No la recordaba.
4. Quiero repasarla pronto.

- Mantener la asociación aprendida: izquierda para Quiero repasarla pronto y derecha para La recordaba.
- Queda por diseñar cómo se eligen La tengo clara y No la recordaba. No hay direcciones de gesto aprobadas para ellas.
- Concretar el efecto de cada respuesta en la selección futura. No equiparar automáticamente No la recordaba con Quiero repasarla pronto: una expresa recuerdo y la otra una preferencia.
- Conservar una alternativa accesible mediante botones; el gesto no será el único modo de responder.

## Incrementos futuros sin fecha

- Invitar a recordar antes de revelar el contenido. Diseñar por separado su encaje en ideas y citas. Queda fuera del incremento 1.

## Propuestas por concretar antes de implementar la sesión

La conversación planteó sesiones cortas de cinco tarjetas, selección según respuestas y tiempo desde la última aparición, transiciones expresivas, cierre con mascota, resumen y opción de otra sesión. Son propuestas de partida; no parámetros cerrados.

Falta resolver:

- Duración, número de tarjetas y qué ocurre si hay menos contenido elegible.
- Tarjetas elegibles en cada fuente: propias, ajenas, ya abiertas o nuevas; contexto necesario entre tarjetas relacionadas.
- Política inicial de selección, mezcla y repetición; efecto persistente de las respuestas y sus intervalos.
- Relación con hojas, desbloqueos del árbol, progreso de barajas y crecimiento de mascotas. Este plan no autoriza cambios de esas reglas.
- Salida, interrupción y recuperación de la sesión.
- Estados vacíos, carga y errores de las cuatro opciones.
- Composición visual y respuesta animada de botones, transiciones y cierre.
- Traducciones inglesas del nuevo copy funcional.

## Verificación al implementar

- Comprobar el recorrido completo, el contenido visible desde el inicio y la posición estable de las dos respuestas en escritorio y móvil.
- Comprobar teclado, foco, lectura accesible, textos largos y movimiento reducido.
- Comprobar que Idea del día sigue disponible y que entrar o salir del nuevo modo conserva el contexto exterior.
- Verificar las reglas de datos que se aprueben sin modificar por accidente hojas, desbloqueos o estados de lectura/creación.
- Reutilizar los estados base de `test-support/reader-state.mjs` y ejecutar `npm test` completo con la versión de `.node-version` antes de cerrar la implementación. Usar proveedores de IA simulados.
