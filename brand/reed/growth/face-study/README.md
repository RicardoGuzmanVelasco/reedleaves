# Prueba de caras — comparación

Comparación local de las cinco mascotas disponibles. La cara común se ha integrado en `app/` por indicación del usuario. Los originales se conservan como referencia y las reglas de desbloqueo no cambian.

`brote-face.svg` contiene los trazados exactos del grupo de cara de `brand/reed/mascot.svg`, sin cambiar posiciones internas, proporciones, color ni grosor. Los cuerpos SVG de `../bodies/` mantienen los cuerpos y encuadres originales y retiran únicamente los dos ojos y la boca. La misma cara se coloca como capa SVG dentro del movimiento del personaje. Semilla, Maceta y Brote ajustan solo el centro de la cara; Raíz añade giro de 12 grados y escala uniforme del 80% para encajar en su cuerpo diagonal. Plántula queda idéntica como referencia.

`../bodies/root.png` es una copia de exploración sin cara, editada con la herramienta de imágenes integrada. El archivo original no se modifica; el componente usa la copia sin cara de `../bodies/root.png`. La cara de la propuesta sigue siendo el mismo SVG exacto, no una recreación generada. La separación de los ojos nunca se ajusta independientemente de su tamaño ni de la sonrisa.

Prompt usado (fondo transparente): “Precise object edit for a quick mascot face study. REMOVE ONLY THE EXISTING TWO DARK GREEN EYES AND THE SMALL DARK GREEN SMILING MOUTH. Seamlessly fill those three tiny areas with the surrounding tan body gradient/shading, so the character is completely faceless. Keep every other part unchanged: exact root silhouette and branches, pose, tan colors and gradients, two green leaves, orientation, square canvas framing and margins. Preserve actual background alpha transparency. Do not draw any new eyes or mouth; those will be overlaid from an exact shared SVG later. Do not redraw or simplify the body. Do not add any ground shadow, background, speckles, colored artifacts or text.”

Revisar Actual / Cara de la plántula a tamaño grande y pequeño, y el idle en bucle. La columna Cara común usa el componente real de la web; Guiñar y Parpadear permiten comprobar las capas de ojos.

## Revisión visual

Maceta, Semilla y Brote validadas visualmente por el usuario. La prueba de Raíz eleva la cara 7 unidades en el marco de 160, conservando el centro horizontal, giro y escala, para apartar el ojo de la zona sombreada.

## Componente

La fuente de la cara y su colocación está en `app/mascot-face.mjs`. Posición, giro y escala uniforme pertenecen a la capa facial. Cada ojo tiene un grupo de expresión propio con origen local (0, 0), y la boca tiene su propia capa. Así un guiño no reemplaza el giro de la Raíz ni el salto del personaje.
