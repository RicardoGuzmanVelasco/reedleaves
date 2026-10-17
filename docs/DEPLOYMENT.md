# Despliegue interno — preparación histórica

> Este documento conserva la preparación del piloto y no describe el despliegue actual. La app ya está en producción; consultar `docs/development/README.md` y la entrada más reciente. Borrador describe creación abierta, no contenido privado: las barajas y tarjetas se comparten al guardarlas (ADR 0002).

Estado: el repo está conectado a GitHub `main` y a un Blueprint de Render; el usuario confirmó que Auto-Deploy está en `On Commit`. Supabase PostgreSQL es la base elegida para producción. La URL pública y el estado del último despliegue aún no se han verificado desde el repo.

## Configuración ya preparada

- Node 24 LTS, fijado en `.node-version`; la app usa `node:sqlite`.
- `npm start` respeta `PORT`. En producción escucha en `0.0.0.0`; en desarrollo conserva `127.0.0.1`.
- Local y pruebas usan SQLite. Producción exige `DATABASE_URL` y usa PostgreSQL; si falta, el servidor se detiene para evitar guardar progreso en almacenamiento efímero.
- PostgreSQL inicializa el mismo catálogo y persiste cuentas, sesiones, barajas elegidas, progreso, preferencias e idea diaria. El esquema inicial es versión 1; no hay migraciones automáticas.
- `NODE_ENV=production` exige `REED_ORIGIN=https://<origen-exacto>` y `REED_INVITE_CODE` con al menos 12 caracteres. Se activa la cookie `Secure`.
- `/api/health` sirve como comprobación de salud y verifica una consulta a la base activa.
- El primer arranque en una base vacía crea el esquema y siembra los CSV incluidos. Un esquema previo incompatible detiene el arranque; no se migra solo.

## Arquitectura prevista para el piloto

Mantener una aplicación Node, PostgreSQL gestionado, HTTPS y una instancia. La base ya no depende del disco de la aplicación: reinicios y despliegues no deben borrar el progreso. Render está configurado en Frankfurt y el proyecto Supabase usa la región `eu-central-1`.

En modo interno, el catálogo exige una cuenta y el alta exige una clave de invitación. Configurar `REED_INVITE_CODE` con una clave aleatoria de al menos 12 caracteres. El servidor solo acepta el alta si coincide; no se guarda en la base ni en el repositorio. La URL seguirá siendo pública, pero el contenido requiere cuenta y la clave limita quién puede crearla. No compartirla fuera del equipo.

## Pendiente antes de invitar al equipo

1. Elegir proveedor, espacio privado del repositorio y región.
2. Crear una clave aleatoria de invitación de 12 caracteres o más y guardarla como secreto `REED_INVITE_CODE` en el hosting.
3. Usar la URL HTTPS que da el hosting y copiarla exactamente a `REED_ORIGIN`. Un dominio propio es opcional.
4. Crear la base PostgreSQL y añadir su URL privada como secreto `DATABASE_URL` en el servicio Node.
5. Configurar `/api/health` como comprobación. Probar alta, sesiones, progreso tras reinicio, backups y restauración desde el proveedor.

## Límites para la primera prueba

- No hay recuperación de contraseña, borrado de cuenta ni inicio corporativo.
- No hay migraciones de esquema. Antes de cambiar el modelo después de tener usuarios, preparar una copia y migración comprobable.
- Los cinco libros y seis barajas siguen marcados como borradores internos; no compartir la URL públicamente hasta revisar contenido y fuentes.
- `npm run db:backup -- <ruta-nueva>` solo sirve para SQLite local. En producción usar el backup y la restauración del proveedor PostgreSQL.
- Vigilar errores, almacenamiento del disco y fallos de acceso; documentar quién restaura copias y quién atiende contraseñas bloqueadas.

## Nodo y almacenamiento

El repositorio requiere Node 24.15 o superior dentro de la rama 24. Node 24.15 marcó `node:sqlite` como candidata a estable; el entorno local aún usa 24.11.1, por lo que conviene alinear el entorno local antes de cerrar la validación del despliegue.

La base de producción debe aceptar conexiones TLS si así lo exige el proveedor; guardar su URL completa en `DATABASE_URL` y no en Git. El catálogo se crea al primer arranque vacío. La URL de conexión y credenciales son secretos: no pegarlos en el chat ni incluirlos en `.env.example`.
