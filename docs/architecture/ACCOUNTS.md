# Cuentas y progreso

Estado: implementado para la prueba interna. Usuario y contraseña, sin correo ni proveedores externos.

## Identidad y sesión

- Usuario único, sin distinguir mayúsculas, de 3 a 32 caracteres ASCII.
- Contraseña de 8 a 128 caracteres; admite espacios y frases. No se guarda en claro.
- Hash `scrypt` con sal aleatoria por contraseña: N=131072, r=8, p=1. Máximo dos cálculos simultáneos.
- Sesión aleatoria de 256 bits, válida siete días. La base activa conserva su hash; el navegador recibe una cookie `HttpOnly`, `SameSite=Strict`, sin acceso desde JavaScript.
- En HTTPS la cookie añade `Secure`. Entrar rota la sesión de ese navegador; cerrar sesión revoca solo esa sesión, no los otros dispositivos.
- Intentos de acceso limitados por dirección y usuario. Error genérico si la cuenta no existe o la contraseña no coincide.
- Mutaciones con origen exacto y token CSRF por sesión. JSON limitado a 8 KiB; respuestas de cuenta sin caché.
- El usuario siempre sale de la sesión. La API no acepta un usuario, saldo o fecha elegidos por el cliente.

La zona horaria se valida y se fija al crear la cuenta. La fecha se calcula con el reloj del servidor en esa zona. No hay una API para cambiarla y obtener abonos adicionales.

## Persistencia

SQLite local o PostgreSQL en producción guarda, por usuario: barajas añadidas al Tarjetero, lectura del libro, idioma, monederos, votos y tarjetas guardadas. `card_views` registra tarjetas vistas una sola vez por usuario para los perfiles. La idea diaria se guarda una sola vez por fecha UTC y es común a todas las cuentas.

Añadir una baraja al Tarjetero cuesta una hoja y añadirla otra vez no vuelve a cobrarla. Elegir una baraja no cuesta nada.

Todas las tarjetas de una baraja añadida se pueden abrir desde el principio, incluidas las hijas y las citas. Abrir una tarjeta no cobra hojas ni pétalos y no guarda avance por baraja. Las sesiones breves de cinco tarjetas se registran en `practice_sessions` y cobran pétalos.

La idea del día se sortea al primer acceso de cada fecha UTC y queda fijada para todo el mundo. Se elige al azar entre las tarjetas raíz de las barajas predeterminadas del catálogo y se agotan las candidatas antes de repetir; al empezar otro ciclo se evita la tarjeta del día anterior si hay alternativa. Una cita raíz también puede salir. El calendario permite consultar las asignaciones anteriores.

Las guardadas se consultan por cuenta y libro, sin aparecer en perfiles o bibliotecas ajenas. Todas las tarjetas disponibles en el catálogo se pueden guardar. Repetir el mismo destino conserva la fecha; quitar y volver a guardar crea una nueva. Abrir desde Guardadas valida pertenencia y registra contexto `saved`, sin alterar el repaso. La cuenta propia incluye `cardSaves`; esa relación permite incorporar el libro a Biblioteca sin cambiar su estado de lectura o repaso.

Votos y guardadas usan React `useOptimistic` y Actions: selección y contador cambian antes de la respuesta. Cada cuenta/tarjeta/tipo tiene su cola, con destinos absolutos y relectura tras una respuesta perdida. Guardar no bloquea votar. Los cambios de sesión invalidan peticiones antiguas y desmontan el estado privado. La sincronización actualiza las acciones de un modal sin reemplazarlo.

El navegador muestra el estado confirmado y consulta cambios al volver al primer plano y cada 30 segundos mientras está visible. No sustituye formularios, búsquedas o modales abiertos con una actualización en segundo plano. Ante un fallo de red conserva el último estado y ofrece reintento; no concede progreso local provisional.

## API

| Ruta | Método | Resultado |
| --- | --- | --- |
| `/api/session` | GET / HEAD | Estado completo o `user: null` |
| `/api/auth/register` | POST | Alta y sesión |
| `/api/auth/login` | POST | Sesión |
| `/api/auth/logout` | POST | Revocar sesión actual |
| `/api/reader/state` | GET / HEAD | Estado autenticado |
| `/api/reader/select` | POST | Elegir baraja, gratis |
| `/api/reader/open` | POST | Abrir tarjeta y registrar su vista |
| `/api/reader/reading` | POST | Estado manual del libro original |
| `/api/reader/preferences` | POST | Idioma y títulos originales |
| `/api/reader/daily` | POST | Obtener o asignar la idea de hoy |

`/api/catalog` sigue siendo público y de lectura. Registro y acceso requieren origen válido; las demás mutaciones requieren además sesión y `X-CSRF-Token`. Las pestañas comparten cookie; los dispositivos usan sesiones distintas de la misma cuenta.

## Datos anteriores

La base v8 se conserva en `var/backups/pre-accounts-2026-10-06.sqlite` y su original en `var/backups/pre-accounts-original-2026-10-06.sqlite`. Se compararon todas las tablas previas, excluyendo solo fechas técnicas: los datos editoriales se conservan. No había lectores ni progreso SQL en la base anterior.

El progreso anónimo antiguo del navegador no se borra ni se importa como verificado. La cuenta nueva empieza con una hoja, diez pétalos y sin repasos. Los pétalos recargan nueve al día hasta un máximo de quince; las sesiones de cinco tarjetas cuestan tres pétalos o dos para el tipo con descuento. Las respuestas se guardan por usuario y tarjeta para ordenar sesiones futuras. Solo la preferencia de idioma y los borradores de notas se escriben ahora en localStorage.

## Lista histórica previa al despliegue

Esta sección describe la preparación inicial, no el estado operativo vigente. La app ya está desplegada; consultar `docs/development/README.md` y la entrada más reciente. La visibilidad de barajas se rige por ADR 0002, no por el término borrador.

- Despliegue HTTPS con `NODE_ENV=production` y `REED_ORIGIN=https://<dominio>`; el servidor rechaza producción sin esa configuración. TLS puede terminar en un proxy; no se confía en cabeceras reenviadas para inventar un origen.
- `DATABASE_URL` de PostgreSQL, copias del proveedor y prueba de restauración.
- Recuperación de contraseña y política de cuentas. No están implementados correo, verificación, MFA ni eliminación de cuentas.
- Supervisión y límites de tráfico en el proxy: el límite de acceso local no sustituye protección frente a ataques distribuidos.
- La app sigue sirviendo borradores editoriales internos. Autoría pública y votos no forman parte de esta entrega.
- Para acceder desde otro dispositivo hace falta una instancia accesible con el mismo servidor y base. No se ha publicado la app ni abierto el puerto local a la red.

Referencias primarias: [contraseñas, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [sesiones, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) y [crypto de Node 24](https://nodejs.org/docs/latest-v24.x/api/crypto.html).

## Perfil y vistas de tarjetas (2026-10-11)

- `GET /api/profiles/:userId` requiere sesión y devuelve solo nombre, usuario público, fecha de alta, estadísticas y resúmenes de los libros visibles para quien consulta. No devuelve credenciales, sesión ni monedero. Las barajas y tarjetas creadas por cuentas son visibles en el catálogo común; editar borradores sigue reservado a su creador. Incluye también a los creadores editoriales sin cuenta de acceso.
- `POST /api/reader/view` requiere origen, sesión y CSRF. Registra una tarjeta distinta por usuario al mostrarse en idea diaria, una sesión de práctica o autoría. Comprueba que sea la idea asignada, una tarjeta válida de práctica o contenido propio en borrador, según el contexto. Los reintentos no duplican vistas. No modifica los monederos ni la sesión.
- `card_views` guarda `user_id`, `card_id` y primera fecha de vista. La migración histórica conserva el progreso de repaso anterior y rellena vistas desde ese registro. Las ideas diarias anteriores solo prueban asignación, no visualización; no se inventa su historial de vistas.
- Métricas del perfil: libros leídos y en lectura son estados manuales; tarjetas vistas cuenta IDs distintos; las contribuciones cuentan barajas, tarjetas y citas creadas. No hay métricas de barajas empezadas, tarjetas repasadas ni barajas completadas.
- Mascotas: una etapa actual por libro, compartida con la UI. El crecimiento cuenta días distintos con sesiones pagadas completadas. Totales de creador incluyen sus barajas y tarjetas, con citas como subconjunto. La biblioteca ajena muestra fichas de libros compartidos asociadas al perfil. Ver [ADR 0001](../adr/0001-libros-en-catalogo-comun.md) y [ADR 0002](../adr/0002-barajas-en-catalogo-comun.md).
