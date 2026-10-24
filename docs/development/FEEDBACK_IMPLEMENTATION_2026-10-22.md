# Seguimiento de feedback (2026-10-22)

Actualizado el 24 de octubre: los PR #71, #72, #73, #75, #78 y #80 están integrados en `main`. Se conserva la numeración anterior. Tras contrastar los textos originales de feedback, el punto 16 era otra petición de racha diaria, ya cubierta por el 15; no pedía una racha de repasos. Se añaden los dos comentarios nuevos como 18 y 19.

## Trabajo pendiente de implementación

| Punto | Trabajo | Estado |
| --- | --- | --- |
| 3 | Flecha de vuelta en perfil solo si existe un destino anterior útil, distinto de Home. | Saltado por el usuario. |
| 9 | Resolver la duplicidad entre Ver baraja y Ojear baraja. | Aparcado. |
| 14 | Vista de lomos; decidir dónde se aplica automáticamente y a partir de cuántos libros. | Trabajo separado. |
| 17 | Definir coste en pétalos: fijo o aleatorio asignado a cada baraja. | Decisión pendiente. |
| 19 | Valorar app móvil y widget flotante para tomar notas mientras se lee en ReadEra. | Comentario nuevo de producto. |

## Estado por punto

1. **Día seleccionado del calendario** — integrado en `main` (#73): el hover táctil no sustituye el verde de la fecha seleccionada.
2. **Primera baraja Guardadas vacía** — integrado en `main` (#75): botón principal con marcapáginas en la cabecera del libro; no ocupa una posición de la cuadrícula.
3. **Navegación de vuelta en el perfil** — saltado por el usuario: flecha tipo Apple solo cuando haya un destino anterior con sentido; no mostrarla si volver equivale a ir a Home.
4. **Mayúsculas en usernames** — integrado en `main` (#80): el registro explica caracteres permitidos, longitud, primer carácter y conversión a minúsculas.
5. **Contador de Guardadas** — cubierto por #75: aparece en el botón cuando es mayor que cero.
6. **Tipografía de tarjetas** — integrado en `main` (#71 y #78): fuentes anteriores retiradas, citas en cursiva y mismo tamaño de cuerpo que las demás tarjetas en cada vista, incluidas las previews.
7. **Botones de cierre** — integrado en `main` (#80): cierre circular fuera de las fichas de libro y baraja, por encima de su contenido.
8. **Scroll bajo modales** — implementado: los diálogos bloquean el desplazamiento de fondo y restauran el estado al cerrarse.
9. **«Ver/Ojear baraja»** — aparcado expresamente para más adelante: ambos controles aparecen en el detalle de una baraja guardada; no se cambió el flujo.
10. **Mascota Tallo plana** — integrado en `main` (#72): arte y parámetros aprobados por el usuario.
11. **Swipe al leer una baraja** — gesto integrado en #71; botones accesibles junto al contador integrados en #80.
12. **Intereses Software/Mindfulness, libros e iconos** — implementado en local, pendiente de publicación: ambos intereses disponibles en español e inglés e iconos en fichas, preview de libros, filtro y editor. Revisados los 24 libros actuales: «Tidy First?» de Kent Beck pasa de Crecimiento personal/Productividad a Software; los otros 23 conservan su clasificación. Mindfulness queda disponible sin asignaciones forzadas. La migración preserva los demás intereses, sus nombres y las tarjetas.
13. **Títulos traducidos preferidos** — integrado en `main` (#80): título original y preferido opcional por idioma, con fallback al original. La migración conserva los títulos y textos guardados, y permite títulos preferidos vacíos.
14. **Vista de lomos** — pospuesta para tratarla por separado.
15. **Racha de idea del día** — integrado en `main` (#80): sustituye la preview bajo el calendario; cuenta al abrir la idea actual en exclusiva.
16. **Racha en lugar de preview bajo el calendario** — cubierto por #80 junto al 15. Corrección de seguimiento: el comentario original no pedía una racha de repasos.
17. **Coste en pétalos del repaso** — pendiente: fijo o aleatorio asignado a cada baraja.
18. **Anclar ajustes a la derecha** — implementado en local, pendiente de publicación: el botón permanece a la derecha tanto con sesión como sin ella.
19. **App móvil y widget flotante** — pendiente de valorar: tomar notas mientras se lee en ReadEra.

## Verificación

- Puntos 12 y 18: `npm test` completo con build, 315 pruebas, Node 24.21.0, salida 0.
- `npm run lint` correcto.
- La nueva migración se prueba desde SQLite 37 y PostgreSQL 29, con inicialización repetida: conserva libros, tarjetas, asignaciones de los demás libros, etiquetas existentes y RLS de PostgreSQL.
- `git diff --check` limpio.
- La revisión del catálogo de producción fue de solo lectura; los cambios de intereses siguen pendientes de publicación.

## Entrega

Los cinco bloques se integraron mediante el PR #80. Esta comprobación confirma la integración en `main`; no constituye una verificación del despliegue en Render. Los puntos 12 y 18 están implementados en local y pendientes de publicación. Quedan por implementar o decidir los puntos 3, 9, 14, 17 y 19.
