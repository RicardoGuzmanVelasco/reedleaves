# Seguimiento de feedback (2026-10-22)

Revisión secuencial de los 17 comentarios. Actualizado el 24 de octubre: los PR #71, #72, #73, #75 y #78 ya están integrados en `main`. La entrega `release/pending-feedback` reúne los cinco bloques locales restantes: 4, 7, 11, 13 y 15.

## Estado por punto

1. **Día seleccionado del calendario** — integrado en `main` (#73): el hover táctil no sustituye el verde de la fecha seleccionada.
2. **Primera baraja Guardadas vacía** — integrado en `main` (#75): botón principal con marcapáginas en la cabecera del libro; no ocupa una posición de la cuadrícula.
3. **Navegación de vuelta en el perfil** — pendiente: explorar una flecha tipo Apple solo cuando haya un destino anterior con sentido; no mostrarla si volver equivale a ir a Home, ya disponible en la barra inferior.
4. **Mayúsculas en usernames** — el usuario acepta conservar el guardado en minúsculas. Se aclaran en el registro los caracteres permitidos, la longitud, el primer carácter y la conversión de mayúsculas. Implementado en local; pendiente de publicación.
5. **Contador de Guardadas** — cubierto por #75: aparece en el botón cuando es mayor que cero.
6. **Tipografía de tarjetas** — integrado en `main` (#71 y #78): fuentes anteriores retiradas, citas en cursiva y mismo tamaño de cuerpo que las demás tarjetas en cada vista, incluidas las previews.
7. **Botones de cierre** — incluido en esta entrega: cierre circular fuera de las fichas de libro y baraja, por encima de su contenido.
8. **Scroll bajo modales** — implementado: los diálogos bloquean el desplazamiento de fondo y restauran el estado al cerrarse.
9. **«Ver/Ojear baraja»** — aparcado expresamente para más adelante: ambos controles aparecen en el detalle de una baraja guardada; no se cambió el flujo.
10. **Mascota Tallo plana** — integrado en `main` (#72): arte y parámetros aprobados por el usuario.
11. **Swipe al leer una baraja** — gesto integrado en #71. Esta entrega sitúa los botones accesibles a ambos lados del contador, conservando sus límites.
12. **Intereses Software/Mindfulness, libros e iconos** — aparcado: el usuario no tiene contexto ahora. Retomar cuando lo aporte.
13. **Títulos traducidos preferidos** — incluido en esta entrega: título original y preferido opcional por idioma, con fallback al original. La migración SQLite 36→37/PostgreSQL 28→29 conserva los títulos y textos guardados, y permite títulos preferidos vacíos. La IA no inventa traducciones de títulos.
14. **Vista de lomos** — pospuesta para tratarla por separado.
15. **Racha de idea del día** — incluido en esta entrega: se retira la preview bajo el calendario y se muestra la racha junto a «Abrir idea». Cuenta al abrir la idea actual en vista exclusiva; abrir el calendario o una idea pasada no acredita hoy, incluso si se reutilizó la misma tarjeta.
16. **Racha de repasos en calendario** — no iniciar ahora; primero la racha de idea diaria.
17. **Coste en pétalos del repaso** — pendiente de decidir coste fijo o coste asignado por baraja.

## Verificación

- `npm test` completo con build: 306 pruebas, Node 24.21.0, salida 0.
- Migraciones probadas desde SQLite 35/36 y PostgreSQL 27/28, con inicialización repetida, conservación de títulos, textos, tarjetas y RLS de PostgreSQL.
- Estructura de producción comprobada antes de publicar: PostgreSQL 28 y restricción de títulos no vacíos existente.
- `git diff --check` limpio.

## Entrega

El usuario autorizó publicar los cinco bloques pendientes. Esta rama está preparada para el flujo habitual de PR, pruebas automáticas e integración; la publicación se inicia al enviar el PR. Los puntos aplazados siguen fuera de alcance.
