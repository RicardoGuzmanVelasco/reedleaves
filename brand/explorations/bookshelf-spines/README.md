# Exploración de lomos · móvil

Punto 14 del feedback. Se estudia el aspecto, sin decidir cuándo ni dónde se activa en la app.

## Referencia aprobada: pila con autores

- `index.html` conserva íntegra la comparación de la revisión `72f56d5`. El usuario aprobó su pila horizontal y pidió no modificarla.
- `approved/pila-con-autores.html` guarda esa misma pila por separado, con sus estilos, libros, autores y ajuste de tamaños originales. No depende del carrusel de la conversación.
- Ambos conservan la tipografía de la app, los títulos de una sola línea, las anchuras distintas, los desplazamientos y la ligera inclinación de cada libro.

## Nueva prueba: estantería densa y pila sin autores

`revision-densa.html` es una nueva comparación; no sustituye la referencia aprobada.

### Estantería densa

- Ejemplo con los 24 libros del catálogo revisado. Aprovecha todo el ancho de cada balda: columnas calculadas a partir de un ancho mínimo de lomo de 32 px y una separación de 2 px. Entre 8 y 10 libros por balda en los marcos móviles de referencia.
- Tres baldas compactas permiten ver esos 24 libros en el mismo marco móvil en esos tamaños de referencia.
- La letra se ajusta entre 15 y 19 px: mínimo mayor y máximo menor que los 13–22 px anteriores. Títulos largos truncados antes, siempre en una sola línea y centrados transversalmente.
- La longitud máxima del lomo es 184 px. Solo se reduce si el título sigue cabiendo completo. La variación por libro es estable, no cambia al repintar.

### Pila sin autores

- Mismos doce libros, tipografía, reglas de ajuste y asimetría que en la pila aprobada. Se retiran los autores visibles y se conservan en el nombre accesible.
- Altura mínima de 36 px, frente a los 44 px de la referencia. El título queda unos 2,5 px por debajo del centro del lomo mediante el reparto del espacio interior.
- Se mantienen el ancho variable, los desplazamientos de hasta 6 px y los giros de hasta 0,6°. No hay selección de libros.

## Criterios compartidos

- Fuente exacta de la app: `"Avenir Next Rounded","Arial Rounded MT Bold","Avenir Next",system-ui,sans-serif`; `font-synthesis:none`, sin descargas externas.
- Verde claro `#e4f0cc` en el centro del lomo y verde oscuro `#9fca82` en los bordes longitudinales. Al tumbar el libro, los bordes oscuros quedan arriba y abajo. Borde `#779a72`, tinta `#173d2c`, profundidad `#1e4c2e` y papel `#fff9ed`.
- Primero se ajusta la letra con límites. Solo se acorta un lomo si el título cabe completo; se revierte el acortamiento si el navegador detecta desbordamiento. Los títulos que necesitan puntos suspensivos mantienen el espacio máximo disponible.
- Se recalcula al cambiar el ancho, cargar las fuentes o mostrar una orientación oculta. Los nombres completos siguen disponibles para accesibilidad y ayuda al truncarse.
- Los libros son muestras gráficas, sin acciones conectadas ni cambios de datos. Los controles del estudio solo alternan las dos propuestas.

## Propuesta reservada

`archive/lomo-portada.html` conserva la propuesta inicial de lomo + portada para retomarla más adelante. Es una referencia histórica; antes de usarla habrá que adaptar colores, tipografía e interacción a los criterios actuales.

## Verificación

Estructura HTML y sintaxis de scripts comprobadas. El contraste del texto sobre el verde claro es 10,13:1. Se comprueba que la referencia aprobada no cambie y que su exportación conserve estilos, contenido y comportamiento. `npm run lint` correcto y `npm test` completo con build: 318 pruebas, salida 0, Node 24.21.0.

## Ajuste posterior: lectura homogénea

`revision-equilibrada.html` conserva las pruebas anteriores y afina la última comparación:

- Estantería con letra entre 15 y 16 px. Alturas estables entre el 78 % y el 99 % del máximo, también cuando el título se trunca. El espacio longitudinal interior baja de 28 a 16 px para acercar los puntos suspensivos al borde sin cambiar el centrado transversal. Los títulos completos conservan el espacio necesario para seguir cabiendo.
- En la pila sin autores solo se acortan algo más los títulos que usan menos del 70 % del ancho disponible. Conserva grosor, posición del título, tipografía, desplazamiento y giro.
- Las reglas de esta revisión sustituyen en esta prueba los límites y la prohibición de acortar títulos truncados descritos arriba; las referencias anteriores permanecen intactas.
