# Primer recorrido funcional

Documento de diseño del primer recorrido. Las reglas de acceso por tarjeta descritas en versiones anteriores se eliminaron el 18 de octubre de 2026.

## Decisiones

- Logo y mascota aprobados. No rediseñarlos.
- Reedleaves es el nombre oficial del proyecto, la web y la app. No investigar disponibilidad en esta fase.
- Catálogo: Los 7 hábitos, Padre rico padre pobre, Getting Things Done, Atomic Habits y Same as Ever.
- 42 cartas en seis barajas. Cada ejemplo declara un solo idioma, unas en español y otras en inglés. Los 7 hábitos conserva las siete principales; los nuevos libros tienen 6, 7, 8 y 7, respectivamente. La propuesta alternativa de Los 7 hábitos tiene dos niveles.
- Interfaz en español, inglés y francés; barajas actuales en español o inglés. Una tarjeta por foco, dos recorridos: «Repasar» y «Una idea al día».

## Recorrido

Inicio → libros en repaso, dibujados cerrados → abrir recorrido → elegir cualquier tarjeta de la baraja.

Cada contenedor de libro tiene portada, lomo y canto de páginas. No es una tarjeta genérica con un icono. Si solo hay un repaso activo, entrar en el libro abre su recorrido directamente; si hay varios, abre sus barajas.

Añadir libro → cuadrícula de todos los libros cerrados → ficha modal del libro → ver barajas → seleccionar baraja → aparece en Inicio sin gastar hojas.

Idea del día → calendario global → idea de hoy o de una fecha anterior → «Repasar este libro» → seleccionar baraja.

Cabecera con logo sin lema, saldos de hojas y pétalos; idioma y cuenta dentro del botón de ajustes. Sin sesión, acceso o creación con usuario y contraseña; explorar el catálogo no necesita cuenta.

El repaso muestra todo el árbol desplegado de arriba hacia abajo y usa el scroll vertical de la página. Todas las tarjetas muestran título y contenido, y se pueden abrir en cualquier orden. El avance registra qué tarjetas se han repasado y la última abierta.

Al abrir la primera historia el libro queda «repasando»; al abrir todas, «repasado». Esto no afirma aprendizaje ni dominio. La lectura del libro original se marca manualmente: sin empezar, leyendo o leído. Ambos ejes son independientes.

## Reglas de la prueba

- Una idea compartida por todas las cuentas para cada fecha UTC. La selección se conserva al recargar y al cambiar de idioma.
- El calendario permite abrir ideas asignadas en fechas anteriores.
- La idea diaria no registra progreso en el repaso.
- Progreso y posición SQL por usuario y versión. Volver a entrar en la misma cuenta recupera ambos.
- Divisas: la cuenta nueva recibe diez pétalos. Las hojas siguen acumulándose con abono diario hasta tres, pero no se usan al abrir tarjetas. Los precios y usos se decidirán después.
- «Añadir libro» muestra título, autor, intereses y número de barajas. Su ficha modal contiene el resto de datos, la lectura original y el acceso a barajas, con vuelta al catálogo. Inicio solo muestra barajas elegidas pendientes o repasos empezados, no todas las recomendaciones del catálogo.
- La lista SQL de barajas elegidas es independiente de la selección usada para la idea diaria. Una baraja completa se sigue consultando desde Libros.
- El estado local antiguo se conserva sin borrar ni importar como verificado. La cuenta nueva empieza limpia. La interfaz solo escribe ahora el idioma en localStorage.
- Recargar no cambia el avance. El servidor registra una tarjeta una sola vez por repaso; los reintentos y dos sesiones no duplican el progreso.
- Sin conexión, conservar el estado confirmado y ofrecer reintento.
- Cambiar reloj o almacenamiento del navegador no altera saldos ni progreso. La sincronización depende de usar la misma cuenta y servidor.
- Contenido y estado se almacenan por separado.
- Contenido servido desde SQLite mediante API; filas normalizadas para libros, géneros, tarjetas y traducciones. Los CSV son edición/importación, no una base de datos simulada. Ver `docs/architecture/CATALOG.md`.
- El antiguo JSON/NDJSON se conserva solo en fixtures de pruebas. No está en el catálogo ni se sirve por HTTP.
- Las cartas SQL pertenecen a versiones de baraja y admiten hijos. El selector y el repaso usan una versión elegida. El registro de repaso no impone un orden entre las tarjetas.
- Solo resúmenes propios contrastados con fuentes oficiales. Títulos parafraseados, sin citas ni portada comercial.

## Diseño

Conservar la familia Duolingo/Forest: siluetas amables, profundidad por capas, botones con volumen, papel cálido y la mascota ya aprobada. No añadir dashboards, inventarios, rachas ni una rejilla de siete tarjetas.

La animación acompaña la acción: celebración finita al abrir una historia. No bucles, sonidos ni castigos por ausencia. Con `prefers-reduced-motion`, todo es estático.

Inicio muestra libros cerrados, solo los que tienen un repaso pendiente. Los recorridos completos se ven al entrar; la idea diaria comparte pantalla con el calendario. Las portadas son contenedores propios, no portadas comerciales. Sin accesos directos a historias ni marcas de leído.

## Pendiente

- Revisar el contenido de las 42 cartas.
- Elegir plataforma final después de validar el recorrido.
- Recuperación de contraseña y despliegue seguro antes de publicar. Cuentas y fecha de servidor ya implementadas; ver `docs/architecture/ACCOUNTS.md`.
- Autoría por usuarios queda para otra fase. Naming cerrado: Reedleaves.
