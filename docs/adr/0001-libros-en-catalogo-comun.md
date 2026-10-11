# ADR 0001 — Libros creados directamente en el catálogo común

- Fecha: 2026-10-11
- Estado: aceptada para la etapa actual; modelo de privacidad pendiente de revisión futura.

## Contexto

Hasta ahora, crear un libro lo guardaba como privado. El servidor usaba
`books.creator_user_id` tanto para identificar al creador como para ocultar el
libro a las demás cuentas. Incluso con metadatos completos, otra cuenta no podía
encontrarlo, registrar su lectura ni crear una baraja sobre él.

El objetivo actual es compartir las fichas bibliográficas con el mínimo de pasos.
La gestión de libros privados y su paso explícito al catálogo se pospone.

## Decisión

Crear un libro, manualmente o con una propuesta de IA, lo incorpora directamente
a Librería, el catálogo común. La propuesta de IA sin guardar sigue siendo un
borrador del formulario: solo el guardado crea el libro.

La regla también se aplica a los libros de usuarios ya guardados. No se crea una
copia, se eliminan datos ni se cambia su creador. `creator_user_id` se conserva
como atribución y como permiso para completar metadatos, pero deja de controlar
la visibilidad. No hace falta una migración SQL ni cambiar el contrato de catálogo.

Todas las cuentas con acceso al catálogo pueden encontrar la ficha, registrar su
propio estado de lectura y crear su propia baraja. Un libro incompleto o sin
barajas visibles también forma parte del catálogo. Se mantiene la alternativa
del título original y no se exigen traducciones, enlaces ni intereses para el
guardado manual. Completar la información permanece reservado al creador.

El acceso general sigue sujeto al modo de invitación y sesión del servidor.
Cuando se permite explorar sin sesión, estos libros también aparecen ahí.

## Alcance y consecuencias

- Compartir un libro no publica sus barajas ni sus tarjetas. Los borradores de
  barajas de cuentas siguen visibles y editables solo por su creador. Las reglas
  actuales de versiones publicadas o archivadas se mantienen.
- La Biblioteca personal sigue reuniendo libros relacionados con cada cuenta;
  el catálogo común no los añade automáticamente a todas las bibliotecas.
  La biblioteca de un perfil ajeno puede mostrar las fichas compartidas asociadas
  a ese perfil, sin exponer sus borradores de barajas.
- Estados de lectura, elecciones, progreso y hojas siguen aislados por cuenta.
  IDs, fuentes, traducciones y repasos existentes se conservan.
- El catálogo puede contener fichas incompletas y duplicadas. Esta decisión no
  incorpora moderación, deduplicación, publicación de barajas ni edición ajena.
- No se añade un selector de privacidad ni un paso de publicación al formulario.

## Revisión futura

Revisar la necesidad de libros privados, visibilidad explícita separada de la
autoría, publicación voluntaria, permisos de edición, moderación y duplicados.
Definir también cómo tratar los libros que ya eran compartidos si se recupera
la privacidad. Ninguna de estas funciones queda aprobada o implementada por
este ADR; se pospone su diseño.

## Verificación

Probar en SQLite y PostgreSQL que otra cuenta ve libros manuales y completados
con IA, puede registrar su lectura y crear una baraja propia, pero no completar
metadatos ni consultar, seleccionar, editar o abrir borradores ajenos. Comprobar
que el catálogo arranca con fichas mínimas, conserva libros existentes y permite
abrir desde Librería un libro sin barajas visibles para crear una propia.
