# Cuentas y progreso

Estado: implementado para la prueba interna. Usuario y contraseña, sin correo ni proveedores externos.

## Identidad y sesión

- Usuario único, sin distinguir mayúsculas, de 3 a 32 caracteres ASCII.
- Contraseña de 15 a 128 caracteres; admite espacios y frases. No se guarda en claro.
- Hash `scrypt` con sal aleatoria por contraseña: N=131072, r=8, p=1. Máximo dos cálculos simultáneos.
- Sesión aleatoria de 256 bits, válida siete días. La base activa conserva su hash; el navegador recibe una cookie `HttpOnly`, `SameSite=Strict`, sin acceso desde JavaScript.
- En HTTPS la cookie añade `Secure`. Entrar rota la sesión de ese navegador; cerrar sesión revoca solo esa sesión, no los otros dispositivos.
- Intentos de acceso limitados por dirección y usuario. Error genérico si la cuenta no existe o la contraseña no coincide.
- Mutaciones con origen exacto y token CSRF por sesión. JSON limitado a 8 KiB; respuestas de cuenta sin caché.
- El usuario del progreso siempre sale de la sesión. La API no acepta un usuario, saldo o fecha elegidos por el cliente.

La zona horaria se valida y se fija al crear la cuenta. La fecha se calcula con el reloj del servidor en esa zona. No hay una API para cambiarla y obtener abonos adicionales.

## Persistencia

SQLite local o PostgreSQL en producción guarda, por usuario: barajas elegidas, cartas vistas, última carta abierta, lectura del original, idioma, filtros, intereses, idea diaria y monedero.

Elegir baraja no gasta hojas ni aumenta «más popular». Abrir la primera carta crea el repaso y cuenta como una persona que empezó. Una persona se cuenta una vez por baraja, aunque use varias versiones.

Cada carta nueva, también hija, cuesta una hoja. Se recibe una por día, con máximo de tres. Volver a una carta vista cuesta cero, incluso sin saldo. No se puede saltar la madre ni una hermana anterior.

El desbloqueo y el gasto se confirman en una transacción SQL. La clave única de carta por repaso hace los reintentos seguros: un doble clic, una respuesta perdida o dos sesiones no cobran dos veces la misma carta. El esquema SQL comprueba también el recorrido. El repaso termina solo al desbloquear todas las cartas, incluidas las hijas.

La idea del día se fija por usuario y fecha, sin gastar ni desbloquear cartas. Cambiar filtros, idioma o baraja no reemplaza la idea ya asignada hoy.

El navegador muestra el estado confirmado y consulta cambios al volver al primer plano y cada 30 segundos mientras está visible. No sustituye formularios, búsquedas o modales abiertos con una actualización en segundo plano. Ante un fallo de red conserva el último estado y ofrece reintento; no concede progreso local provisional.

## API

| Ruta | Método | Resultado |
| --- | --- | --- |
| `/api/session` | GET / HEAD | Estado completo o `user: null` |
| `/api/auth/register` | POST | Alta y sesión |
| `/api/auth/login` | POST | Sesión |
| `/api/auth/logout` | POST | Revocar sesión actual |
| `/api/reader/state` | GET / HEAD | Estado autenticado |
| `/api/reader/select` | POST | Elegir versión de baraja, gratis |
| `/api/reader/open` | POST | Abrir carta; gasto solo si es nueva |
| `/api/reader/reading` | POST | Estado manual del libro original |
| `/api/reader/preferences` | POST | Idioma, filtros e intereses |
| `/api/reader/daily` | POST | Obtener o asignar la idea de hoy |

`/api/catalog` sigue siendo público y de lectura. Registro y acceso requieren origen válido; las demás mutaciones requieren además sesión y `X-CSRF-Token`. Las pestañas comparten cookie; los dispositivos usan sesiones distintas de la misma cuenta.

## Datos anteriores

El esquema activo es v9. La base v8 se conserva en `var/backups/pre-accounts-2026-10-06.sqlite` y su original en `var/backups/pre-accounts-original-2026-10-06.sqlite`. Se compararon todas las tablas previas, excluyendo solo fechas técnicas: los datos editoriales se conservan. No había lectores ni progreso SQL en la base anterior.

El progreso anónimo antiguo del navegador no se borra ni se importa como verificado. No puede demostrar gastos o fechas fiables. La cuenta nueva empieza con una hoja y sin repasos; la interfaz informa si detecta una prueba local anterior. Solo la preferencia de idioma se escribe ahora en localStorage. Las funciones antiguas se mantienen como compatibilidad probada, no como fuente del progreso actual.

## Antes de publicar

- Despliegue HTTPS con `NODE_ENV=production` y `REED_ORIGIN=https://<dominio>`; el servidor rechaza producción sin esa configuración. TLS puede terminar en un proxy; no se confía en cabeceras reenviadas para inventar un origen.
- `DATABASE_URL` de PostgreSQL, copias del proveedor y prueba de restauración.
- Recuperación de contraseña y política de cuentas. No están implementados correo, verificación, MFA ni eliminación de cuentas.
- Supervisión y límites de tráfico en el proxy: el límite de acceso local no sustituye protección frente a ataques distribuidos.
- La app sigue sirviendo borradores editoriales internos. Autoría pública y votos no forman parte de esta entrega.
- Para acceder desde otro dispositivo hace falta una instancia accesible con el mismo servidor y base. No se ha publicado la app ni abierto el puerto local a la red.

Referencias primarias: [contraseñas, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [sesiones, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF, OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) y [crypto de Node 24](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
