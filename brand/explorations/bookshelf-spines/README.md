# Exploración de lomos · móvil

Punto 14 del feedback. Propuestas visuales locales; todavía no se ha elegido una variante para la app. Se estudia el aspecto, sin decidir cuándo ni dónde se activa.

## Dirección actual

`index.html` permite comparar Vertical y Horizontal con los mismos doce libros de ejemplo. Son dos orientaciones del mismo lenguaje visual, no paletas distintas.

- Reutilizar el color actual de las portadas: verde `#e4f0cc`, canto `#9fca82`, borde `#779a72`, tinta `#173d2c` y profundidad `#1e4c2e`. Papel `#fff9ed`; las baldas mantienen la madera de la app. Sin un color diferente para cada libro.
- Tipografía: copiar exactamente la familia de la app — `"Avenir Next Rounded","Arial Rounded MT Bold","Avenir Next",system-ui,sans-serif` — y `font-synthesis:none`, sin fuentes externas.
- Construcción coherente con la portada: la franja izquierda verde oscura representa el lomo. Visto de frente, el lomo es oscuro completo y las tapas claras asoman como bordes laterales. En horizontal, estos bordes pasan arriba y abajo.
- Diseñar para móvil. El título debe ser completo, legible y más importante que el autor. No requiere hover, seleccionar un libro ni mostrar una leyenda de selección para leerlo.
- Vertical: seis lomos finos por estante, con el ancho aproximadamente reducido a la mitad respecto a la revisión anterior. El título ocupa la cara visible; el autor se conserva en el nombre accesible. Dos estantes.
- Horizontal: altura mínima de 44 px, frente a 89 px en la revisión anterior. Título completo en lectura normal y autor secundario; crece lo necesario para títulos de dos líneas. Sin un libro resaltado.
- Los libros son muestras gráficas, sin acciones conectadas ni cambios en datos. Los botones superiores de este estudio solo alternan la orientación.

La comparación presentada en conversación usa el mismo contenido. No cambia la ficha ni las portadas de la app.

## Propuesta reservada

`archive/lomo-portada.html` conserva la propuesta inicial de lomo + portada: una portada visible entre lomos por estante, profundidad de papel y cambio mediante toque. Queda fuera de la primera dirección a desarrollar, pero se conserva para poder retomarla.

Es una referencia histórica: mantiene los colores de aquella primera exploración. Si se retoma, deberá adaptarse al verde uniforme de las portadas y revisarse su interacción para móvil, la tipografía de la app y la continuidad de los colores entre lomo y tapas. El archivo funciona por sí solo, sin depender del carrusel de la conversación.

## Verificación

Estructura HTML y sintaxis de scripts comprobadas. El contraste del texto sobre el verde del lomo es 6,46:1. La comparación activa no contiene selección de libros ni dependencias de red. `npm run lint` correcto y `npm test` completo con build: 318 pruebas, salida 0, Node 24.21.0.
