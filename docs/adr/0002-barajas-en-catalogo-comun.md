# ADR 0002 — Barajas creadas por cuentas en el catálogo común

- Fecha: 2026-10-11
- Estado: aceptada para la etapa actual.

## Contexto

Las barajas que crea una cuenta se guardan como versiones `draft`. Hasta ahora,
el catálogo ocultaba esos borradores a las demás cuentas y el servidor impedía
seleccionarlos o abrir sus tarjetas. La app no ofrece un paso para publicar una
baraja, así que las barajas creadas por usuarios nunca llegaban al catálogo
compartido.

## Decisión

Crear una baraja la incorpora directamente al catálogo común. Sus tarjetas se
comparten al guardarlas, aunque la versión siga como `draft`. El estado de
borrador conserva la capacidad de edición: solo el creador puede añadir
tarjetas. La visibilidad no concede permisos de autoría.

La regla aplica a barajas existentes sin migrar datos ni cambiar IDs. Las
versiones archivadas conservan sus restricciones de selección; el historial de
repaso y las cuentas siguen aislados por usuario.

## Consecuencias

- Cualquier usuario con acceso al catálogo puede encontrar una baraja de cuenta,
  ver sus tarjetas y repasarla.
- Los perfiles y la biblioteca ajena pueden mostrar barajas compartidas; no se
  exponen datos privados de cuenta ni progreso del creador.
- No se añade un selector de privacidad ni un flujo de publicación.
- La privacidad y la moderación del contenido permanecen pendientes de diseño.

## Estado de creación — decisión del 14 de octubre de 2026

La interfaz presenta `draft` como **En progreso** y `published` como **Terminada**.
El creador puede marcar una versión no vacía como terminada mediante confirmación
explícita; queda congelada por las protecciones existentes y no se puede reabrir.
Ambos estados conservan la visibilidad compartida de esta decisión. Terminar no
cambia el progreso de repaso ni las hojas de las cuentas.

Las versiones en progreso muestran «Baraja en progreso» y «Sus tarjetas podrían
cambiar» antes de elegirlas y en el repaso. Las terminadas dejan de ser destinos
para añadir notas desde Inicio. Esta acción expresa finalización del contenido;
no introduce un paso de publicación para hacerlo visible.

## Evolución pendiente: ampliar una baraja ya repasada

Una baraja compartida puede crecer después de que otras personas la hayan
repasado. Hoy, añadir una tarjeta borra el estado de completado de esa versión;
las tarjetas ya abiertas y las hojas gastadas se conservan, pero el repaso vuelve
a quedar pendiente.

Hay que resolver este caso en una etapa futura con versiones inmutables: conservar
la versión completada, crear una versión nueva al añadir contenido y llevar el
avance de las tarjetas existentes para que solo las nuevas queden pendientes y
consuman hojas. Este cambio queda documentado, no implementado en esta etapa.

## Verificación

Comprobar que las barajas y tarjetas de una cuenta aparecen para otra, que la
otra cuenta puede repasarlas y que no puede modificarlas. Comprobar también que
el creador conserva la edición de sus borradores y que el progreso se mantiene
aislado.
