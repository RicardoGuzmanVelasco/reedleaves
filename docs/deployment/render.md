# Despliegue de Reedleaves en Render

## Configuración incluida

El Blueprint `render.yaml` crea un servicio web Node gratuito. Instala con `npm ci`, arranca con `npm start` y verifica `/api/health`.

Render configura `NODE_ENV=production` y proporciona `PORT` y `RENDER_EXTERNAL_URL`. La app usa la URL de Render al principio para validar el origen y activar cookies seguras. Cuando se conecte el dominio propio, define `REED_ORIGIN` en el servicio con la URL final, por ejemplo `https://reedleaves.com`.

`DATABASE_URL` se introduce como secreto en Render; no debe guardarse en Git. `REED_INVITE_CODE` lo genera Render. Compártelo solo con las personas autorizadas para crear cuentas.

## Crear el servicio

1. Publica el repositorio en GitHub o en otro proveedor compatible y conecta ese repositorio a Render.
2. En Render, crea un **Blueprint** y selecciona este repositorio. Render detecta `render.yaml`.
3. Cuando lo solicite, pega la cadena de conexión PostgreSQL de Supabase en `DATABASE_URL`. Usa el endpoint recomendado por Supabase para conexiones desde servidores externos.
4. Crea el Blueprint y espera a que termine el primer despliegue.
5. Comprueba `/api/health` y abre la URL `onrender.com` del servicio.

La primera ejecución crea el esquema e importa el catálogo inicial si la base está vacía. No apuntes una base con datos existentes sin revisar antes ese comportamiento.

## Límites del plan gratuito

Render puede detener el servicio tras 15 minutos sin tráfico; la primera visita posterior puede tardar alrededor de un minuto. El sistema de archivos es temporal, así que la base local SQLite no se debe usar en producción. Reedleaves usa PostgreSQL cuando recibe `DATABASE_URL`.

El plan gratuito sirve para validar el despliegue, pero Render no lo recomienda para producción. Comprueba sus límites actuales antes de abrir el servicio a usuarios.
