# Identidad de Reedleaves

## Decisión actual

- **Símbolo y logo de la app:** Brote con expresión alegre, sin libro.
- **Arte de referencia:** `mascot.svg`.
- **Icono con fondo:** `app-icon.svg` sobre crema `#FFF9ED`.
- **Iconos rasterizados:** `apple-touch-icon.png` (180 px), `app-icon-192-v4.png`, `app-icon-512-v4.png` y `favicon.ico`.
- **Lema EN:** «Read. Plant a seed.» · **Línea ES:** «De hoja a hoja».

El HTML, el manifiesto, el favicon, el icono de inicio y las cabeceras activas de marca usan Brote. El logo anterior de libro y hoja queda retirado. Las pruebas antiguas bajo `v1/`, las variantes SVG y sus láminas se conservan solo como archivo histórico; no representan la identidad vigente.

## Regenerar iconos

`node scripts/build-app-icons.mjs` compone el icono desde `mascot.svg`, genera PNG opacos RGB a los tamaños usados y reconstruye el favicon ICO. Después, `node scripts/embed-app-icon.mjs` actualiza el PNG incrustado en `app/index.html`. El manifiesto usa nombres versionados para que los navegadores descarguen el icono nuevo.

El servidor sirve los alias históricos `apple-touch-icon*.png` desde `apple-touch-icon.png`, sin sesión ni redirecciones. `server/http.test.mjs` comprueba los tamaños, el formato RGB y que el recurso incrustado coincide con el PNG servido.

## Registro histórico

Los estudios previos del logo con libro pueden consultarse desde sus rutas de archivo. Se mantienen para preservar el proceso de diseño, pero no se enlazan desde la identidad actual ni se usan en la app.
