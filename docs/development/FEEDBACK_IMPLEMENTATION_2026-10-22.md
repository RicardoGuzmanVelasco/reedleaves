# Seguimiento de feedback (2026-10-22)

Revisión secuencial de los 17 comentarios. Los puntos implementados están en la rama local `feedback/remaining-items`; los cambios no se han integrado ni publicado.

## Estado por punto

1. **Día seleccionado del calendario** — implementado: se añadió una prueba de regresión para el estado seleccionado y su tratamiento visual verde.
2. **Primera baraja Guardadas vacía** — resuelto en local tras aprobación del usuario el 23 de octubre: Guardadas pasa a ser un botón principal con marcapáginas junto al título de la cabecera del libro. No ocupa una posición en la cuadrícula; el contador aparece solo si hay tarjetas. Pendiente de publicación.
3. **Navegación de vuelta en el perfil** — pendiente: explorar una flecha tipo Apple solo cuando haya un destino anterior con sentido; no mostrarla si volver equivale a ir a Home, ya disponible en la barra inferior.
4. **Mayúsculas en usernames** — ignorado por ahora, según indicación del usuario.
5. **Contador de Guardadas** — la rama actual oculta el contador cuando vale cero. El usuario no tiene claro este comportamiento; revisarlo por separado.
6. **Tipografía de tarjetas** — cuerpo en tipografía normal y citas en cursiva; fuentes anteriores retiradas. Corrección de tamaño implementada en local tanto en vista exclusiva como en las previews: las citas usan el mismo tamaño de cuerpo que las demás tarjetas de cada vista. Pendiente de publicación.
7. **Botones de cierre** — se unificaron en esta rama; el usuario no sigue el cambio y pidió dejar el tema para más adelante.
8. **Scroll bajo modales** — implementado: los diálogos bloquean el desplazamiento de fondo y restauran el estado al cerrarse.
9. **«Ver/Ojear baraja»** — aparcado expresamente para más adelante: ambos controles aparecen en el detalle de una baraja guardada; no se cambió el flujo.
10. **Mascota Tallo plana** — implementado: se añadió una ilustración SVG plana y la app la usa como arte activo.
11. **Swipe al leer una baraja** — implementado: gestos horizontales para avanzar y retroceder en lectura normal, con botones accesibles de alternativa y límites en los extremos. El repaso conserva su comportamiento.
12. **Intereses Software/Mindfulness, libros e iconos** — aparcado: el usuario no tiene contexto ahora. Retomar cuando lo aporte.
13. **Títulos traducidos preferidos** — aclarado: hay un título original en su idioma y un título preferido por idioma, que puede coincidir con el original o diferir; por ejemplo, «El hombre más rico de Babilonia» y «Clean Code». Implementación pendiente.
14. **Vista de lomos** — pospuesta para tratarla por separado.
15. **Racha de idea del día** — iniciar por esta racha. Solo cuenta abrir la idea en vista exclusiva tras pulsarla; entrar en el calendario no cuenta como vista.
16. **Racha de repasos en calendario** — no iniciar ahora; primero la racha de idea diaria.
17. **Coste en pétalos del repaso** — pendiente de decidir coste fijo o coste asignado por baraja.

## Verificación

- Los tests focales de perfil, acciones de tarjeta, diálogos, mascota y navegación de tarjetas pasaron durante la implementación.
- La suite de interfaz `node --test app/*.test.mjs` pasó: 159 pruebas.
- `npm run build:ui` pasó.
- `git diff --check` pasó.
- La búsqueda `rg -i 'garamond|cormorant'` no encuentra referencias en el proyecto.
- `npm test` pasó: 296 pruebas con Node 24.21.0.

## Entrega

Los cambios están solo en la rama local `feedback/remaining-items` del checkout recuperado en `/tmp/longstoryshort-feedback`; todavía no se han integrado ni desplegado.
