# Tipografías de citas

## EB Garamond: alternativa

- EB Garamond regular, peso 400, subconjunto latino para español e inglés.
- Archivo sin modificar de `@fontsource/eb-garamond@5.3.0`, obtenido del registro npm: `files/eb-garamond-latin-400-normal.woff2`.
- Proyecto: https://github.com/octaviopardo/EBGaramond12. Distribución: https://fontsource.org/fonts/eb-garamond.
- Licencia SIL Open Font License 1.1 incluida en `EB-Garamond-OFL.txt`.
- Se sirve desde la app y solo se solicita cuando se usa en una cita. `font-display: swap` mantiene el texto visible con una serif alternativa mientras carga.
- El nombre versionado permite caché HTTP prolongada. Al sustituir el archivo, cambiar también su versión en el nombre y en `reader.css`.

## Cormorant Garamond Light: activa

- Peso 300, subconjunto latino. Archivo sin modificar de `@fontsource/cormorant-garamond@5.3.0`: `files/cormorant-garamond-latin-300-normal.woff2`, obtenido del registro npm.
- Proyecto: https://github.com/CatharsisFonts/Cormorant. Licencia SIL Open Font License 1.1 incluida en `Cormorant-Garamond-OFL.txt`.
- Se sirve desde la app con `font-display: swap`. La paleta de citas usa esta fuente y `--card-body-weight:300`, manteniendo EB Garamond como alternativa. Aprobada por el usuario para producción el 13 de octubre de 2026.
