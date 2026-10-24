# Exploración de lomos · móvil

Punto 14 del feedback. Propuestas visuales locales; todavía no se ha elegido una variante para la app. Se estudia el aspecto, sin decidir cuándo ni dónde se activa.

## Dirección actual

`index.html` permite comparar Vertical y Horizontal con los mismos seis libros de ejemplo. Son dos orientaciones del mismo lenguaje visual, no paletas distintas.

- Reutilizar el color actual de las portadas: verde `#e4f0cc`, canto `#9fca82`, borde `#779a72`, tinta `#173d2c` y profundidad `#1e4c2e`. Papel `#fff9ed`; las baldas mantienen la madera de la app. Sin un color diferente para cada libro.
- Diseñar para móvil. El título debe ser completo, legible y más importante que el autor. No requiere hover, seleccionar un libro ni mostrar una leyenda de selección para leerlo.
- Vertical: tres lomos por estante, más anchos que en la propuesta inicial, títulos grandes y autores pequeños al pie. Dos estantes.
- Horizontal: títulos en lectura normal, más grandes que los autores. Los lomos comparten alineación y tamaño de letra; no hay uno resaltado.
- Los libros son muestras gráficas, sin acciones conectadas ni cambios en datos. Los botones superiores de este estudio solo alternan la orientación.

La comparación presentada en conversación usa el mismo contenido. No cambia la ficha ni las portadas de la app.

## Propuesta reservada

`archive/lomo-portada.html` conserva la propuesta inicial de lomo + portada: una portada visible entre lomos por estante, profundidad de papel y cambio mediante toque. Queda fuera de la primera dirección a desarrollar, pero se conserva para poder retomarla.

Es una referencia histórica: mantiene los colores de aquella primera exploración. Si se retoma, deberá adaptarse al verde uniforme de las portadas y revisarse su interacción para móvil. El archivo funciona por sí solo, sin depender del carrusel de la conversación.

## Verificación

Estructura HTML y sintaxis de scripts comprobadas. El contraste sobre el verde actual es 10,13:1 para el título y 5,32:1 para el autor. La comparación activa no contiene selección de libros ni dependencias de red. `npm run lint` correcto y `npm test` completo con build: 318 pruebas, salida 0, Node 24.21.0.
