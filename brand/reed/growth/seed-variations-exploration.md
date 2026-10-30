# Variaciones de Semilla — 12 de octubre de 2026

Primera exploración visual. Decisión posterior: **B · Almendrada** elegida para la app; A y C reservadas para el futuro. Ver `seed-variations-future.md` para el estado vigente.

- **A · Redonda:** cuerpo compacto, suave y ligeramente asimétrico.
- **B · Almendrada:** cuerpo alto con una punta redondeada; lectura más clara como semilla.
- **C · Arriñonada:** cuerpo ancho con una hendidura superior; la alternativa más distinta.

Lámina: `seed-variations-exploration.png`. Generada con la herramienta integrada de imágenes, sin CLI ni API propia.

## Referencias

- Familia vigente: cuerpos de `bodies/`, cara y anchuras de boca de `app/mascot-face.mjs`, escala y colocación de `app/mascot-art.css`. Se rasterizó una comparación de Maceta, Semilla, Raíz, Germen y Brote para suministrarla como primera referencia.
- `root-variations-exploration.png`: segunda referencia; tres siluetas diferentes de un mismo personaje.

## Prompt utilizado

Use case: stylized-concept. Asset type: one landscape character exploration sheet, three alternatives for the Seed mascot in the Reedleaves family. Input image 1 is the exact CURRENT APPROVED family style reference: flowerpot, brown seed, ginger root, green seedling, two-leaf sprout. Input image 2 is the precedent for the exploration format: three genuinely different body silhouettes of one mascot, same personality and rendering. Create an analogous single exploration sheet for the BROWN SEED, three large characters side by side, not roots. Match the approved seed and simple vector-like family MUCH more closely than generic cartoon art: simple flat warm brown fills #C48A53 and #A86F40, a broad organic darker offset edge/shadow and a lighter inset front plane, clean smooth curves, no black outline, no photorealism, no texture or glossy lighting. Each character is a single whole brown unsprouted seed. Shape A, left: squat round plump seed, slightly asymmetric rounded circle, broad cheerful face low in the front. Shape B, center: upright almond-like seed, taller asymmetric tapered silhouette with a soft rounded point leaned slightly right and generous lower body for the face. Shape C, right: distinctly horizontal kidney-bean seed, broad elongated body with a gentle shallow notch at the top center, fully rounded ends, clearly unlike A and B. All three must be visibly different silhouettes, rather than rotations of the same oval. Same exact facial language as approved seed in image 1: TWO SMALL dark forest-green vertical oval eyes far apart horizontally, equal size, no pupils or highlights, broad THIN shallow curved closed smile placed below them, no cheeks, brows, nose or open mouth. Maintain shared eye size and face proportions, facial position may adapt to the silhouette. No leaves, no stem, no roots, no sprouts, no shell split, no arms, no legs, no extra objects. Very friendly and expressive through silhouette alone. One common plain warm cream #FFF9ED background, equal visual weight, ample margins, evenly spaced aligned characters, similar presentation scale to the root exploration reference. Below each character a very subtle soft green-gray ground ellipse with a clear floating gap; same ellipse dimensions and opacity for all three, kept separate visually from bodies. Include ONLY small functional dark forest-green labels centered below the characters, exactly 'A · Redonda', 'B · Almendrada', 'C · Arriñonada'. No headline, no slogans, no other text or decorative elements. Deliver polished readable concept art, landscape aspect ratio about 2.5:1.

## Revisión

La lámina presenta tres siluetas diferenciadas y conserva los marrones cálidos, los ojos separados y la sonrisa verde de la familia. Es una exploración raster: si se elige una variante, su implementación debe recuperar la cara SVG común exacta y separar la sombra de suelo del cuerpo.
