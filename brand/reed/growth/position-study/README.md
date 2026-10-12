# Editor interno de calibración de mascotas

`index.html` permite elegir una mascota y ajustar sus doce parámetros, con vistas a 160, 100, 60 y 32 px. Reutiliza el componente real, su sombra fija, saludo, guiño y variante de icono. Mostrar marcos ayuda a evaluar el encuadre. El modo de icono desactiva los controles faciales y los gestos porque solo muestra el cuerpo.

## Parámetros y fuentes

- Personaje: x/y en porcentaje del marco y escala uniforme. Los valores iniciales se leen de las variables CSS del componente real, sin una segunda tabla.
- Cara y boca: anchura de boca, x/y de la cara en el marco de 160, giro en grados y escala uniforme. Sus valores proceden de `mascot-face.mjs`.
- Cada ojo: x/y locales desde los centros canónicos, antes del giro y la escala facial. Los ajustes de la raíz y la semilla elegidos por el usuario siguen siendo los valores actuales de partida.

Cada control admite arrastre y entrada numérica. El borrador de cada mascota se conserva al cambiar de selección y recargar, con `localStorage`. Restablecer mascota borra solo ese borrador. Si cambian los metadatos de producto, los borradores basados en la calibración anterior se descartan; si el navegador no permite almacenamiento, se puede trabajar y copiar la configuración igualmente.

Copiar configuración produce un JSON con etapa, cuerpo, boca y cara. También está disponible en el detalle Configuración como alternativa si falla el portapapeles. Las modificaciones son locales: no escriben archivos ni cambian cuentas o datos del producto. Para incorporarlas al componente, trasladar cuerpo a `--mascot-x`, `--mascot-y`, `--mascot-scale` en CSS; boca a `mascotMouthConfig`; cara y ojos a `mascotFacePlacement`.

## Añadir mascotas futuras

1. Añadir un cuerpo sin cara ni sombra a `mascotAssets` y su geometría facial a `mascotFacePlacement`.
2. Añadir la calibración corporal en CSS cuando difiera de los valores comunes.
3. La mascota aparecerá automáticamente en el selector. Puede añadirse su nombre a `names` en `positions.mjs`; sin nombre específico se muestra su identificador.

La página se mantiene en `brand/` como herramienta interna. No desbloquea propuestas futuras ni modifica las reglas del producto.
