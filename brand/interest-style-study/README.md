# Selector de intereses · propuesta local

Exploración pendiente de aprobación. No se importa desde la app ni sustituye su catálogo o sus reglas de diseño.

Desde la raíz del worktree, con la versión de `.node-version`:

```sh
node scripts/local-interest-style-study.mjs
```

Abre la URL loopback que imprime el servidor. El estudio compara la tipografía oscura ampliada con el tamaño anterior. Permite cambiar idioma, ancho, alto, estado inicial (0–5 selecciones o segundo paso), formato (chips con relieve, planos o tarjetas), tipografía y numeración (color oscurecido o semitransparente). Los selectores usan el componente real y un borrador independiente en memoria. Guardar se simula; no hay sesiones reales, acceso a bases de datos ni peticiones a producción.

- El catálogo de referencia se lee de `content/catalog/genres.csv`.
- `palette.csv` contiene solo los colores de esta propuesta: oro, morado, rosa, verde, coral, azul y gris. No se cambian IDs, nombres, emojis, asociaciones ni orden editorial.
- `proposal.css` concentra el color en el centro y lo degrada hacia papel claro. La selección mantiene su familia de color.
- En tarjetas, el emoji baja de 32 a 24 px en escritorio y de 24 a 20 px en compacto; en chips usa 20 px. Al seleccionar llega a escala 1,55 con giro de −18°, y se asienta en 1,35 / −12°. Movimiento reducido elimina el efecto.
- Los chips mantienen una zona táctil de 44 px y una profundidad opcional de 2 px, teñida de su propio color. La numeración usa el color del chip oscurecido, con alternativa semitransparente. Crecimiento personal se presenta primero, centrado en su fila y con ancho ajustado al contenido, sin alterar el orden de selección.
- La tipografía preferida usa tinta oscura, 15 px en móvil y 16 px en escritorio, con menor peso y mayor margen izquierdo para los emojis. Se conserva la opción de tamaño anterior para comparar. La exploración de texto blanco fue descartada por el usuario y se retira.
- La nueva cabecera pregunta «¿Qué te interesa especialmente?». Se retiran las instrucciones estáticas de orden y máximo. En el primer paso no hay consejo ni premio con cero selecciones; con una se recomienda tres, con dos se mantiene un consejo breve, y con cuatro o cinco aparece el consejo del máximo. Los avisos son cálidos, centrados, ajustados a su contenido y con salto de línea tras la coma. El premio aparece desde una selección, con `+3` y condición «Al guardar 3 o más», fiel a la regla del servidor; con exactamente tres se muestra «Continúa y guarda para recibir», porque se abona al confirmar el guardado. Los consejos son orientativos y una selección sigue siendo suficiente para avanzar.
- Exactamente tres selecciones activan el shimmer y la ola de «Siguiente»: se reutilizan las clases, keyframes, cadencia y desfase de letras de Repasar. La activación empieza en la fase de brillo de esos mismos keyframes, sin duplicar su duración. Movimiento reducido deja el texto estático.
- «Siguiente» conserva su posición al pie. En 390×568 y alturas superiores caben los estados normales sin scroll; en 320 px de ancho se conserva una columna legible y puede requerirse desplazamiento. Las acciones siguen visibles.
- Estos cambios de copy y presentación solo se aplican en `proposal-ui.mjs` y CSS del estudio. No modifican las vistas, traducciones, premios ni orden editorial de la app.
