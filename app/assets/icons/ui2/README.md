# Familia de iconos · interfaz nueva

Catálogo de los iconos de la interfaz nueva. Las reglas del estilo están en `docs/frontend/DESIGN.md`, sección «Iconografía de la interfaz nueva». Esta carpeta contiene solo los SVG elegidos (principales y sus estados `-active`), con nombre `id.svg`, sin alternativas.

## Sistema

- Rejilla 24×24 (`viewBox="0 0 24 24"`), dibujo dentro de 2–22.
- Trazo único **2.2**, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`.
- Radios: 3.5–4.5 en tarjetas, cajas y casas; 2–2.5 solo en libros. Sin esquinas vivas.
- Aire mínimo entre trazos: ~1 unidad (legible a 20 px).
- Solo `currentColor`. Todos llevan `aria-hidden="true"` y `focusable="false"`; el nombre lo pone el botón.
- **Perspectiva:** pila recta (tarjeta delantera y las de detrás asomando por arriba) en `deck`, `new-deck`, `finish-deck`, `cardcase`; dos tarjetas en ángulo en `practice` y `take-note`. Acciones y controles son planos.
- **Activo, una sola lógica:** mismo contorno + relleno suave `fill="currentColor" fill-opacity=".28"`. En `practice-active` cubre las dos tarjetas en un solo trazado.
- **Excepción, `quote`:** es un glifo macizo, sin hueco que rellenar. Inactivo = comillas macizas. Activo (`quote-active`) = núcleo macizo + contorno suave al .28: usa el mismo tono suave que `idea-active`, con las capas invertidas. Si no convence, en el selector de tipo basta `quote` en los dos estados (la selección la marca el segmento).
- Formas macizas solo como glifo: `quote`, puntos de `more`, triángulo de `practice`.
- **Altas con `+`, ediciones con lápiz**, mismo marco (tarjeta abajo a la izquierda, insignia arriba a la derecha): `take-note` = dos tarjetas en ángulo + «+»; `edit` = una tarjeta + lápiz; `new-deck` = pila con «+» dentro.
- El icono acompaña al texto; va solo en controles circulares y en la fila de acciones. Zona táctil ≥ 44×44 px la da el botón.

## Iconos de `final/` (39 conceptos + 12 estados activos = 51 SVG)

| id | Significado | Dónde se usa en la UI nueva |
|---|---|---|
| `home`, `home-active` | Inicio | Pestaña inferior |
| `bookstore`, `bookstore-active` | Librería / Bookstore (catálogo global) | Pestaña inferior |
| `library`, `library-active` | Biblioteca / Library (colección personal) | Pestaña inferior |
| `practice`, `practice-active` | Repaso / Practice | Pestaña inferior; botón «Repasar» |
| `shelf` | Estantería / Shelf (libros de la Biblioteca) | Solapa de la Biblioteca |
| `cardcase` | Tarjetero / Cardcase (barajas de la Biblioteca) | Solapa de la Biblioteca; «Añadir al Tarjetero» |
| `profile`, `profile-active` | Perfil | Menú del avatar |
| `settings`, `settings-active` | Ajustes | Menú del avatar; «Ajustes de la baraja» |
| `deck` | Baraja | «Ver baraja», contador de tarjetas, borradores |
| `new-deck` | Baraja nueva | Consecuencia «creará otra baraja» |
| `finish-deck` | Terminar baraja | Menú ⋯ de la baraja |
| `lock` | Baraja cerrada | Consecuencia «no se podrán añadir más notas» |
| `take-note` | Tomar nota | Botón principal; «Tomar nota debajo de esta» |
| `edit` | Corregir (editar una nota) | Hoja de nota; lector |
| `place-under` | Colocar debajo de | Hoja de nota; lector |
| `idea`, `idea-active` | Tarjeta de tipo Idea | Selector de tipo; consecuencia «idea del día» |
| `quote`, `quote-active` | Tarjeta de tipo Cita | Selector de tipo; citas en el esquema |
| `bookmark`, `bookmark-active` | Guardar tarjeta / guardada | Fila de acciones |
| `like`, `like-active` | Me gusta | Fila de acciones |
| `dislike`, `dislike-active` | No me gusta | Fila de acciones |
| `share` | Compartir | Fila de acciones |
| `reading-guide`, `reading-guide-active` | Guía de lectura | Acceso a la guía del libro |
| `book-unread` | Libro sin leer | Estado del libro |
| `book-to-read` | Libro por leer | Estado del libro |
| `book-reading` | Leyendo | Estado del libro; chip de estado |
| `book-read` | Leído | Estado del libro |
| `close` | Cerrar; quitar | Cabeceras de hojas y captura; lista de colaboradores |
| `back`, `forward` | Volver / anterior; siguiente / ir a | Cabecera; paso entre notas; filas |
| `expand` | Desplegar | Chip de estado; selector |
| `add`, `remove` | Más / menos | Contador de límite de notas |
| `more` | Más opciones | Cabecera de baraja |
| `check` | Elegido / hecho | Opción elegida; «En tu Tarjetero»; racha cumplida en Repaso |
| `book-stack` | Mezcla: cuatro formas distintas en 2×2 (nombre heredado) | Repaso: «Un poco de todo» en la fila de racha y en su tema |
| `calendar` | Calendario | Repaso: «La baraja del día» en la fila de racha y en su tema |
| `new-gift` | Paquete con lazo: algo nuevo por abrir | Repaso: «Entre las novedades» |
| `team-pick` | Medalla con dos cintas por detrás: selección del equipo | Repaso: «Elegidas por el equipo» |
| `alert` | Aviso o error | Mensajes |

## Iconos de divisa (con color)

`leaf-token` y `petal-token` (Hoja y Pétalo) son copias de producción de los de `brand/`; llevan color propio, no `currentColor`, y no pasan por `icons.mjs`. Las variantes `-soft` tienen el mismo dibujo con el contorno más fino y verde suave (`#4b7d5a`); las usa la etiqueta de precio suave (`soft:true`).

## Elecciones abiertas (fuera de `final/`)

- `book-unread-alt`, `book-to-read-alt`, `book-read-alt`: base cerrada con la curva hacia fuera. La principal cierra con la curva hacia dentro.
- `quote-alt`, `quote-alt-active`: comillas en contorno (principal de la v3).
- `settings-alt`: engranaje.
- `practice-alt`: baraja en perspectiva con triángulo.

## Cambios respecto a la v3

- `settings`: deslizadores (antes alternativa); engranaje a `settings-alt`.
- `quote`: maciza (antes `quote-alt` de la v3); la de contorno pasa a `quote-alt`.
- Libros `book-*`: base cerrada.
- `practice` y `practice-active`: triángulo de inicio en la tarjeta delantera.
- Retiradas las alternativas de iconos ya aprobados (`library-alt…alt4`, `profile-alt`, `finish-deck-alt`, `place-under-alt`); siguen en la v3.

## Fuera de esta familia

Mantener tal cual, no se rediseñan: banderas de idioma (`es`, `en`), mascotas, Hoja (`leaf-token`), Pétalo (`petal-token`), racha (`streak-flame`), arte de marca y emojis de intereses.

Sin sustituto porque no salen en la UI nueva: I05 (calendario), I02 (reloj), I07 e I08 (libro y pluma de procedencia), I09 e I10 (flechas de enlace), I11 (filtro), I12 (lupa), I24–I28 (vistas de baraja y presentación), view-covers / view-shelf / view-stack, I34 (oferta), I35 (medalla), I36 (estrella), globe, deck-badge-shape e I42 (formas), I43 (marcapáginas de pestaña), I44 e I45 (barra Junco), plataformas Amazon y Goodreads. Los códigos son los del inventario de la UI actual. Si la Librería nueva mantiene búsqueda o filtros, faltarán `search` y `filter`.
