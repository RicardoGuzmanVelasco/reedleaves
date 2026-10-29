# Selector de intereses · propuesta local

Exploración pendiente de aprobación. No se importa desde la app ni sustituye su catálogo o sus reglas de diseño.

Desde la raíz del worktree, con la versión de `.node-version`:

```sh
node scripts/local-interest-style-study.mjs
```

Abre la URL loopback que imprime el servidor. El estudio compara la versión actual con la propuesta y permite cambiar idioma, ancho y paso. Los selectores usan el componente real y un borrador independiente en memoria. Guardar se simula; no hay sesiones reales, acceso a bases de datos ni peticiones a producción.

- El catálogo de referencia se lee de `content/catalog/genres.csv`.
- `palette.csv` contiene solo los colores de esta propuesta: oro, morado, rosa, verde, coral, azul y gris. No se cambian IDs, nombres, emojis, asociaciones ni orden editorial.
- `proposal.css` concentra el color en el centro y lo degrada hacia papel claro. La selección mantiene su familia de color.
- El emoji baja de 32 a 24 px en escritorio y de 24 a 20 px en compacto. Al seleccionar llega a escala 1,55 con giro de −18°, y se asienta en 1,35 / −12°. Movimiento reducido elimina el efecto.
- Se conserva el formato horizontal compacto, la prioridad a la derecha y las acciones visibles.
