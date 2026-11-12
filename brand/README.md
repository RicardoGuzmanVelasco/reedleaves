# Marca y arte de Reedleaves

## Identidad vigente

- **Nombre:** Reedleaves (elegido el 6 de octubre de 2026). Misma escritura en todos los idiomas. No se ha comprobado disponibilidad legal, de dominio ni de tiendas.
- **Lema EN:** «Read. Plant a seed.» · **Línea ES:** «De hoja a hoja».
- **Logo y mascota:** Brote con expresión alegre, sin libro.
- **Icono de app:** `reed/app-icon.svg` sobre crema `#FFF9ED`; PNG `apple-touch-icon.png` (180 px), `app-icon-192-v4.png`, `app-icon-512-v4.png` y `favicon.ico`.

## Estructura

| Carpeta | Contenido | Producción |
| --- | --- | --- |
| `icons/`, `platforms/` | Iconos de interfaz y de plataformas | Sí |
| `reed/` | Iconos de app, fichas, tokens, reverso de tarjeta, tarjeta de compartir | Sí |
| `reed/growth/bodies/` | Cuerpos activos de la mascota (sin cara ni sombra) | Sí |
| `reed/growth/` (sueltos) | `mystery.svg`, `plant.svg`, `infinity.svg` | Sí |
| `tools/mascot-editor/` | Editor de calibración de mascotas. Sustituye a los antiguos estudios de composición, cara, boca y sueño | No |
| `tools/covers/` | Comparador de portadas de libro (lo usa la skill `reedleaves-covers`) | No |
| `archive/mascots/` | Variantes de mascota guardadas para el futuro (ver su README) | No |

Las rutas `/brand/...` las sirve el servidor; lo que no sea producción vive en `tools/` o `archive/`. Un estudio o una exploración nueva se borra al cerrarse; solo se conserva lo aprobado o lo que se quiera reutilizar, y entonces va a `archive/` o se convierte en herramienta.

## Regenerar iconos

`node scripts/build-app-icons.mjs` compone el icono desde `reed/growth/bodies/sprout.svg`, genera los PNG RGB y el favicon. Después, `node scripts/embed-app-icon.mjs` actualiza el PNG incrustado en `app/index.html`. El manifiesto usa nombres versionados para forzar la descarga. `node scripts/build-share-card.mjs` regenera `reed/share-card.svg`.

El servidor sirve los alias `apple-touch-icon*.png` desde `apple-touch-icon.png`; `server/http.test.mjs` comprueba tamaños, formato y el recurso incrustado.

## Mascota

Etapas activas (días distintos de práctica por libro, en `app/mascot-progress.mjs`): Maceta → Tierra → Semilla → Raíz → Germen → Brote → Tallo → Capullo → Flor → Siempreverde. El componente es `app/mascot-art.mjs`; las posiciones de cuerpo, cara, boca y sombra se calibran en `tools/mascot-editor/`.
