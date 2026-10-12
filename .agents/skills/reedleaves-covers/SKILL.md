---
name: reedleaves-covers
description: Diseña, compara o modifica estilos de portadas de libros de Reedleaves en el estudio y en la app. Actívala al proponer otra portada o ajustar su composición, proporciones, lomo, título, autor o mascota.
---

# Portadas Reedleaves

Usa esta skill solo para las portadas de libros de Reedleaves. Respeta `AGENTS.md`, la dirección de `docs/frontend/DESIGN.md` y el estado actual del código. Para contexto reciente, lee `docs/development/README.md` y la entrada más reciente del diario. Consulta también `brand/reed/covers/README.md`.

## Estado y fuentes

- **Base** es el diseño activo y aprobado. **Entelada** es una alternativa guardada, todavía inactiva. **Editorial** está descartada.
- Las propuestas bajo `brand/` no son decisiones aprobadas. Mantén los estilos nuevos en el estudio hasta que el usuario elija uno; no cambies el diseño de producto por inferencia.
- `app/views.mjs` comparte el marcado de portada entre Inicio, Librería y Biblioteca. `app/reader.css` define el aspecto en la app. `brand/reed/covers/` contiene el estudio y sus controles. El código vigente manda si contradice una nota anterior.

## Diseñar y modificar

- Trabaja con la composición de libro cerrado que ya comparten las tres vistas; evita crear portadas paralelas que diverjan del componente común.
- Conserva títulos y autores alineados según cada estilo, las etiquetas accesibles completas, la preferencia de títulos originales y los idiomas editoriales ES/EN.
- No pongas intereses ni tags en la cubierta. El recuento de barajas y los estados de Biblioteca permanecen dentro del libro. Inicio no lleva «Repasar» ni otra acción debajo de la cubierta.
- En Base, la mascota de Inicio usa el cuerpo de `mascotIcon`, sin cara ni sombra, anclado al pie con independencia de las líneas del título. El libro puede crecer si el contenido necesita espacio.
- La Base aprobada usa título de 23 px (19 px en móvil), autor de 12 px (11 px en móvil), altura mínima de 260 px (83 % en móvil), anchura del 88 % de la columna y sello de 100 px (83 px en móvil), opacidad del 48 % y separación inferior de 0 px. La solapa es verde plana con una línea clara fina. La cubierta tiene borde continuo, sombra verde bosque y no muestra páginas sobresalientes ni marco interior.
- Mantén los ajustes del estudio como controles de exploración. No los traslades a Ajustes de la app ni cambies los valores activos sin petición o elección explícita del usuario.
- Respeta la simplicidad funcional, la pomposidad estética y los pocos casos de uso. Usa solo copy funcional ya aprobado; no añadas lemas decorativos.

## Revisión y publicación

- Abre `/brand/reed/covers/` con el servidor del proyecto y revisa visualmente Inicio y Librería, escritorio y móvil. Comprueba títulos largos, sello, solapa, canto y que ningún dato quede fuera o se solape.
- El estudio reutiliza vistas y catálogo reales; sus estados de ejemplo son locales. No guardes datos de cuentas para preparar comparaciones.
- Sigue las instrucciones de Git de `AGENTS.md`. Una exploración no autoriza activar ni publicar una portada. Publica solo cuando el usuario lo pida expresamente; esa autorización se limita a la acción indicada en la conversación actual.
