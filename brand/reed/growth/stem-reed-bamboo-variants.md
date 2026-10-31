# Tallo — Variantes Junco y Bambú

15 de octubre de 2026. Exploración solicitada por el usuario. **Pendiente de elección.** Carnoso se conserva como Tallo aprobado; estas propuestas no sustituyen su arte ni cambian la app, el editor, la calibración o los desbloqueos.

## Propuestas

| Variante | Diferencia estructural | Valoración |
| --- | --- | --- |
| Junco | Tres tallos lisos de alturas distintas, con uno frontal protagonista; gesto flexible y sin hojas anchas ni nudos. | La silueta tiene más movimiento y carácter de mata. Conserva la masa frontal para la cara. La botánica está estilizada: los tallos son bastante carnosos para integrarse en la familia. |
| Bambú | Un culmo continuo, dos nudos claros y dos ramas pequeñas con cinco hojas estrechas. | Su lectura botánica es más inmediata. Los nudos se distinguen sin convertir el cuerpo en bolas apiladas. |

![Tallo — Junco](stem-variant-junco.png)

![Tallo — Bambú](stem-variant-bambu.png)

## Criterio y revisión

Se mantienen verdes vivos, planos amplios de luz y sombra, brillos marfil, ojos pequeños separados y sonrisa cerrada sencilla. Junco y Bambú cambian su estructura y follaje; no son cambios de proporción de Carnoso.

Ambas imágenes se han inspeccionado completas tras generarlas. Hay un personaje en cada una, fondo crema, sombra de suelo, contornos limpios y ausencia de texto decorativo. Junco no tiene la mazorca marrón de la espadaña. Bambú muestra dos nudos y hojas lanceoladas. No se ha necesitado una segunda generación.

Son conceptos raster de una sola pieza con cara y sombra incluidas. No son cuerpos finales para el componente compartido. Si se elige una variante, habrá que separar cuerpo, cara y sombra, ajustar la composición en el editor y comprobar tamaños pequeños y modo icono. La cara generada aproxima el estilo común; no garantiza la geometría SVG exacta.

## Referencias

- `stem-directions-exploration.png`: las tres direcciones previas y su lenguaje facial.
- `bodies/stem.png`: Carnoso aprobado; volumen, paleta y planos de sombra.
- `brote-variations-a-tierra-v3.png`: curvas y acabado de hojas de la familia.

También se han leído `AGENTS.md`, `docs/frontend/DESIGN.md`, la skill `reedleaves-mascots` y la skill `imagegen`.

## Herramienta y archivos

Herramienta integrada `image_gen`, una llamada por variante, con las tres imágenes locales como referencias de estilo. Sin CLI ni API propia. Los originales generados se han copiado al repositorio conservando los originales y sin sobrescribir archivos.

- `stem-variant-junco.png`: PNG de 1254 × 1254.
- `stem-variant-bambu.png`: PNG de 1254 × 1254.

## Prompt — Junco

```text
Use case: stylized-concept.
Asset type: ONE standalone Reedleaves mascot variant exploration named Junco, with no written name or text in image.
Reference images: Image 1 (three Tallo directions) provides established mascot rendering and facial language; Image 2 (the isolated Carnoso body) provides approved green palette and broad colored planes; Image 3 (Brote) provides simple organic leaf rendering. These are style references, not an edit target. Invent a recognizably RUSH / JUNCO body rather than merely resizing Carnoso.
Scene: plain warm ivory cream #FFF9ED background, one subtle muted green-gray oval ground shadow under character.
Subject: a single friendly green rush plant character, plump but with a distinctive upright flexible rush silhouette. A cohesive small tuft of exactly THREE smooth cylindrical living-green stems emerges from a single tidy shared base, no visible soil or roots. One dominant front stem is broad enough in its lower half for a tiny wide-set face and sweeps gently upward into a soft taper with rounded tip bending slightly right. Its lower two-thirds are continuous and substantial, not a spherical base. The other TWO stems are much slimmer, behind on either side at unequal heights, lean naturally outward, and end in clean narrow round-tipped tapers. All three remain cylindrical, leafless, without joints or branching; restrained rhythm like a small wetland rush tuft. The broad leading stem remains clearly the character, the two secondary rush stems are supporting silhouette. No broad oval leaves.
Face: exactly TWO tiny equal dark forest-green #173D2C vertical oval eyes, spaced wide on the front stem's lower-middle plane; one short shallow closed curved smile beneath. Quiet warm expression. No eye glints, pupils, eyebrows, nose, blush, mouth opening, hands or feet.
Style: match the supplied Reedleaves family: simple polished vector-like illustration, smooth clean contours, rounded organic volume, vivid tender greens #B9E877 #83BD4D #58BE59 and one medium darker green side plane #369247. Broad lime front plane, a single concise ivory curved highlight on dominant stem, restrained highlights on side stems. Gentle tone transitions allowed, but no realistic texture, glossy 3D plastic or hard outlines.
Composition: square image, centered whole character, fills about 78% of canvas height, generous clear cream margins. Flat eye-level frontal view with slight organic asymmetry. Ground shadow visually independent.
Avoid: cattail / espadaña brown sausage seed heads; flowers, inflorescences, reeds with feathery tops, bamboo nodes, bamboo leaves, cactus, succulent oval leaves, tentacles, a forked hand, hair, grass lawn, extra characters, pots, soil, root clump, feet, limbs, books, props, text, labels, logos, sparkles, ornamental borders. A botanical rush-inspired Reedleaves character, clear at small sizes.
```

## Prompt — Bambú

```text
Use case: stylized-concept.
Asset type: ONE standalone Reedleaves mascot variant exploration named Bambú; no name, label or any text visible.
Reference images: Image 1 (three Tallo directions) supplies family rendering and quiet face; Image 2 (approved isolated Carnoso body) supplies the green planes and gentle rounded volume; Image 3 (Brote) supplies friendly organic leaf rendering. These are style references. Invent a clearly recognizable young green BAMBOO character, distinguishable from the succulent-looking Carnoso and the three-bulb C Nudos.
Scene/backdrop: plain warm ivory cream #FFF9ED. One independent subtle muted green-gray oval ground shadow directly beneath.
Subject: one upright plump living-green bamboo culm as protagonist, continuous almost parallel sides with very gently rounded corners and a slight organic lean. A long coherent stalk, not a stack of globes: exactly THREE long cylindrical internodes separated by exactly TWO narrow clearly readable pale lime-green node collars, each collar a simple curved thin ring with minimal projection. Internode lengths gently unequal; the lowest has ample uninterrupted space for the quiet face. The upper tip is closed and softly rounded, NEVER a sawn-off hollow tube. No taper into a spear.
Two short fine curved green side branchlets emerge from node collars at different heights. The upper-right branch carries exactly THREE narrow curved lance-shaped bamboo leaves; the lower-left branch carries exactly TWO narrow curved lance-shaped leaves. Each leaf is long and slender, softly pointed, with simple bright front and medium green underside planes. Leaves look like bamboo foliage rather than wide succulent paddles, no complex veins. Keep only five leaves total and make their silhouette simple. Main culm always visually dominant and substantial enough to be friendly, not spindly.
Face: exactly TWO very small equal solid vertical oval eyes dark forest green #173D2C, spaced widely across the front of the lower internode, with one short shallow closed curved smile beneath. Eyes small relative to body, no glints, pupils, eyebrows, blush, nose, open mouth, limbs or feet.
Style/medium: polished simple vector-like Reedleaves concept illustration matching references; vivid lime/light-green front #B9E877 and #83BD4D, a single broad medium green side #58BE59 and darker underside #369247. Clear expansive colored planes with restrained gentle transitions. One broad small ivory curved highlight at top front, leaf highlights subtle and sparing. Clean rounded silhouettes, no hard exterior outline, no realistic texture, no glossy plastic.
Composition: square image, one full centered character, about 78% canvas height with generous cream margins, frontal eye-level view. Upright calm and friendly, organic asymmetry. Node collars remain readable at thumbnail size.
Avoid: three stacked balls, swollen sausage segments, string of beads, harsh discs, multiple bamboo culms, panda, cut wood, bamboo grain, brown woody texture, hollow cut tip, detailed botanical realism, four or more nodes, broad oval succulent leaves, cacti, feathery seedheads, flowers, pots, soil, roots, props, books, labels, captions, lettering, watermark, extra characters, sparkles, decorative elements.
```
