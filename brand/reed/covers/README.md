# Propuestas de portada

**Base** es el diseño aprobado y activo en la app. **Entelada** queda guardada como alternativa sin activar. **Editorial** ha sido descartada y retirada del selector y del CSS.

Abrir `/brand/reed/covers/` con el servidor del proyecto. Lee el catálogo común y reutiliza las portadas y fichas de `app/views.mjs`. Los controles permiten comparar **Base** y **Entelada**, en Inicio o Librería, español o inglés y con títulos originales. El progreso de las cinco primeras etapas es una muestra local; no se modifica ninguna cuenta ni se gasta ninguna hoja.

- **Base**: cubierta verde redondeada y tipografía de la interfaz. Título arriba a la izquierda, de 23 px (19 px en móvil), y autor debajo, también a la izquierda.
- **Entelada**: verde salvia, textura de tela sutil, lomo oscuro y título en EB Garamond. Sin marco interior.

Entelada tiene el autor arriba del título; Base conserva título primero y autor debajo. Todas muestran lomo y canto solo a la derecha. No hay páginas debajo de la cubierta. Inicio no lleva «Repasar» ni flecha; los intereses aparecen solo en la ficha descriptiva. Librería conserva el número de barajas dentro del libro, al pie. Ningún dato de la portada queda fuera del libro. Las mascotas conservan el arte, la escala por etapa y la variante de icono sin cara ni sombra.

La comparación usa el mismo ancho máximo de 680 px, columnas y separación entre libros que la app. El contenedor anterior de 860 px ensanchaba las portadas en escritorio y falseaba la comparación de proporciones.

El panel **Ajustes de portada** permite probar seis parámetros comunes a los diseños: altura mínima (260 px), anchura del libro (88 %, ajustable del 80 al 100 % del espacio disponible), tamaño del autor (12 px), tamaño del sello (100 px), distancia inferior (0 px) y opacidad (48 %). En móvil se reduce la altura mínima y el sello al 83 %, y el autor en 1 px. El sello mantiene su proporción cuadrada y cabe dentro de la portada, incluso con sus valores máximos. La distancia inferior permanece constante al cambiar las líneas del título; el libro puede crecer para reservar 20 px entre el texto y el sello.

Los controles mantienen sus valores al cambiar de diseño, vista o idioma durante la comparación; Restablecer ajustes recupera los valores iniciales. Se reinician al recargar. Estos controles pertenecen al estudio. La app usa los valores aprobados de Base y no ofrece aún un selector de estilos en Ajustes.
