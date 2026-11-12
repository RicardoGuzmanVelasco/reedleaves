# Diseño: herramientas y material guardado

`brand/` no contiene nada de producción. Lo que usa la app (mascota, iconos, logos de plataformas, iconos de app, tokens, tarjeta de compartir) vive en `app/assets/`; ver su estructura abajo. Aquí va lo que aún no se usa o solo sirve para diseñar.

| Carpeta | Contenido |
| --- | --- |
| `tools/mascot-editor/` | Editor de calibración de mascotas (cuerpo, cara, boca, sombra). Sustituye a los antiguos estudios de composición, cara, boca y sueño |
| `tools/covers/` | Comparador de portadas de libro (lo usa la skill `reedleaves-covers`) |
| `archive/mascots/` | Variantes de mascota guardadas para el futuro (ver su README) |

Las herramientas se abren con `SERVE_BRAND=1 npm start` en `/brand/tools/...`. En producción `/brand/` no se sirve. Una exploración o estudio nuevo se borra al cerrarse; solo se conserva lo aprobado o reutilizable, en `archive/` o como herramienta.

## Producción: `app/assets/`

| Carpeta | Contenido |
| --- | --- |
| `mascot/` | Cuerpos activos (sin cara ni sombra) y `mystery.svg` y `plant.svg` |
| `icons/` | Iconos de interfaz |
| `platforms/` | Logos de Amazon y Goodreads |
| `brand/` | Icono de app, favicon, tokens, reverso de tarjeta, tarjeta de compartir |

Se sirven como `/app/assets/...` y `scripts/image-manifest.mjs` les añade versión por contenido.

## Identidad vigente

- **Nombre:** Reedleaves (elegido el 6 de octubre de 2026). Misma escritura en todos los idiomas. No se ha comprobado disponibilidad legal, de dominio ni de tiendas.
- **Lema EN:** «Read. Plant a seed.» · **Línea ES:** «De hoja a hoja».
- **Logo y mascota:** Brote con expresión alegre, sin libro.
- **Icono de app:** `app-icon.svg` sobre crema `#FFF9ED`; PNG `apple-touch-icon.png` (180 px), `app-icon-192-v4.png`, `app-icon-512-v4.png` y `favicon.ico`.

## Regenerar iconos

`node scripts/build-app-icons.mjs` compone el icono desde `app/assets/mascot/sprout.svg`, genera los PNG RGB y el favicon. Después, `node scripts/embed-app-icon.mjs` actualiza el PNG incrustado en `app/index.html`. El manifiesto usa nombres versionados para forzar la descarga. `node scripts/build-share-card.mjs` regenera `share-card.svg`.

El servidor sirve los alias `apple-touch-icon*.png` desde `apple-touch-icon.png`; `server/http.test.mjs` comprueba tamaños, formato y el recurso incrustado.

## Mascota

Etapas activas (días distintos de práctica por libro, en `app/mascot-progress.mjs`): Maceta → Tierra → Semilla → Raíz → Germen → Brote → Tallo → Capullo → Flor → Siempreverde. El componente es `app/mascot-art.mjs`; las posiciones de cuerpo, cara, boca y sombra se calibran en `tools/mascot-editor/`.
