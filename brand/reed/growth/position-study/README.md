# Editor interno de calibración de mascotas

`index.html` permite elegir una mascota y ajustar sus catorce parámetros, con vistas a 160, 100, 60 y 32 px. Reutiliza el componente real, su sombra independiente, idle en bucle, guiño y variante de icono. Mostrar marcos ayuda a evaluar el encuadre. El modo de icono muestra directamente la imagen del cuerpo, con el tamaño de cada vista previa. Desactiva todos los controles de calibración y los gestos: el icono no hereda la colocación del personaje.

## Parámetros y fuentes

- Personaje: x/y en porcentaje del marco y escala uniforme. Los valores iniciales se leen de las variables CSS del componente real, sin una segunda tabla.
- Sombra: anchura (10–100%, valor común actual 72%) y altura (1–50%, valor común actual 15.384615%) independientes, en porcentaje del marco. Mantiene el centro en (50%, 87.5%), color y transparencia; no se desplaza con el cuerpo; solo su anchura se anima de forma sincronizada con el idle. Se leen de `--mascot-shadow-width` y `--mascot-shadow-height`, con posibles excepciones en CSS por mascota. La altura común se conserva en 15.384615 %. Tallo usa la calibración elegida de 7.71085322836256 %; Raíz conserva el valor común.
- Cara y boca: anchura de boca, x/y de la cara en el marco de 160, giro en grados y escala uniforme. Sus valores proceden de `mascot-face.mjs`.
- Cada ojo: x/y locales desde los centros canónicos, antes del giro y la escala facial. Los ajustes de la raíz y la semilla elegidos por el usuario siguen siendo los valores actuales de partida.

Cada control admite arrastre y entrada numérica. El borrador de cada mascota se conserva al cambiar de selección y recargar, con `localStorage`. Restablecer mascota borra solo ese borrador. Los borradores anteriores de trece parámetros conservan sus ajustes y heredan la altura vigente de sombra. Los de doce parámetros heredan además la anchura vigente. Si cambian los metadatos de producto, los borradores basados en la calibración anterior se descartan; si el navegador no permite almacenamiento, se puede trabajar y copiar la configuración igualmente.

Copiar configuración produce un JSON con etapa, cuerpo, sombra (`shadow.width` y `shadow.height`), boca y cara. También está disponible en el detalle Configuración como alternativa si falla el portapapeles. Las modificaciones son locales: no escriben archivos ni cambian cuentas o datos del producto. Para incorporarlas al componente, trasladar cuerpo a `--mascot-x`, `--mascot-y`, `--mascot-scale` en CSS; sombra a `--mascot-shadow-width` y `--mascot-shadow-height` (porcentajes) en la misma regla; boca a `mascotMouthConfig`; cara y ojos a `mascotFacePlacement`.

## Añadir mascotas futuras

1. Añadir un cuerpo sin cara ni sombra a `mascotAssets` y su geometría facial a `mascotFacePlacement`.
2. Añadir la calibración corporal en CSS cuando difiera de los valores comunes.
3. La mascota aparecerá automáticamente en el selector. Puede añadirse su nombre a `names` en `positions.mjs`; sin nombre específico se muestra su identificador.

La página se mantiene en `brand/` como herramienta interna. No desbloquea propuestas futuras ni modifica las reglas del producto.

Tallo (`stem`) está disponible como A · Carnoso, elegida por el usuario el 14 de octubre de 2026. Usa un cuerpo PNG transparente sin cara ni sombra, con la cara SVG, la sombra y el movimiento del componente compartido. Su calibración inicial se puede ajustar con los mismos catorce controles. Desde el 15 de octubre la regla de producto elegida es diez días distintos de gasto por libro; el editor no modifica ese progreso.
