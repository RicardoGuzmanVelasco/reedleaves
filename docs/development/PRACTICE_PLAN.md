# Repasar · Plan de implementación

Estado: diseño en curso. Este documento conserva los acuerdos de la conversación del 17 de octubre de 2026 y separa los incrementos futuros de las decisiones pendientes. Todavía no implementa el nuevo modo.

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

## Incremento 2 · Alcance pendiente

No se ha definido un contenido específico para este incremento. La invitación a recordar queda registrada como posibilidad futura, sin asignarla todavía a este incremento ni convertirla en requisito del primero.

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
