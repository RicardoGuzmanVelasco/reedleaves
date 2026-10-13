# Revisión de pruebas antes de Guardadas

Referencia inicial: Node 24.21.0, 196/204 pruebas correctas. Se revisaron los ocho fallos contra el código, DESIGN y los ADR 0001/0002 vigentes. No se eliminó ninguna prueba: todas cubrían comportamiento útil, aunque varias tenían expectativas antiguas.

| Fallo | Diagnóstico | Cambio y valor que se conserva |
| --- | --- | --- |
| Álbum de baraja | Esperaba una pantalla de detalle que sustituía al álbum y un botón antiguo `deck-album`. Ahora la tarjeta es un diálogo sobre el álbum. | Comprobar la tarjeta y su cierre dentro del diálogo, y que el álbum conserva su progreso debajo. Evitar prohibiciones de marcado sobre toda la página que impedían esta composición. |
| Invitación y acceso al catálogo | API y catálogo usaban relojes distintos para validar la misma sesión. La prueba tenía un reloj controlado; el catálogo consultaba el reloj real y consideraba expirada la sesión. | Corregir `server/http.mjs` para usar `options.now` y comprobar también la expiración exacta en catálogo y estado de lector. No cambiar la fecha de la prueba para ocultar el defecto. |
| Libro mínimo, SQLite | Esperaba que las tarjetas de borradores fueran privadas, regla sustituida por ADR 0002. | Comprobar visibilidad común, prohibición de editar contenido ajeno, gasto propio aislado e idempotencia al reabrir. |
| Libro mínimo, PostgreSQL | Misma expectativa antigua de privacidad. | Mantener la misma cobertura en el motor de producción. |
| Barajas/quotes/autoría, SQLite | Impedía que otra cuenta seleccionara una baraja compartida y daba por hecho que no podía aparecer en Idea del día. | Comprobar selección permitida, edición restringida y estado de repaso aislado. Validar que la idea asignada pertenece al catálogo, sin imponer una elección aleatoria concreta. Conservar pruebas de padres, citas, versiones y reintentos. |
| Barajas/quotes/autoría, PostgreSQL | Misma expectativa antigua de privacidad. | Conservar la cobertura del flujo en PostgreSQL, además de las invariantes SQL. |
| API de autoría | Esperaba ocultar barajas de cuentas al visitante y a otras cuentas. | Comprobar catálogo compartido, CSRF, edición reservada al creador y que el gasto/repaso de otra cuenta no modifica el del creador. |
| Perfil/biblioteca ajena | Suponía que las barajas del creador eran invisibles; cambiaba por ello el conjunto de libros y su estado pendiente. | Comprobar libros compartidos asociados al perfil y los estados correctos. Comparar conjuntos de IDs donde el orden es incidental. Mantener la exclusión de datos de cuenta y el rechazo de autoría ajena. |

## Criterio de fragilidad

- Las comprobaciones de permisos, pertenencia, aislamiento, idempotencia, saldo y progreso se mantienen: protegen contratos del producto.
- Un test visual no debe asumir que el contenido de un modal sustituye el DOM del contexto. Se limita la inspección al diálogo para comprobar sus acciones.
- No se eliminan pruebas de los dos motores por parecer duplicadas: sus migraciones y SQL difieren.
- No se prueba qué tarjeta concreta elige un sorteo cuando el producto no garantiza esa elección.
- No se cambia el producto para recuperar una regla de privacidad ya descartada.

Los cinco archivos afectados pasan sus 36 pruebas tras la corrección. La suite completa posterior pasa **204/204** con Node 24.21.0, antes de empezar la implementación de Guardadas.

## Adaptaciones durante la implementación

- La prueba que comparaba fragmentos de trazados de pulgares dentro del HTML antiguo se sustituye por pruebas de render real del componente React. Comprueban la pareja de votos, los recuentos accesibles, el guardado independiente, ES/EN y la prohibición de votar contenido propio. Las coordenadas SVG no son un contrato funcional.
- Los fixtures de migración usan las constantes del esquema vigente en lugar de repetir su versión. Conservan las comprobaciones de datos migrados y de idempotencia.
- Resultado tras añadir Guardadas: **214/214**, sin pruebas desactivadas ni casos omitidos.
