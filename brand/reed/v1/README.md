# Reed · Pruebas de logo

## Decisiones del usuario

- Nombre: **Reed**.
- Lema EN: **Read. Plant a seed.**
- Línea ES: **De hoja a hoja.**
- Mascota actual: la pareja de hojas de `brand/sprout/leaf.svg`.
- Logo: esa hoja dentro de un libro abierto; pliegue y separación de hojas sobre el mismo eje.
- Posible familia de mascotas por perfil en el futuro. Solo la hoja en la versión actual.

## Cuatro integraciones

| Prueba | Libro | Intención |
| --- | --- | --- |
| A · Abrazo | Contorno grueso, papel crema y cubierta verde. | Libro muy reconocible; la hoja mantiene protagonismo. |
| B · Papel | Páginas con volumen cálido y cubierta verde, sin contorno exterior. | Más amable y cercano a un objeto de la app. |
| C · Trazo | Libro dibujado con pocas líneas y mucho aire. | Más ligero; comprobar lectura a pequeño tamaño. |
| D · Compacto | Libro bajo y ancho, hojas algo más grandes. | Más presencia de mascota; apropiado para icono. |

Todas conservan la geometría y asimetría de la hoja original. El eje del libro está en `x=128`, igual que el centro de la separación de las hojas tras su transformación. No centrar la hoja por su caja visual: centrar por su pliegue.

Los SVG contienen grupos `book`, `spine` y `leaf`, y el eje opcional en `data-axis-x`. La cara se añade en el comparador, sin sustituir la silueta. No aplicar el filtro de monocromo a una versión en color: cada prueba tiene un SVG de un color con huecos reales.

## Revisión

En `index.html`: libro + hoja, cara opcional, eje visible, tamaños 24 / 48 / 96 px y versión de un color. Cada prueba tiene archivos base, `-mascot.svg` y `-mono.svg`. `comparison.svg` es una lámina estática de las cuatro opciones.

Ninguna integración se considera logo final hasta elegir una prueba. Los prototipos Sprout previos se conservan como exploración histórica.
