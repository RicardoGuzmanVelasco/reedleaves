# Intereses · brief operativo de interfaz

Guía para implementar y revisar los incrementos 05, 09, 13, 22 y 23. Las fuentes autoritativas son [DESIGN.md](DESIGN.md) y [INTERESTS_PLAN.md](../development/INTERESTS_PLAN.md). El plan fija comportamiento, límites, copy y activación. DESIGN fija el lenguaje visual. Este brief no sustituye sus decisiones.

Las medidas, composición y referencias de componentes indicadas aquí son guía de implementación. Ajustarlas según las capturas y el uso real, conservando los contratos aprobados. No se han realizado capturas ni QA visual para este brief.

## Dirección común

- Una tarea clara: elegir intereses y expresar su orden. Mantener simplicidad funcional, pomposidad estética y pocos casos de uso.
- Alcanzar la presencia visual de Repasar mediante composición, emojis grandes, superficies luminosas, profundidad de controles y movimiento de selección. No añadir slogans, ilustraciones ni mascotas nuevas.
- Usar el vocabulario del plan: intereses que le interesan e intereses que no le interesan. En selección: «Marca cuáles te interesan especialmente» y «Marca cuáles no te interesan en absoluto». Sección pública: «Intereses». No introducir «categorías» ni «intereses positivos/negativos».
- Toda la interfaz tiene ES/EN. Emoji decorativo y nombre localizado visible; el emoji no sustituye una etiqueta accesible.

## Componentes y límites de reutilización

- Compartir un chip informativo y un selector de intereses con variante compacta y expresiva. No introducir otra biblioteca de UI.
- `app/views.mjs`: partir de `bookGenresMarkup`, `priceTag`, `profile-section` y controles semánticos existentes. Resolver nombre, emoji y color desde el catálogo, sin otra lista editorial en el cliente.
- `app/reader.css`: reutilizar familias de DESIGN, el fondo luminoso de selección de Repasar y su lenguaje de profundidad/pulsación. Compartir el tratamiento visual sin activar comportamiento de sesiones de Repasar.
- `showAppModal` y `createModalPageLock` sirven para apertura y bloqueo del fondo. El cierre debe depender del flujo.
- Los flujos obligatorios no se descartan con Escape ni backdrop y no muestran cierre. El manejador genérico de `.deck-modal` actualmente cierra con ambos: no heredarlo sin adaptar esa política. El editor del perfil sí permite cancelar y regresar.
- Mantener foco estable tras seleccionar o renumerar. Evitar que un render completo reinicie todas las animaciones o devuelva el foco al principio. Reutilizar el anuncio accesible común para cambios relevantes.

## 05 · Emojis y chips informativos

- Mostrar los siete emojis aprobados por el plan. El contrato del catálogo y sus fuentes editoriales contienen emoji y color, incluidos los intereses ausentes del seed local.
- Chip con degradado radial tenue entre blanco y el color asociado; nombre en tinta del proyecto. Sin borde ni sombra propia. Mantener radio, tipografía y separación comunes; envolver chips completos al faltar ancho.
- Elegir colores de las familias existentes y definirlos una sola vez. Dos intereses pueden compartir familia; no hace falta inventar siete colores. El color identifica el interés, no su estado personal.
- Conservar filtros y opciones nativas como texto legible. No simular chips dentro de `<option>`.
- Los chips de libros no incorporan símbolos de preferencias personales. En preferencias, tick verde estilizado para lo que le interesa y aspas rojas estilizadas para lo que no le interesa; el color nunca comunica solo el estado.
- Revisar `.deck-tags span`: al introducir spans internos para emoji o marcador, limitar el estilo al chip para evitar fondos y paddings duplicados.

## 09 · Selección ordenada al crear un libro

- Variante compacta: casilla real, emoji, nombre y espacio fijo para número. Cada fila completa es táctil. Los selectores son controles; su superficie y profundidad se distinguen de los chips informativos.
- Mantener lugar y orden DOM de todas las casillas. Marcar asigna 1, 2 y 3 según el clic; quitar renumera; volver a marcar añade al final. Sin arrastre, subir/bajar ni recolocación automática.
- Mostrar la instrucción aprobada junto al grupo: «Elige la principal. Añade hasta dos más solo si describen una parte importante del libro» y su traducción.
- Guía visual: contador funcional y columna reservada para números. El 1 identifica el principal sin parecer una recomendación editorial.
- Con tres seleccionados, permitir quitar cualquiera y comunicar cómo cambiar la elección. No aceptar un cuarto ni sustituir otro silenciosamente. Mantener semántica, foco y explicación del límite.
- Manual y autorrelleno comparten el mismo selector y orden. Los campos manuales están disponibles desde el principio; no abrir un segundo flujo para elegir intereses.

## 13 · Perfil y editor

- Sección pública «Intereses» integrada en el ritmo del perfil. Mostrar ambas listas separadas y en su orden, con número, emoji, nombre y símbolo. No mezclarlas en una nube ni convertir cada elemento público en una tarjeta grande.
- Solo el propietario ve Editar. Idiomas de tarjetas y premios no forman parte de esta sección pública.
- El editor reutiliza el selector, con instrucciones y estados claros para cada lista. Tres es lo recomendado; cuatro y cinco siguen siendo válidos. Guardar exige al menos uno que le interese. No mostrar premios ni `priceTag`.
- Resolver la disyunción dentro del mismo borrador y comunicar cualquier traslado entre listas. No guardar preferencias al pulsar una casilla.
- Cancelar restaura lo guardado y devuelve el foco a Editar. Un conflicto conserva el borrador y permite recuperar los valores actuales; no sobrescribir silenciosamente.

## 22 · Flujo inicial obligatorio

- Dos pasos sobre el fondo compartido de Repasar. Jerarquía: progreso, instrucción, selector, incentivo y navegación. El título puede envolver en ES/EN; no forzar una línea que recorte texto.
- Variante expresiva: emojis grandes, nombres completos y marcador reservado. Guía: dos columnas donde quepan y una en móvil estrecho. Cada casilla conserva su posición al interactuar. Permitir scroll y adaptar altura al texto.
- Paso 1 necesita al menos uno. El incentivo de hojas aparece desde la primera selección. Paso 2 permite cero; el incentivo de pétalos aparece desde cero. Mantener la explicación funcional aprobada y el regreso al primer paso.
- Mostrar los premios mediante `priceTag`, icono y cantidad. Su contexto y nombre accesible explican que son premios condicionados a tres selecciones; no parecen un cobro. Usar el copy aprobado sobre recibirlos ahora y no al editar después.
- Atrás, recarga y error conservan el borrador por cuenta. Guardar tiene estado ocupado y reintento. No añadir omisión ni cierre del flujo obligatorio.
- Al volver a Inicio, animar solo el recibo real del servidor: incrementos de uno en uno con latido por cada +1. La animación no escribe saldo; movimiento reducido muestra el resultado sin latidos. No rediseñar esta decisión ya aprobada.

## 23 · Nuevos intereses

- Usar siempre el mismo flujo de dos pasos, también cuando hay un único interés nuevo. No crear una variante adicional de tres botones.
- Título singular/plural aprobado. Presentar los nuevos juntos y el orden existente como contexto compacto, separado de las opciones nuevas. Las selecciones se añaden al final de su lista.
- Si la lista tiene cinco, elegir qué interés sustituir dentro del mismo panel. No apilar modales. Cancelar la sustitución conserva el borrador y permite dejar el interés neutral.
- Sin cierre, Escape ni descarte por backdrop. Sin premios. Lo nuevo no marcado queda neutral al finalizar; no exigir respuesta fila por fila.
- Conservar selección ante errores y ofrecer recuperación/reintento. No bloquear con un panel vacío ni registrar respuestas ficticias. Reconocer solo los IDs realmente mostrados, según el contrato del plan.

## Movimiento, tacto y accesibilidad

- La respuesta principal funciona al tocar: hundimiento, recuperación breve y aparición del número/símbolo. Puede acompañarla un movimiento corto del emoji. No desplazar controles hasta invadir sus vecinos.
- Concentrar movimiento en entrada, selección y cambio de paso. Evitar siete emojis animándose continuamente o brillos de compra sobre chips y premios. El hover es un refuerzo opcional.
- Con movimiento reducido, eliminar rebotes, desplazamientos y latidos; conservar todas las señales estáticas. No esperar una animación para permitir continuar.
- Objetivos táctiles de al menos 44 × 44 px, foco visible, casillas etiquetadas, `fieldset`/`legend` y ayuda asociada. Anunciar orden y límites en contexto sin duplicar la lectura del emoji y el nombre.
- No tapar opciones, ayuda o acciones con barra inferior, footer o teclado. El texto largo conserva legibilidad; no usar truncado como solución principal.

## Puerta de revisión pendiente por incremento

Comparar capturas móvil/escritorio del resultado con Repasar en el mismo viewport. Revisar composición, luminosidad, profundidad, jerarquía, feedback táctil y movimiento. Un build correcto no acredita calidad visual; otro agente debe revisar la evidencia conforme al plan.

Cubrir ES/EN, nombres largos, altura reducida, teclado/foco, tacto y movimiento reducido. Comprobar selección, quitar en medio, volver a marcar, límites, disyunción, regreso, cambio de cuenta, sustitución cancelada, carga/error/reintento y borrador restaurado. En 22, comprobar ambos incentivos y la recepción autoritativa; en 23, un interés y varios, listas llenas y neutral implícito.

Al cerrar cada incremento, registrar la evidencia realmente realizada y consolidar en DESIGN solo las reglas aprobadas, sin convertir esta guía previa en QA completada.
