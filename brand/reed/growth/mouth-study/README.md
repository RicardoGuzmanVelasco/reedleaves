# Prueba de anchuras de boca — comparación

Comparación de la sonrisa de referencia (1×), 1,5×, 2× y 3× en las cinco mascotas disponibles. La última columna usa una configuración general de 4,5×, con excepciones iniciales de 5,5× para Maceta, 3,75× para Raíz, 2× para Plántula y 5× para Brote. La anchura general se ajusta de 0,75× a 6×. Cada mascota permite usar esa anchura o definir una propia. Cada muestra aparece a 160 px y 60 px, con el idle en bucle y el guiño del componente compartido.

La curva conserva el centro (82, 119), la profundidad de 3 unidades, el grosor de 3 unidades, los extremos redondos y el color. Se recalcula el trazado cuadrático al cambiar anchura; no se estira el SVG ni el grosor del trazo. La colocación de toda la cara, los ojos, los cuerpos y las sombras son los del componente real, incluida la escala uniforme de la Raíz.

`mascotMouthConfig` en `app/mascot-face.mjs` centraliza la anchura general y un mapa opcional de excepciones por etapa. `mascotArt(stage, className, {mouth: {width, overrides}})` permite usar una configuración de prueba. La prioridad es excepción válida → anchura general válida → anchura vigente. El componente recalcula la curva sin modificar el centro ni estirar el grosor.

Los valores 4,5× / 5,5× / 3,75× / 2× / 5× están aprobados y aplicados en la web. La prueba parte de `mascotMouthConfig` y permite explorar otros valores localmente sin modificar el producto.
