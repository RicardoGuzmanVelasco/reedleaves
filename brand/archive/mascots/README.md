# Archivo de mascotas

Variantes de mascota guardadas para el futuro. Guardar aquí no aprueba ni activa nada en el juego.

- `*-body`: cuerpo autónomo sin cara ni sombra de suelo, listo para el componente `mascotArt`.
- `*-raw`: copia sin cambios de la composición original (con cara y sombra si las tenía).
- Los PNG `*-body` se extrajeron con ImageGen (`precise-object-edit`): la superficie reconstruida bajo ojos y boca es aproximada. Los píxeles totalmente transparentes tienen RGB neutro para evitar halos al reducir.
- Los SVG conservan el `viewBox` de su origen; `mascotArt` los muestra con `object-fit: contain` y capas independientes de cara y sombra.

| Carpeta | Contenido |
| --- | --- |
| `brote/` | 6 variantes vectoriales de Brote |
| `brotes-raster/` | Tierra v1–v3 y Cotiledones |
| `flores-sin-tallo/` | Margarita, girasol, tulipán, amapola, rosa (la Flor activa es `app/assets/mascot/flower.png`) |
| `flores-con-tallo/` | Siete composiciones con tallo y hojas |
| `macetas/` | Cuenco, abombada, alta, cuadrada y jardinera, con su lámina |
| `semillas/` | Redonda, arriñonada, achatada, café vertical y café ondulado, con su lámina |
| `tallos/` | Flexible, nudos, junco y bambú |

Las siluetas que la app ya usa (`app/assets/mascot/`) no se duplican aquí.
