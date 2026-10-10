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

## Dominio propio: reedleaves.com

Servicio confirmado en el espacio **RGV**: `reedleaves`, con URL `https://reedleaves-0vgb.onrender.com`.

El dominio principal es **https://reedleaves.com**; `www.reedleaves.com` redirige al principal. El dominio está comprado en Cloudflare, ambos nombres están verificados en Render y HTTPS funciona. `REED_ORIGIN=https://reedleaves.com` está configurado y desplegado.

Estos registros están configurados en Cloudflare, en **DNS > Records**, con proxy **DNS only** y TTL automático:

| Tipo | Nombre | Destino |
| --- | --- | --- |
| CNAME | `@` | `reedleaves-0vgb.onrender.com` |
| CNAME | `www` | `reedleaves-0vgb.onrender.com` |

Para repetir o revisar la configuración:

1. Pulsar **Verify** en los dominios del servicio de Render y esperar a que los certificados estén emitidos.
2. Definir `REED_ORIGIN=https://reedleaves.com` en **Environment** y desplegar el cambio. No cambiar el origen antes de que el dominio esté operativo: las operaciones POST solo aceptan el origen configurado.
3. Verificar `https://reedleaves.com/api/health`, la carga de la app, el inicio de sesión y el guardado. Comprobar la redirección de `www`.

Verificación del 11 de octubre de 2026: `/api/health` y `/api/session` responden HTTP 200; `www` devuelve HTTP 301 al dominio principal; la app abre su pantalla de entrada. El inicio de sesión con una cuenta y el guardado no se han probado en esta comprobación. La URL de Render permanece habilitada, pero las operaciones POST solo aceptan el dominio principal configurado en `REED_ORIGIN`.

Referencia: [DNS de Cloudflare en Render](https://render.com/docs/configure-cloudflare-dns).

## Límites del plan gratuito

Render puede detener el servicio tras 15 minutos sin tráfico; la primera visita posterior puede tardar alrededor de un minuto. El sistema de archivos es temporal, así que la base local SQLite no se debe usar en producción. Reedleaves usa PostgreSQL cuando recibe `DATABASE_URL`.

El plan gratuito sirve para validar el despliegue, pero Render no lo recomienda para producción. Comprueba sus límites actuales antes de abrir el servicio a usuarios.
