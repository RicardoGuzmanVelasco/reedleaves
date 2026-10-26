# PRD: progresión de la racha de la idea del día

Estado: borrador para revisión. Cadencia ordinaria provisional: días 3, 5, 7, 10, 15, 21, 30, 45… No hay pista de bienvenida en el alcance actual. La acción de reavivar, las recompensas concretas y el mapeo de mascotas siguen pendientes.

## Resumen

Crear un camino de recompensas que dé motivos para completar y repetir ciclos de racha de la idea del día. Las mascotas de fuego pueden simbolizar visualmente los hitos en una fase futura, pero no forman parte del alcance de recompensas actual. La interfaz mostrará solo el progreso actual y el siguiente hito, sin nombres de mascotas ni una lista de metas posteriores.

Al perder una racha, el ciclo queda un día en estado especial **Rescoldo**. Se puede reavivar mediante una acción especial aún por definir. Si no se reaviva durante ese día, el ciclo termina y empieza uno nuevo. Cada meta alcanzada cuenta una vez durante el ciclo activo, y su recompensa puede entregarse en ese momento. Un ciclo largo también suma a las metas anteriores; el cierre posterior solo fija el máximo final.

## Problema y objetivo

La racha actual se presenta como un número. Queremos que los ciclos den recompensas acumulables y metas repetibles. Las mascotas pueden ayudar a entender el recorrido, pero no deben ser la razón principal para implementarlo ni bloquear su lanzamiento.

El sistema debe:

- Definir primero qué se gana, cuándo se gana y cómo se conserva el progreso de recompensas entre ciclos.
- Dar a cada ciclo y a su repetición un valor claro, incluso sin arte de mascotas.
- Permitir una oportunidad acotada de recuperación mediante Rescoldo.
- Usar las mascotas para simbolizar el nivel alcanzado en cada ciclo, sin atar el contenido de la recompensa a su diseño.
- Mantener reglas diarias coherentes con el ciclo horario centralizado del proyecto.

## Prioridad: diseñar las recompensas

La definición de recompensas precede al arte de mascotas. Cada recompensa necesita especificar qué obtiene la persona, en qué hito se desbloquea, si se entrega automáticamente o se reclama, y qué incentivo conserva al reiniciar el ciclo.

La unidad de progreso es el número de ciclos que alcanzaron una meta. Repetir una meta después de varios ciclos puede desbloquear hitos de recompensa distintos. Si una racha alcanza una meta más alta, cuenta también para las metas inferiores.

La primera matriz de recompensas deberá fijar los premios para la cadencia ordinaria y sus repeticiones. Por cada hito se decidirá:

| Campo | Decisión necesaria |
| --- | --- |
| Meta | Qué estadio o logro del ciclo cuenta. |
| Repeticiones | Cuántos ciclos finalizados hacen falta. |
| Recompensa | Beneficio concreto que se recibe o desbloquea. |
| Entrega | Automática o reclamada; una vez o repetible. |
| Persistencia | Qué queda en la cuenta después de iniciar otro ciclo. |
| Economía | Efecto en saldos, límites, catálogo y otros usos de la app. |

Las hojas y los pétalos ya tienen funciones, balances y ritmos de recarga propios. Se pueden evaluar como recompensas, pero no se reutilizarán sin comprobar el efecto en sus usos actuales. Otras posibilidades —como desbloqueos duraderos o contenido cosmético— también deben compararse por valor, coste de producción y facilidad para repetir el ciclo. No añadir una moneda nueva sin una necesidad demostrada.

### Cadencia y momento de entrega

- La cadencia ordinaria propuesta es **3, 5, 7, 10, 15, 21, 30, 45…** y vuelve a empezar desde el día 3 en cada ciclo nuevo.
- No hay una secuencia especial de bienvenida ni premios diarios durante la primera semana en el alcance actual.
- Una meta de estadio se acredita en el momento en que la racha la alcanza, una sola vez dentro de ese ciclo. Cuando el contador total cruza el requisito de un premio, se entrega entonces; no se espera a perder la racha ni a que venza Rescoldo.
- Al alcanzar un estadio superior, se acredita también cada meta inferior que aún no se hubiera acreditado en ese ciclo. Esto preserva la regla de que una racha larga impulsa todas las metas anteriores.
- El cierre del ciclo registra el máximo final y habilita un ciclo nuevo; no es el momento ordinario de entrega de premios. Rescoldo puede demorar el cierre, pero no debe retener recompensas ya ganadas.
- Así, una racha que nunca se interrumpe sigue dando premios por sus hitos, y los ciclos repetidos aportan nuevas consecuciones sin poder contar dos veces el mismo estadio dentro de una sola racha.

La cadencia es una propuesta de ritmo, no un compromiso sobre el valor de cada premio. Se revisará cuando la matriz concrete qué se obtiene en cada hito y qué frecuencia puede sostener la economía.

## Exploración futura de mascotas

La posible línea incluye, como vocabulario de trabajo, Cenizas, Chispa (corrige «Chipa»), Llamita, Llama, Llamarada, Ascua, Brasa, Fogata, Hoguera, Lumbre, Chimenea y Volcán. Esta lista no fija orden, umbrales ni asignación. Los nombres y diseños se pueden mover, reemplazar o retirar. La creación de las mascotas se delegará más adelante, después de estabilizar las recompensas. No mostrar nombres ni arte de estas formas en la interfaz de la primera fase.

## Reglas funcionales

### Crecimiento activo

- La interfaz sigue mostrando la racha numérica actual.
- El mapeo entre umbrales de racha y formas de mascota es independiente de la cadencia de recompensas y queda abierto.
- Los umbrales de recompensa son crecientes, explícitos y centralizados; no se inferirán del índice de mascota.
- Solo la actividad válida ya reconocida por la racha actual incrementa el progreso.
- Al finalizar un ciclo se conserva su máximo de racha para calcular recompensas. La forma visual equivalente puede guardarse en una colección posterior.

### Rescoldo y recuperación

- Al día siguiente de perder la continuidad, la racha pasa temporalmente a **Rescoldo**.
- Rescoldo dura un ciclo diario y ofrece una acción especial para reavivar la misma línea. El tipo de acción, su coste o límite y su disponibilidad aún deben decidirse.
- Si termina ese ciclo sin reavivar, se cierra la línea anterior, se registra su máximo y se inicia un ciclo nuevo con cero días.
- Reavivar conserva la identidad de la línea y restaura la continuidad de acuerdo con una regla que se concretará con la acción. No crea una nueva mascota final ni duplica recuentos.
- Las transiciones de día y el vencimiento de Rescoldo usarán la fuente temporal central del servidor, no cálculos locales duplicados.

### Registro de ciclo y recompensas

Hay dos contadores con propósitos distintos; el primero sustenta los hitos de recompensa y el segundo puede mostrarse como colección visual:

1. **Progreso de recompensa por meta:** el ciclo activo suma una consecución al cruzar cada meta, como máximo una vez por hito. Si alcanza un hito alto, suma también los hitos anteriores de ese ciclo. La entrega de cada premio ocurre al cruzar el hito correspondiente.
2. **Historial de ciclos:** una entrada por ciclo terminado, con su máximo alcanzado y fechas necesarias. Puede alimentar una colección de mascotas, pero esa interfaz no es requisito para dar las recompensas.

Las recompensas repetibles dependen del número de ciclos que alcanzaron cada hito. No se espera al cierre de ciclo para entregar un premio ya ganado. El PRD debe completar la matriz inicial de beneficios antes de construir las mascotas; las etiquetas de los estadios siguen pendientes.

## Experiencia y límites

- Mostrar con claridad el ciclo activo, los hitos de recompensa disponibles y, cuando aplique, el estado temporal Rescoldo.
- Usar un timeline de tres referencias: el último hito conseguido en la racha anterior, atenuado y marcado como superado; el último hito conseguido en la racha actual, seleccionado y marcado como superado; y el siguiente hito, activo y sin marca de superado.
- Si todavía no hay una racha anterior con un hito conseguido, omitir esa referencia sin dejar hueco ni marcador vacío.
- Antes de alcanzar el primer hito del ciclo actual, mostrar el inicio de la racha seleccionado sin tick de superado y el día 3 como siguiente hito activo.
- Entre el hito actual y el siguiente, llenar el camino según el progreso de la racha actual. El siguiente hito lleva una animación de halo u ondas y muestra la recompensa y qué hay que alcanzar.
- Después del siguiente hito, el recorrido continúa solo como una línea que se degrada hasta ser transparente; no mostrar hitos, etiquetas ni recompensas posteriores.
- El timeline no depende de mascotas ni de sus nombres. No incluir nombres ni arte de mascotas en la primera fase. Cuando se incorporen, serán una capa secundaria y no ocultarán la recompensa ni serán necesarias para reclamarla.
- Respetar movimiento reducido: el halo/ondas se desactiva o se sustituye por un estado estático destacado.
- Rescoldo debe explicar la acción y el límite de tiempo de forma funcional, sin copy promocional.
- Animaciones táctiles y movimiento reducido respetarán `docs/frontend/DESIGN.md`.
- No mezclar esta progresión con las mascotas vegetales del crecimiento por libro.
- No introducir tienda, moneda nueva, misiones diarias, tablas competitivas ni otras líneas de mascotas como parte de este alcance.

## Datos e invariantes

- La fuente de verdad de racha, Rescoldo, reanimación, ciclos finalizados y recompensas debe ser el servidor asociado a la cuenta.
- Cada transición debe ser idempotente: recargar, repetir una petición o abrir dos dispositivos no puede duplicar un rescate, un cierre de ciclo, progreso ni una recompensa.
- Cada meta de estadio se acredita como máximo una vez en cada ciclo activo, incluso si la persona abre la app en varios dispositivos.
- Un único día local cuenta como máximo una vez y la zona horaria sigue la zona fijada en la cuenta.
- El estadio actual deriva de la racha activa y sus umbrales centralizados.
- El máximo alcanzado se registra una vez cuando se cierra el ciclo; los hitos y las recompensas deben poder validarse contra ese historial.
- La actividad histórica existente no debe reinterpretarse como líneas completadas ni conceder recompensas retroactivas sin una decisión explícita.

## Criterios de éxito

- Una persona entiende qué hito de recompensa está persiguiendo y qué obtiene al alcanzarlo.
- La pantalla muestra el progreso y solo el siguiente hito; no revela las recompensas futuras.
- La racha anterior, el hito actual y el siguiente se distinguen también sin depender solo del color o la animación.
- El primer premio tangible llega pronto, sin exigir terminar el ciclo ni esperar a perder la racha.
- Repetir ciclos sigue dando progreso útil hasta en ciclos más cortos que el mejor récord anterior.
- La pérdida de continuidad muestra Rescoldo durante exactamente el ciclo definido y ofrece una recuperación comprensible.
- Un ciclo no se cierra hasta que vence Rescoldo sin reavivarse.
- Los ciclos largos aportan progreso a todas las metas que alcanzaron.
- El historial y los contadores no se duplican con reintentos o uso multidispositivo.

## Decisiones pendientes antes de cerrar la especificación

- Confirmar la cadencia ordinaria 3, 5, 7, 10, 15, 21, 30, 45… y definir qué beneficio corresponde a cada hito.
- Mapear o revisar la lista exploratoria de mascotas respecto a esos hitos; no mostrar sus nombres hasta cerrar esta decisión.
- Inicio y vencimiento exactos de Rescoldo conforme al día local centralizado.
- Qué significa reavivar, qué acción lo activa, sus límites y posible coste.
- Qué se muestra durante el día de recuperación y cómo se representa la continuidad restaurada.
- La pista de bienvenida queda fuera del alcance inicial; se podrá reabrir más adelante.
- Si se usan hojas o pétalos como recompensa y el impacto aceptable sobre sus usos actuales.
- Nombres editoriales en inglés.
- Creación y diseño de las formas (fase futura, después de estabilizar las recompensas).

## Plan de implementación incremental

Cada incremento debe ser útil por sí solo, con sus reglas y estados verificables. La secuencia prioriza el valor de las recompensas; el arte no se usa como sustituto de una economía todavía indefinida.

### Paso 0 — Diseñar la matriz ordinaria de recompensas (producto, sin código)

- Elegir el beneficio del primer hito del día 3, los siguientes hitos de la cadencia propuesta y cómo escalan al repetirse en ciclos distintos.
- Comprobar si los beneficios usan hojas/pétalos existentes o desbloquean algo durable, y validar sus efectos en saldos y usos.
- Definir la entrega automática o reclamada, el vencimiento si lo hay y cómo se muestra el siguiente hito.
- Valor: se define la curva repetible antes de construir historial o ilustraciones.

### Incremento 1 — Primer hito ordinario

- Detectar la primera vez que una cuenta alcanza el hito del día 3 de racha y entregar su beneficio en ese momento.
- Registrar el hito por ciclo para que pueda volver a obtenerse en una racha futura, sin duplicarlo por reintentos ni dispositivos.
- Mostrar la recompensa en la superficie existente, sin nombres de mascotas, historial de ciclos ni una nueva pantalla.
- Valor: entrega una recompensa de racha real con el cambio funcional más pequeño.

### Incremento 2 — Completar la cadencia y añadir Rescoldo

- Implementar el estado de ciclo activo, Rescoldo, recuperación definida y cierre idempotente en servidor.
- Añadir los hitos 5, 7, 10, 15… de acuerdo con la matriz y entregar cada recompensa al cruzar su hito, sin esperar al cierre.
- Registrar el máximo del ciclo al cerrarlo; no requerir arte ni colección.
- Los ciclos futuros vuelven a empezar en el hito de 3 días.

### Fase futura — Representación con mascotas

- Delegar la exploración de nombres, orden, diseños y correspondencia visual después de estabilizar el sistema de recompensas.
- No exigir una relación monotónica de tamaño entre formas; la progresión puede cambiar de silueta y carácter.
- Mantener la interfaz de recompensas comprensible y completa sin mascotas, nombres o colección.

## Recomendación de secuencia

Empezar por el Paso 0 y cerrar la recompensa del día 3 junto a la cadencia 3, 5, 7, 10… Implementar el primer hito y mostrar solo el progreso actual y el siguiente. Después completar la cadencia y Rescoldo. La exploración de mascotas queda delegada a una fase futura, cuando las recompensas estén estabilizadas.
