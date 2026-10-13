# Presentación compartida de tarjetas

Estado: incremento local solicitado después de publicar el fondo de tarjetas; pendiente de revisión del usuario.

Ideas y citas comparten el renderer de `views.mjs` y todas las reglas de geometría de `reader.css`: papel, pestaña superior, capas, bordes, sombras, márgenes, separador, atribución, icono de fondo y acciones. Debajo de la pestaña hay un espacio común para un icono: comilla pequeña en las citas y vacío en las ideas normales. Las diferencias se expresan como parámetros.

## Configuración

| Archivo | Parámetros |
| --- | --- |
| `app/card-types.mjs` | Identificador, título visible, etiqueta del cuerpo, encabezado accesible, icono superior opcional e icono SVG de fondo. |
| `app/card-themes.css` | Papel, texto, borde, sombras, capas, pestaña, separador, familia/tamaño/interlineado/alineación del cuerpo, fondo y colores de las acciones. |
| `app/reader.css` | Una sola composición responsive y animación para todos los tipos. |

El contrato actual del catálogo usa `isQuote`; `cardTypeFor` concentra su traducción a `idea` o `quote`. Un tipo futuro añade su entrada, sus tokens y la correspondencia con el modelo de datos; el renderer y los estilos de geometría se reutilizan. Los tokens se heredan desde `data-card-type`, sin estilos inline y respetando la CSP.

Se conserva `blockquote` para las citas y `p` para las ideas. La ausencia de título visual en citas mantiene un encabezado accesible traducido. El fondo es decorativo y no captura clics. Paletas, tipografía y configuración de contenido no duplican recorridos de votos, guardado o repaso.

## Revisión visual

Revisadas ideas y citas en móvil y escritorio. En escritorio ambas tienen padding `58px 72px 30px`, radio `32px` y la misma altura mínima; en móvil comparten padding `54px 22px 21px` y radio `25px`. Se conservan Courier/Garamond y las paletas Salvia/azul. Las comillas siguen completas y las cintas pueden sobresalir. Capturas locales en `var/shared-cards-qa/`, fuera de Git.
