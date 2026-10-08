# Despliegue interno

Estado: el producto funciona en local con cuentas, SQLite y progreso persistente en servidor. Todavía no hay instancia ni dominio publicados.

## Configuración ya preparada

- Node 24 LTS, fijado en `.node-version`; la app usa `node:sqlite`.
- `npm start` respeta `PORT`. En producción escucha en `0.0.0.0`; en desarrollo conserva `127.0.0.1`.
- La base activa es SQLite v9. Definir `REED_DB_PATH` en un disco persistente. Ejecutar una sola instancia: no compartir SQLite/WAL entre máquinas.
- `NODE_ENV=production` exige `REED_ORIGIN=https://<origen-exacto>`. Se activa la cookie `Secure`.
- `/api/health` sirve como comprobación de salud; verifica una consulta a SQLite.
- El primer arranque en un disco vacío crea esquema y siembra los CSV incluidos. Un esquema previo incompatible detiene el arranque; no se migra solo.

## Recomendación para el piloto

Mantener una sola aplicación Node con almacenamiento persistente, HTTPS y una instancia. Render admite este formato y discos persistentes; un disco excluye el plan gratuito y hace que un despliegue reinicie la instancia. Es adecuado para un piloto pequeño, si se acepta ese coste y una interrupción breve al publicar.

La app no debe abrirse al equipo todavía sin elegir un control de acceso. El registro actual está abierto y el catálogo también se puede leer sin iniciar sesión. Una clave de invitación para registrarse no protege el contenido. Para un piloto interno hay que proteger todas las rutas con la identidad corporativa (por ejemplo, una puerta SSO/VPN delante de la app) o cambiar la app para exigir sesión incluso al explorar. No guardar claves de acceso en el repositorio.

## Pendiente antes de invitar al equipo

1. Elegir proveedor, espacio privado del repositorio y región.
2. Elegir el acceso interno: proteger el sitio entero con acceso corporativo, o hacer privados el catálogo y las páginas dentro de la app.
3. Asignar el dominio y fijar el origen HTTPS.
4. Crear el servicio con un disco persistente, una instancia y `/api/health` como comprobación.
5. Probar en ese servicio alta, inicio y cierre de sesión, reinicio conservando el progreso y restauración de una copia de SQLite.

## Límites para la primera prueba

- No hay recuperación de contraseña, borrado de cuenta ni inicio corporativo.
- No hay migraciones de esquema. Antes de cambiar el modelo después de tener usuarios, preparar una copia y migración comprobable.
- Los cinco libros y seis barajas siguen marcados como borradores internos; no compartir la URL públicamente hasta revisar contenido y fuentes.
- La copia SQLite se puede crear con `npm run db:backup -- <ruta-nueva>`. No copiar el archivo principal mientras WAL esté activo.
- Vigilar errores, almacenamiento del disco y fallos de acceso; documentar quién restaura copias y quién atiende contraseñas bloqueadas.

## Nodo y almacenamiento

El repositorio requiere Node 24.15 o superior dentro de la rama 24. Node 24.15 marcó `node:sqlite` como candidata a estable; el entorno local aún usa 24.11.1, por lo que conviene alinear el entorno local antes de cerrar la validación del despliegue.

En Render, montar el disco debajo de `var/` y definir `REED_DB_PATH` a esa ubicación. Render exige almacenamiento persistente para conservar el archivo tras reinicios; los discos tienen coste y suspenden el despliegue sin interrupción. Revisar los precios antes de crear el servicio.
