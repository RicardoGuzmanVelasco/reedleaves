# Fondo del cuerpo de tarjetas

Estado: incremento local posterior al despliegue de Guardadas, pendiente de revisión visual del usuario.

La petición es dar más presencia a las comillas finales de las citas como un fondo muy tenue del cuerpo de la tarjeta, anclado al separador de la atribución. Para las ideas normales se propone una bombilla de silueta redondeada, sin rayos.

## Composición

- `reading-content` agrupa título/texto y se extiende hasta el separador. El footer conserva atribución y acciones fuera de esta capa.
- `card-watermark` ocupa esa zona, recorta únicamente la decoración y la sitúa detrás del contenido. No captura clics ni forma parte de la lectura accesible.
- Comillas SVG completas y más pequeñas, con cabezas redondeadas y margen interno para evitar recortes. Ocupan como máximo el 82 % del cuerpo, 430 px de ancho y 280 px de alto; conservan el azul previo y opacidad 0,13. Bombilla SVG con Salvia y opacidad 0,09. El anclaje inferior no depende de las métricas de una fuente.
- `--watermark-ink` y `--watermark-opacity` permiten ajustar la paleta por tipo sin cambiar geometría o comportamiento.
- El mismo renderer sirve la vista exclusiva y la tarjeta diaria. El fondo no introduce animaciones propias ni modifica votos, guardado o repaso.

## Revisión local

Comprobadas citas e ideas en escritorio y móvil. El cuerpo, la marca de agua y el separador terminan en la misma coordenada vertical. La atribución queda libre y no aparece desbordamiento horizontal. Las capturas se conservan fuera de Git en `var/card-watermarks-qa/`.
