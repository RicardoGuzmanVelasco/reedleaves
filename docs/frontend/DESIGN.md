# Guía de diseño

Esta guía reúne criterios generales para diseñar Reedleaves. No es una especificación completa, un registro de decisiones ni una fuente de verdad del producto.

## Criterios

- Priorizar la simplicidad funcional: cada pantalla debe ayudar a completar una tarea clara.
- Mantener una estética cálida, expresiva y amable. El juego visual debe apoyar la lectura y el aprendizaje.
- Evitar complejidad, adornos y casos de uso que no aporten valor directo.
- Escribir de forma breve, clara y humana. Incluir solo el texto necesario para usar la interfaz.
- Tratar la iconografía de las acciones clave como parte del sistema de producto: una acción recurrente debe conservar un símbolo reconocible en todos sus puntos de entrada. Cuando haya espacio, el icono acompaña al texto y no lo sustituye.
- Diseñar para distintos tamaños de pantalla y respetar accesibilidad, movimiento reducido y controles semánticos.

## Chips informativos

- Los chips informativos no llevan borde ni sombra propia. Mantener un estilo compartido para los que aparecen juntos: fondo, radio, tipografía y espaciado. El chip «En progreso» comparte estilo con el del ojo. Esta regla también se aplica a los chips de estado e idioma del detalle de baraja.

## Selectores de cápsula

- Por defecto, ocupan el ancho necesario para sus opciones, sin estirarse para rellenar el contenedor. El selector de lectura de la ficha del libro se centra horizontalmente.

## Ficha del libro

- La zona inferior concentra el acceso al contenido en una única acción: «Ver barajas · N» / «View decks · N», con el número de barajas disponibles.
- Después de cambiar un libro a «Leyendo» o «Leído» desde Librería, la ficha abierta ofrece una sugerencia temporal para «Tomar nota». El atajo abre el editor o el selector de baraja que corresponda y regresar conserva la misma ficha.
- Idioma, estado de creación y progreso de repaso se muestran en el contexto de cada baraja. La ficha del libro no repite el número ni muestra idiomas o un resumen agregado de repaso como filas independientes.
- Marcar «Leído» guarda la lectura y, si quedan barajas propias en progreso, abre un diálogo flotante para cerrarlas juntas. Cada fila muestra nombre y número de tarjetas, o «Vacía (se descartará)». «Confirmar» termina las que tienen contenido y descarta las vacías; «Mantener en progreso», Escape o cerrar conserva sus estados. La advertencia de congelación se muestra antes de confirmar, sin otro diálogo encadenado.
- Un libro leído con notas pendientes permite recuperar ese diálogo desde «Notas en progreso», junto al estado de lectura. El cierre devuelve al contexto de origen sin abrir un repaso. Los borradores locales deben guardarse o cancelarse antes de terminar sus barajas.

## Selector de barajas

- Las distinciones editoriales y de comunidad se conservan en los datos y la ordenación, pero no se muestran en el selector ni en su detalle. No mostrar una etiqueta de relleno para las barajas sin distinción. Dar prioridad visual al título, con mayor tamaño que la autoría y espacio reservado para el idioma.
- El idioma de cada tarjeta del selector se representa con una bandera en la esquina superior derecha (España para español y Reino Unido para inglés), sin fila de texto inferior. Conservar el nombre del idioma en el nombre accesible de la apertura de baraja y al pasar el cursor por la bandera.
- Las tarjetas de baraja terminadas no muestran un indicador de estado. Las que siguen en progreso muestran el chip «En progreso / In progress» después del ojo, en la misma fila. Conservar «Baraja en progreso / Deck in progress» en el nombre accesible de la tarjeta y, en el detalle, el aviso de que sus tarjetas podrían cambiar.
- Antes del ojo, mostrar un chip con el icono de dos tarjetas cerradas y su número. Sustituye a «X tarjetas · Y niveles»; el selector omite los niveles también en su nombre accesible. El icono `cards.svg` deriva de `cards-pen.svg` y mantiene sus dos tarjetas sin lápiz; no sustituye al icono de «Tomar nota». Todos los chips de la fila comparten estilo sin borde.

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
| Catálogo | Librería | Library |
| Colección personal | Biblioteca | Bookshelf |
| Conjunto de repaso | Baraja | Deck |
| Unidad de contenido | Tarjeta | Card |
| Texto citado | Cita | Quote |
| Relación entre tarjetas | Colocar debajo de | Place under |
| Actividad de aprendizaje | Repaso / repasar | Practice / practice |
| Capturar una idea o cita | Tomar nota | Take a note |
| Recompensa diaria | Hoja | Leaf |
| Contenido creado por usuarios | Contribuciones | Contributions |
| Progreso de una persona en un libro | Crecimiento | Growth |

En castellano, llamar **tarjeta** a cada unidad de contenido; no usar **carta** como sinónimo. **Hoja** conserva el juego intencional entre página y hoja de planta. **Cita** se refiere a un texto citado dentro del contexto de tarjetas. Usar **Practice** para la actividad de aprendizaje en inglés.

Para iniciar la captura de una idea o cita, usar siempre **Tomar nota / Take a note**, incluidos botones, nombres accesibles, encabezados del editor y título de página. Reutilizar la clave de traducción `takeNote`. Evitar las variantes «Añadir contenido», «Añadir tarjeta» y «Añadir cita» para esta acción. Idea / Cita identifica el tipo dentro del editor; Tarjeta sigue nombrando la unidad de lectura y repaso.

«Tomar nota» abre el editor directamente cuando la baraja ya está determinada. Guardar o cancelar devuelve al punto de partida, conservando vista, filtros, posición y foco. «Gestionar baraja / Manage deck» es el acceso a revisar las notas propias y marcar la baraja como terminada; no es un paso previo para tomar una nota.

Si el «+» de Inicio no tiene una baraja propia en progreso, abre el editor de nota directamente. Se avisa de que se creará «Notas de lectura» / «Reading notes». La baraja nace al guardar la primera nota, con el idioma elegido para la app al abrir el editor, independiente del idioma original del libro. No se pide configurar nombre o idioma. Cancelar no crea una baraja vacía.

## Cómo usarla

Aplicar estos criterios con juicio en cada cambio; no asumir que describen la interfaz actual ni que anticipan decisiones futuras. Para entender el comportamiento vigente, consultar la implementación. Para conocer el arte vigente, consultar los recursos usados por la aplicación. Los archivos de exploración de marca son propuestas salvo confirmación explícita.
