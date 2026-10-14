# Presentación compartida de tarjetas

Estado: composición y tipografía aprobadas el 13 de octubre de 2026 para producción.

Ideas y citas comparten el renderer de `views.mjs` y todas las reglas de geometría de `reader.css`: papel, pestaña superior, capas, bordes, sombras, márgenes, separador, atribución, icono de fondo y acciones. Debajo de la pestaña hay un espacio común para un icono: comilla pequeña en las citas y vacío en las ideas normales. Las diferencias se expresan como parámetros.

## Configuración

| Archivo | Parámetros |
| --- | --- |
| `app/card-types.mjs` | Identificador, título visible, etiqueta del cuerpo, encabezado accesible, icono superior opcional e icono SVG de fondo. |
| `app/card-themes.css` | Papel, texto, borde, sombras, capas, pestaña, separador, familia/peso/tamaño/interlineado/alineación del cuerpo, fondo y colores de las acciones. |
| `app/reader.css` | Una sola composición responsive y animación para todos los tipos. |

El contrato actual del catálogo usa `isQuote`; `cardTypeFor` concentra su traducción a `idea` o `quote`. Un tipo futuro añade su entrada, sus tokens y la correspondencia con el modelo de datos; el renderer y los estilos de geometría se reutilizan. Los tokens se heredan desde `data-card-type`, sin estilos inline y respetando la CSP.

Se conserva `blockquote` para las citas y `p` para las ideas. La ausencia de título visual en citas mantiene un encabezado accesible traducido. El fondo es decorativo y no captura clics. Paletas, tipografía y configuración de contenido no duplican recorridos de votos, guardado o repaso.

En tarjetas propias, la placa y los pulgares de voto tienen contorno discontinuo. Se atenúan relleno, borde, sombra, separador y pulgares por separado; los contadores conservan opacidad completa y refuerzan su peso. Los botones de voto siguen deshabilitados y usan cursor `not-allowed`. El guardado permanece disponible con su presentación habitual.

## Revisión visual

Revisadas ideas y citas en móvil y escritorio. En escritorio ambas tienen padding `58px 72px 30px`, radio `32px` y la misma altura mínima; en móvil comparten padding `54px 22px 21px` y radio `25px`. Se conservan Courier/Garamond y las paletas Salvia/azul. Las comillas siguen completas y las cintas pueden sobresalir. Capturas locales en `var/shared-cards-qa/`, fuera de Git.

Tipografía aprobada: Cormorant Garamond Light 300 en citas, servida como WOFF2 desde la app. Peso parametrizado con `--card-body-weight`; las ideas usan Courier 400. EB Garamond permanece como alternativa.

Ajuste posterior: tamaño de citas reducido 1 px en todo el rango responsive, a 23 px en móvil y un máximo de 31 px en escritorio. El tamaño de las ideas no cambia.

## Preview de baraja

Vista alternativa al árbol, disponible en repaso y autoría desde un selector segmentado a la izquierda: iconos de listado anidado y cuadrícula, con nombres accesibles y tooltip ES/EN. El filtro «Todas / Citas» («All / Quotes») queda a la derecha, siempre en una línea. Ambos comparten estilo y altura táctil.

La preview usa las mismas paletas, tipografías e iconos por tipo, en miniaturas apaisadas. Arranca con dos columnas en cualquier pantalla y un slider permite elegir de una a cuatro. El tamaño, filtro y vista se conservan al abrir y cerrar una tarjeta durante la sesión; otra baraja arranca de nuevo con el árbol y dos columnas.

Las tarjetas repasadas pueden abrirse en la vista exclusiva. En autoría se puede inspeccionar todo el contenido propio. En repaso, la siguiente conserva el título o extracto que ya muestra el árbol, pero desenfoca el cuerpo; las bloqueadas desenfocan título (si corresponde al tipo) y cuerpo. Se usa el texto real para conservar su composición, con blur proporcional a la tipografía y opacidad reducida. Esta ocultación es visual: el contenido permanece en el HTML, sin selección ni exposición a lectores de pantalla. La preview no desbloquea ni gasta hojas. Las miniaturas no incluyen acciones de voto/guardado ni registran lecturas: estas siguen en la tarjeta completa.
