# Reedleaves · Pruebas de logo

## Decisiones del usuario

- Nombre oficial: **Reedleaves**. Reed fue el nombre de trabajo; las rutas y las pruebas anteriores se conservan.
- Lema EN: **Read. Plant a seed.**
- Línea ES: **De hoja a hoja.**
- Mascota actual: la pareja de hojas de `brand/sprout/leaf.svg`.
- Logo: esa hoja dentro de un libro abierto; pliegue y separación de hojas sobre el mismo eje.
- Forma elegida: **D · Compacto**. Color elegido: **B · Salvia**, `#779A72` en contorno y pliegue. Ajuste final: hojas originales y sombra exterior del libro oscura (`#1E4C2E`).
- Posible familia de mascotas por perfil en el futuro. Solo la hoja en la versión actual.

## Cuatro integraciones

`refinement.html` presenta el logo aprobado con el nombre actual. Las demás pruebas, láminas y previsualizaciones anteriores conservan Reed como registro histórico; no son la identidad vigente. Los SVG aprobados conservan exactamente sus trazados y colores, con la etiqueta accesible actualizada a Reedleaves.

La versión 2 responde al ajuste del usuario: páginas más estrechas y hoja más grande. Tras revisar el borde inferior se sube la hoja ligeramente para dejar margen seguro. La primera tanda se conserva en `v1/index.html` y `v1/comparison.svg`.

La hoja pasa de escala 0.76 a 1.18 en A/B y de 0.84 a 1.20 en C. Se conserva su geometría y se ajusta el perímetro inferior del libro para alojarla. El eje compartido sigue en `x=128`.

| Prueba | Libro | Intención |
| --- | --- | --- |
| A · Abrazo | Contorno grueso, papel crema y cubierta verde. | Libro muy reconocible; la hoja mantiene protagonismo. |
| B · Papel | Páginas con volumen cálido y cubierta verde, sin contorno exterior. | Más amable y cercano a un objeto de la app. |
| C · Trazo | Libro dibujado con pocas líneas y mucho aire. | Más ligero; comprobar lectura a pequeño tamaño. |
| D · Compacto | Libro bajo y ancho, hojas algo más grandes. | Más presencia de mascota; apropiado para icono. |

Todas conservan la asimetría de la hoja original. En Compacto se recuperan posición, escala y sombras originales de B Salvia; la separación adicional queda descartada. El eje del libro permanece en `x=128`, en el centro de la separación. No centrar la hoja por su caja visual.

Los SVG contienen grupos `book`, `spine` y `leaf`, y el eje opcional en `data-axis-x`. El logo con libro no tiene ojos ni boca. La cara aparece solo en la mascota aislada, `mascot.svg`, que conserva la hoja original y no lleva libro. No aplicar el filtro de monocromo a una versión en color: cada prueba tiene un SVG de un color con huecos reales.

## Revisión

### Icono de inicio en iPhone

`apple-touch-icon.png` es un PNG opaco de 180 × 180 px, enlazado desde `app/index.html` y servido también en `/apple-touch-icon.png`. Usa el logo aprobado de `d-compacto.svg` sobre crema `#FFF9ED`. El encuadre cuadrado `viewBox="14 38 228 228"` centra el libro y deja el símbolo con aproximadamente el 89 % del ancho. Los trazados, colores y proporciones se conservan. Las esquinas se dejan al sistema.

Para regenerarlo, copiar el SVG aprobado a un archivo temporal, aplicar ese `viewBox` e insertar antes del grupo `book` un fondo `<rect x="14" y="38" width="228" height="228" fill="#FFF9ED"/>`. Rasterizar con `rsvg-convert --width 180 --height 180 --output brand/reed/apple-touch-icon.png archivo-temporal.svg` (requiere librsvg). No modificar el SVG del logo aprobado.

Tras desplegar, comprobar «Añadir a pantalla de inicio» en un iPhone. Si el acceso existente conserva el icono anterior, eliminarlo y añadirlo de nuevo.

En `index.html`: libro + hoja sin cara, eje visible, tamaños 24 / 48 / 96 px y versión de un color. Cada prueba tiene archivos base y `-mono.svg`. La mascota está separada en `mascot.svg`. `comparison.svg` es una lámina estática de las cuatro opciones.

Los cuatro SVG activos que mezclaban libro y cara se retiran. Las copias de la primera tanda quedan en `v1/` como historial recuperable.

## Comprobación de márgenes

En la versión anterior se comprobaron 1.288 puntos de borde por variante, sin puntos fuera. Margen mínimo hasta el trazado exterior: A 7,08; B 7,27; C 7,35; D 7,50 unidades SVG.

El logo actual se comprueba con `node brand/reed/verify-compacto.mjs`. La verificación compara el SVG completo con B Salvia y permite únicamente el cambio de color de la sombra exterior del libro y su etiqueta accesible. Comprueba también 1.288 puntos de las siluetas de las hojas, incluidas sus sombras, sin puntos fuera. Margen libre con el contorno: 4,00 unidades SVG. La cercanía al pliegue es la del B original, recuperada por petición explícita del usuario.

La forma D · Compacto y el color B · Salvia quedan elegidos. La sombra exterior del libro oscura se presenta en `refinement.html`, con comparación antes/después y tamaños 48 / 96 px.

## Colores de Compacto

`colors.html` conserva el estudio anterior de cuatro colores. `colors/comparison.svg` permite verlos juntos. El original oscuro queda en `colors/compacto-oscuro.svg` y el B Salvia anterior en `colors/salvia.svg`. El activo `d-compacto.svg` conserva las hojas originales y oscurece solo la sombra exterior del libro. La variante descartada con hojas separadas se conserva en `colors/salvia-separated.svg`.

| Prueba | Contorno | Pliegue |
| --- | --- | --- |
| A · Musgo | `#5E7B57` | `#5E7B57` |
| B · Salvia | `#779A72` | `#779A72` |
| C · Arena | `#B1A082` | `#B1A082` |
| D · Salvia · pliegue suave | `#779A72` | `#ADBF98` |

En esas cuatro pruebas históricas solo cambian los dos atributos `stroke` y la etiqueta accesible. En el logo actual solo cambia el relleno de la capa exterior del libro (`#1E4C2E`) respecto a B Salvia. Las hojas, sus sombras, el libro, los anchos de línea y todas las posiciones permanecen intactos. La mascota sin libro no se modifica.
