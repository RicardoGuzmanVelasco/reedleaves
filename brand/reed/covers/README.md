# Propuestas de portada

**Base** es el diseño aprobado y activo en la app. **Entelada** queda guardada como alternativa sin activar. **Editorial** ha sido descartada y retirada del selector y del CSS.

Abrir `/brand/reed/covers/` con el servidor del proyecto. Lee el catálogo común y reutiliza las portadas y fichas de `app/views.mjs`. Los controles permiten comparar **Base** y **Entelada**, en Inicio o Librería, español o inglés y con títulos originales. Base usa borde continuo, sin páginas sobresalientes, y sombra verde bosque. El progreso de las cinco primeras etapas es una muestra local; no se modifica ninguna cuenta ni se gasta ninguna hoja.

- **Base**: cubierta verde redondeada y tipografía de la interfaz. Título arriba a la izquierda, de 23 px (19 px en móvil), y autor debajo, también a la izquierda.
- **Entelada**: verde salvia, textura de tela sutil, lomo oscuro y título en EB Garamond. Sin marco interior.

Entelada tiene el autor arriba del título; Base conserva título primero y autor debajo. Entelada mantiene el canto de páginas a la derecha; Base deja el borde continuo, sin páginas sobresalientes, y sombra verde bosque. No hay páginas debajo de la cubierta. Inicio no lleva «Repasar» ni flecha; los intereses aparecen solo en la ficha descriptiva. Librería conserva el número de barajas dentro del libro, al pie. Ningún dato de la portada queda fuera del libro. Los iconos muestran directamente la imagen del cuerpo, sin cara ni sombra y sin la escala ni los desplazamientos de la mascota completa.

La comparación usa el mismo ancho máximo de 680 px, columnas y separación uniforme de 24 px entre libros que la app. Base ocupa toda la columna y usa altura mínima de 280 px en escritorio y 240 px en móvil, con el título 4 px más arriba e interlineado de 1,07. Los estados de Inicio van dentro de la cubierta, abajo a la izquierda, apilados y con espacio reservado junto al «+». El contenedor anterior de 860 px ensanchaba las portadas en escritorio y falseaba la comparación de proporciones.

El panel **Ajustes de portada** permite probar seis parámetros comunes a los diseños: altura mínima (280 px), anchura del libro (100 %, ajustable del 80 al 100 % del espacio disponible), tamaño del autor (12 px), tamaño del sello (50 px), distancia inferior (0 px) y opacidad (48 %). En móvil Base reduce la altura mínima a 6/7 (240 px con los valores iniciales), mantiene el sello de 50 px y reduce el autor en 1 px. Entelada conserva su factor de escala de 83 %. El sello mantiene su proporción cuadrada y cabe dentro de la portada, incluso con sus valores máximos. La distancia inferior permanece constante al cambiar las líneas del título; el libro puede crecer para reservar 20 px entre el texto y el sello.

Los controles mantienen sus valores al cambiar de diseño, vista o idioma durante la comparación; Restablecer ajustes recupera los valores iniciales. Se reinician al recargar. Estos controles pertenecen al estudio. La app usa los valores aprobados de Base y no ofrece aún un selector de estilos en Ajustes.
