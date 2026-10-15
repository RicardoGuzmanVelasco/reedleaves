# Guía de diseño

Esta guía reúne criterios generales para diseñar Reedleaves. No es una especificación completa, un registro de decisiones ni una fuente de verdad del producto.

## Criterios

- Priorizar la simplicidad funcional: cada pantalla debe ayudar a completar una tarea clara.
- Mantener una estética cálida, expresiva y amable. El juego visual debe apoyar la lectura y el aprendizaje.
- Evitar complejidad, adornos y casos de uso que no aporten valor directo.
- Escribir de forma breve, clara y humana. Incluir solo el texto necesario para usar la interfaz.
- Diseñar para distintos tamaños de pantalla y respetar accesibilidad, movimiento reducido y controles semánticos.

## Selectores de cápsula

- Por defecto, ocupan el ancho necesario para sus opciones, sin estirarse para rellenar el contenedor. El selector de lectura de la ficha del libro se centra horizontalmente.

## Ficha del libro

- La zona inferior concentra el acceso al contenido en una única acción: «Ver barajas · N» / «View decks · N», con el número de barajas disponibles.
- Idioma, estado de creación y progreso de repaso se muestran en el contexto de cada baraja. La ficha del libro no repite el número ni muestra idiomas o un resumen agregado de repaso como filas independientes.
- Marcar «Leído» guarda la lectura y, si quedan barajas propias en progreso, abre un diálogo flotante para cerrarlas juntas. Cada fila muestra nombre y número de tarjetas, o «Vacía (se descartará)». «Confirmar» termina las que tienen contenido y descarta las vacías; «Mantener en progreso», Escape o cerrar conserva sus estados. La advertencia de congelación se muestra antes de confirmar, sin otro diálogo encadenado.
- Un libro leído con notas pendientes permite recuperar ese diálogo desde «Notas en progreso», junto al estado de lectura. El cierre devuelve al contexto de origen sin abrir un repaso. Los borradores locales deben guardarse o cancelarse antes de terminar sus barajas.

## Enlaces de atribución

- Los enlaces con icono, nombre y flecha comparten el mismo estilo en tarjetas y fichas de libros, incluido «Añadido por».
- El nombre no lleva subrayado en reposo. Al pasar el cursor se subraya solo el nombre. Se mantiene el indicador visible de foco para teclado.
- Siguen siendo enlaces semánticos y pulsables a su destino. Reutilizar el componente `nameLink` de `app/views.mjs` (icono, nombre, destino e idioma opcional) y su estilo compartido `card-attribution-row`, sin definir variantes por pantalla.
- Sin destino, el componente muestra icono y nombre como texto, sin flecha ni interacción. Sin nombre, no se muestra.

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

## Cómo usarla

Aplicar estos criterios con juicio en cada cambio; no asumir que describen la interfaz actual ni que anticipan decisiones futuras. Para entender el comportamiento vigente, consultar la implementación. Para conocer el arte vigente, consultar los recursos usados por la aplicación. Los archivos de exploración de marca son propuestas salvo confirmación explícita.
