# Despliegue de Reedleaves en Render

## Configuración incluida

El Blueprint `render.yaml` crea un servicio web Node gratuito. Instala con `npm ci`, arranca con `npm start` y verifica `/api/health`.

Render configura `NODE_ENV=production` y proporciona `PORT` y `RENDER_EXTERNAL_URL`. La app usa la URL de Render al principio para validar el origen y activar cookies seguras. Cuando se conecte el dominio propio, define `REED_ORIGIN` en el servicio con la URL final, por ejemplo `https://reedleaves.com`.

`DATABASE_URL` se introduce como secreto en Render; no debe guardarse en Git. `REED_INVITE_CODE` lo genera Render. Compártelo solo con las personas autorizadas para crear cuentas.

Para activar «Autorellenar con IA», configura `OPENAI_API_KEY` como secreto del servicio. `OPENAI_BOOK_MODEL` es opcional; por defecto se usa `gpt-5.4-mini`. La clave nunca se envía al navegador. Sin clave, el guardado manual sigue disponible y el botón explica que el autorellenado no está disponible.

En local, copia `.env.example` a `.env`, introduce la clave y arranca con `node --env-file=.env server/index.mjs`. `npm start` utiliza las variables ya exportadas en el entorno; no carga `.env` automáticamente.

Cada pulsación realiza una búsqueda web mediante Responses API y una extracción estructurada de los datos encontrados. La búsqueda admite hasta tres llamadas a herramientas y el proceso tiene un límite de 90 segundos, sin reintentos automáticos. Se permiten cinco búsquedas por cuenta cada 15 minutos y una simultánea. Este límite reside en memoria y se reinicia con el proceso; si se añaden varias instancias habrá que compartirlo. El uso de modelo y búsqueda consume el presupuesto de la API.

La búsqueda devuelve una vista previa; no escribe en la base. Al crear el libro se guardan juntos sus traducciones, intereses, enlaces y fuentes. El libro pasa directamente al catálogo común, conservando su creador. Las barajas y tarjetas también se comparten al guardarlas; solo el creador puede editarlas mientras sean borradores. La decisión sobre libros está en el [ADR 0001](../adr/0001-libros-en-catalogo-comun.md) y la de barajas en el [ADR 0002](../adr/0002-barajas-en-catalogo-comun.md). Las traducciones de títulos sin edición verificada se identifican en la nota sobre la edición. Se dejan vacíos los datos que no se pueden respaldar.

La propuesta usa un título principal por idioma, sin subtítulos ni títulos extranjeros añadidos al encabezado de la fuente. La extracción separa esas adiciones para limpiar solo las identificadas, respetando signos que forman parte del título. El título corto generado tiene como máximo 32 caracteres y no guarda puntos suspensivos; las portadas añaden «…» cuando es más breve que el nombre completo. El formato de los metadatos y el guardado no cambian.

Las pruebas automatizadas y visuales usan respuestas simuladas, sin coste de OpenAI. Solo se realizan búsquedas reales de prueba si el usuario las pide expresamente.

Los fallos de IA distinguen falta de saldo (`insufficient_quota`), configuración o acceso (HTTP 400/401/403/404), saturación y errores del proveedor (429/5xx), y tiempo agotado. Una referencia visible permite localizar el evento `book_autofill_failed` en los logs de Render. El registro incluye fase (`research`, `extraction` o `metadata`), modelo, estado HTTP, código/tipo/parámetro del proveedor, `x-request-id` y motivo de respuesta incompleta cuando existen. No registra claves, usuarios, títulos, mensajes del proveedor ni respuestas generadas. El navegador recibe únicamente el error funcional y la referencia. Los campos permanecen para corregirlos o reintentar.

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
