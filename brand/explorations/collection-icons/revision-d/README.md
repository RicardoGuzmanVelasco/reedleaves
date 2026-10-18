# Estantería A · Muescas superiores

- Fuente: `<g id="a-shelf">` de `../index.html`, copiado literalmente en el preview.
- Preview: `shelf-notches.html`. SVG independiente: `shelf-notches.svg`.
- Solo cambian tres intervalos de los bordes superiores: una muesca curva por libro, centrada, de anchura 2 y profundidad 1,3 en el sistema local de cada borde.
- Se conservan canvas 32×32, trazo 1,9, redondeo, posiciones, tamaños, inclinación y todas las demás líneas. La balda sigue siendo `M3 26h24`.
- El primer `rect` se convierte a `path` manteniendo sus cuatro arcos de radio 1,3. El renderizado puede mostrar pequeñas diferencias de antialiasing entre primitivas, aunque la geometría del contorno ajeno al borde superior se conserva. Las uniones redondeadas suavizan las entradas y afectan a su abertura visible.
- No se modifican propuestas previas ni la app. Exploración pendiente de aprobación.
