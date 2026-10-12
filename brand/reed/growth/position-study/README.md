# Posición de ojos y cara

La raíz admite `eyeOffsets.left` y `eyeOffsets.right`, cada uno con `x` e `y`, dentro de `mascotFacePlacement.root`. Son desplazamientos locales desde los centros comunes (53, 104) y (111, 104), anteriores al giro y la escala de la cara. Los valores elegidos son: ojo izquierdo x=10, y=-2; ojo derecho x=-10,5, y=-4,5. Otras mascotas pueden añadir estas mismas propiedades cuando haga falta; su ausencia equivale a cero.

La semilla mantiene la posición de toda la cara en `mascotFacePlacement.seed`: x=85,5, y=69. Cambiar ese centro mueve los ojos y la boca juntos. No tiene excepciones individuales de ojos.

El componente admite `mascotArt(stage, className, {face: {x, y, rotation, scale, eyeOffsets}})` para ajustes locales. Solo se aceptan números finitos y escala positiva; el resto hereda los metadatos. El guiño usa un grupo interior independiente del desplazamiento del ojo.

La prueba ofrece controles para los ojos de la raíz y la cara de la semilla, con comparación Actual/Ajuste a 160 y 60 px. Reiniciar recupera los metadatos actuales. Los controles modifican únicamente esta vista. La posición inicial coincide con el producto hasta que se elijan otros valores.

## Parámetros de calibración

Los ocho parámetros principales son posición vertical del cuerpo, anchura de boca, x/y de la cara y x/y de cada ojo. El modelo también contempla posición horizontal y escala del cuerpo, y giro y escala uniforme de la cara: doce ajustes de calibración en total. El tamaño del componente, la variante icono/personaje y las animaciones son opciones de presentación independientes de esta calibración.
