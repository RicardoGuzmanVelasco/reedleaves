# Exploraciones de colección personal

Tres propuestas sin aprobar. Maquetas HTML autónomas, sin dependencias ni JavaScript. No modifican la aplicación.

## Vocabulario provisional

- Librería / Library: catálogo global.
- Estantería / Bookshelf: libros de la persona.
- Tarjetero / My decks: barajas completas añadidas o seguidas. `Deck box` es otra traducción por evaluar. En las acciones se usa `Add to your decks`; el estado es `Added` o `Added to your decks`. En español: «Añadir a la estantería» y «Añadir al tarjetero».

El selector ES / EN cambia los textos funcionales. Los títulos e idiomas originales de libros y barajas no cambian con el idioma de interfaz.

## Alternativas

| Archivo | Arquitectura | Ventaja | Coste |
| --- | --- | --- | --- |
| `01-selector.html` | Selector Estantería / Tarjetero | Mantiene la pantalla enfocada en un tipo de elemento. | Exige cambiar de área para ver el otro contenido. |
| `02-secciones.html` | Dos secciones visibles y enlaces de salto | Permite reconocer ambos espacios desde la misma página. | Añade longitud de desplazamiento. |
| `03-lista-agrupada.html` | Lista compacta con grupos plegables | Escala en densidad y mantiene una lectura uniforme. | Diferencia menos la materialidad de libros y barajas. |

## Recorrido de la maqueta

1. Entrar en Mi espacio / My space.
2. Abrir un libro o una baraja mediante sus enlaces. El enlace llega a una ficha de ejemplo plegable.
3. Ir a Librería / Library desde la navegación o desde Añadir.
4. Activar una casilla de añadir para comparar el estado pendiente y añadido. Una segunda activación revierte la simulación.

Las casillas de catálogo simulan el estado de la acción; no insertan elementos en la colección. Los recuentos y datos son fijos y ficticios. Las fichas son ejemplos mínimos de navegación, no propuestas de rediseño del detalle. Los bloques visuales y abreviaturas son placeholders, sin propuesta de iconografía o portadas.

## Comprobación

Se ha revisado la estructura HTML, los controles nativos, los destinos de navegación y las reglas responsive. `git diff --check` sin errores. No se han ejecutado tests de la aplicación ni una revisión visual en navegador.
