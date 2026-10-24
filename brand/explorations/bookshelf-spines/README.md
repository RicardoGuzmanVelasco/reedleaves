# Exploración de lomos · móvil

Punto 14 del feedback. Propuestas visuales locales; todavía no se ha elegido una variante para la app. Se estudia el aspecto, sin decidir cuándo ni dónde se activa.

## Dirección actual

`index.html` permite comparar Vertical y Horizontal con los mismos doce libros de ejemplo. Son dos orientaciones del mismo lenguaje visual, no paletas distintas.

- Reutilizar el color actual de las portadas: verde `#e4f0cc`, canto `#9fca82`, borde `#779a72`, tinta `#173d2c` y profundidad `#1e4c2e`. Papel `#fff9ed`; las baldas mantienen la madera de la app. Sin un color diferente para cada libro.
- Tipografía: copiar exactamente la familia de la app — `"Avenir Next Rounded","Arial Rounded MT Bold","Avenir Next",system-ui,sans-serif` — y `font-synthesis:none`, sin fuentes externas.
- Distribución de color revisada por el usuario: verde oscuro en ambos bordes longitudinales y verde claro en el centro donde va el texto. Al girar el libro, los bordes oscuros pasan de los lados a arriba y abajo.
- Diseñar para móvil. El título tiene prioridad sobre el autor: una sola línea, sin saltos; puntos suspensivos al alcanzar el tamaño mínimo si no cabe. El nombre completo permanece accesible. No requiere hover, seleccionar un libro ni mostrar una leyenda de selección para leerlo.
- Vertical: seis lomos de 34 px por estante. Texto girado 90°, centrado en ambos ejes y en una sola línea. Letra entre 13 y 22 px según la medida real del título en la tipografía de la app. El autor se conserva en el nombre accesible. Dos estantes.
- Horizontal: altura mínima de 44 px. Título en una sola línea, letra entre 14 y 18 px y autor secundario. Se recuperan anchuras distintas, desplazamientos de hasta 6 px y giros leves de hasta 0,6°: los libros vuelven a parecer apilados y descuadrados. Sin un libro resaltado.
- Variación de tamaño: se calcula con una semilla estable por libro para que no salte al repintar. Primero se ajusta la letra con límites; solo después se permite reducir la longitud si el título cabe completo. La reducción respeta la medida del texto y se revierte si el navegador detecta desbordamiento. Un título truncado conserva la longitud máxima disponible.
- El ajuste se repite al cambiar el ancho, cargar las fuentes o mostrar una orientación que estaba oculta. No se cambia el contenido del título para dibujar los puntos suspensivos.
- Los libros son muestras gráficas, sin acciones conectadas ni cambios en datos. Los botones superiores de este estudio solo alternan la orientación.

La comparación presentada en conversación usa el mismo contenido. No cambia la ficha ni las portadas de la app.

## Propuesta reservada

`archive/lomo-portada.html` conserva la propuesta inicial de lomo + portada: una portada visible entre lomos por estante, profundidad de papel y cambio mediante toque. Queda fuera de la primera dirección a desarrollar, pero se conserva para poder retomarla.

Es una referencia histórica: mantiene los colores de aquella primera exploración. Si se retoma, deberá adaptarse al verde uniforme de las portadas y revisarse su interacción para móvil, la tipografía de la app y la continuidad de los colores entre lomo y tapas. El archivo funciona por sí solo, sin depender del carrusel de la conversación.

## Verificación

Estructura HTML y sintaxis de scripts comprobadas. El contraste del texto sobre el centro verde claro es 10,13:1. La comparación activa no contiene selección de libros ni dependencias de red. `npm run lint` correcto y `npm test` completo con build: 318 pruebas, salida 0, Node 24.21.0.
