# Spike Sprout · 01

Estado: historial de exploración de marca. El nombre oficial actual es **Reedleaves**; logo y mascota aprobados. Mantener «De hoja a hoja» en español. La plataforma sigue pendiente de elección. Las propuestas y decisiones anteriores de este documento se conservan como historial.

Actualización: el usuario elige **Reed**, **Read. Plant a seed.** y la mascota de hoja intermedia. La integración con un libro abierto se prueba en `brand/reed/index.html`. Semilla, brote y bucle quedan como posibles mascotas futuras, fuera de la v1.

## Hipótesis

**Una hoja de libro se convierte en una hoja viva.** Leer aporta una semilla; revisitar una idea la mantiene presente. La identidad puede contar «personal growth» con la misma forma que representa la lectura.

La relación inicial indicada por el usuario es **personal growth / sprout**: parecido sonoro y crecimiento compartido entre personas y plantas. Esa relación guía el juego en inglés. «De hoja a hoja» queda como línea española, expresamente conservada por el usuario.

Sprout es ahora el nombre de esta exploración, no el nombre propuesto para la app. El usuario quiere otro nombre sin cambiar la idea de marca.

La planta representa la atención al contenido. Leer una tarjeta no demuestra que una persona haya mejorado: la app solo puede mostrar actividad de lectura y repaso.

## Qué investigamos

1. Si el símbolo transmite lectura y crecimiento sin explicación.
2. Si añadir dos ojos basta para convertirlo en un compañero reconocible.
3. Si una celebración breve ayuda a cerrar la lectura sin añadir tareas.
4. Si la marca funciona pequeña, en un color, en español y en inglés.

## El juego de palabras

| Relación | Español | Inglés | Uso |
| --- | --- | --- | --- |
| Hoja impresa / vegetal | Hoja | Leaf | Mejor base para el símbolo. |
| Inicio de una idea / planta | Semilla de una idea | Seed of an idea | Relato breve de marca. |
| Desarrollo humano / vegetal | Crecimiento personal | Personal growth | Promesa y tono. |
| Conocimiento / alimento de la planta | Saber / savia | Knowledge / nourishment | Naming evocador, más fuerte en ES. |
| Estructura anidada / planta | Rama | Branch | Regla interna para relacionar tarjetas. |

Español: **De hoja a hoja.** Inglés: explorar parejas sonoras entre lectura, semillas y crecimiento. Adaptar el texto por idioma, conservando el mismo concepto.

Growth / sprout no es una rima exacta. Podemos conservar la conexión de significado y usar una pareja con rima clara en la línea inglesa, como read / seed o grow / glow.

## Tres rutas visuales

### A · Semilla

Un cuerpo ovalado y dos hojas pequeñas. Tiene el mejor potencial de mascota: se inclina, rebota y mira. Se entiende como crecimiento antes que como lectura. Su riesgo es parecer una app de plantas o bienestar genérico.

### B · Hoja / página — recomendación

Dos hojas gruesas se abren como un libro. La base reúne las páginas en un pliegue central. La silueta es la misma con o sin ojos. Es la ruta que conecta mejor el producto y la metáfora.

Riesgo: puede parecer un libro educativo infantil. Mantener proporciones compactas, ojos discretos, títulos claros y texto de lectura sobrio.

### C · Bucle vivo

Dos hojas forman un lazo: una idea vuelve y vuelve. La mascota se estira como un clip flexible. Tiene personalidad y vínculo con el repaso, pero la lectura es menos evidente y el dibujo exige más cuidado a 24 px.

## Naming dentro de esta familia

| Nombre | Ventaja | Coste |
| --- | --- | --- |
| **Seedo** | Seed como raíz; breve y juguetón; sirve como nombre del compañero. | Inventado; necesita descriptor. |
| **Reed** | Suena igual que read en presente y significa junco: lectura + planta. | Puede parecer un apellido; no describe literalmente un brote. |
| **Glo** | Forma corta de glow; permite rimar con grow. | Más luz que planta; depende del símbolo para contar crecimiento. |
| **Bloom** | Crecimiento / florecer; la frase make room to bloom tiene rima. | Palabra común; sugiere floración más que brote. |

Shortlist creativa: **Seedo** para personalidad de mascota; **Reed** para el juego entre lectura y planta. Se pueden probar los cuatro nombres en el prototipo. No se fija ninguno como nombre definitivo. Disponibilidad de marca y dominio pendiente; este spike no hace esa validación.

| Nombre | Línea inglesa propuesta | Juego |
| --- | --- | --- |
| Seedo | Read. Plant a seed. | Read / seed: rima. |
| Reed | Read. Plant a seed. | Read / reed: mismo sonido; read / seed: rima. |
| Glo | A little glow. Room to grow. | Glow / grow: rima. |
| Bloom | Make room to bloom. | Room / bloom: rima con la pronunciación room /ruːm/. |

En todos los casos, la línea española sigue siendo **De hoja a hoja**. La rima es parte del lenguaje de marca; no hace falta repetirla en cada botón.

## Identidad y mascota

- Una misma silueta; nunca dos logos distintos para símbolo y personaje.
- Dos hojas grandes, un pliegue y dos ojos. Boca pequeña solo en tamaño de mascota.
- Sin manos, ropa, maceta ni accesorios en la base.
- A 24 px: versión de un color, sin rostro ni detalles finos.
- A 48 px: símbolo completo; el avatar puede añadir ojos, sin boca.
- Desde 96 px: ojos, mirada, boca y expresiones.
- Los ojos miran hacia la tarjeta o la próxima acción, sin taparlas.

### Paleta propuesta

| Token | Color | Función |
| --- | --- | --- |
| Tinta bosque | `#173D2C` | Texto, cara y límites. |
| Verde hoja | `#58BE59` | Identidad y acción principal. |
| Verde luz | `#B9E877` | Hoja secundaria y reflejos. |
| Crema papel | `#FFF9ED` | Fondo. |
| Melocotón | `#FFE0CB` | Superficie cálida de contraste. |
| Ocre | `#E5AE45` | Acento pequeño, no texto sobre crema. |

La pomposidad viene de volumen, formas, movimiento y respuestas al tacto. Conservar legibilidad y una única acción fuerte por pantalla.

## Motion

| Estado | Disparador | Respuesta | Tiempo |
| --- | --- | --- | --- |
| Símbolo → compañero | Entrar en una lectura / control del spike | Aparecen ojos y pequeña inclinación. | 280 ms |
| Leer | Tarjeta visible | Mira hacia abajo; leve balanceo inicial. | 420 ms |
| Revisada | Acción explícita del usuario | Compresión y salto corto; hojas se abren. | 650 ms |
| Volver | Regreso a la app | Saludo corto con la misma silueta. | 500 ms |
| Esperar | Después del saludo | Se queda quieto. | Sin bucle infinito |

Respetar `prefers-reduced-motion`: expresiones estáticas y cambio de estado inmediato. No usar sonido por defecto. No marchitar al personaje por ausencia.

## UX: aplicar la metáfora sin aumentar casos de uso

| Objeto real | Papel visual | Texto de interfaz |
| --- | --- | --- |
| Libro | Fuente de ideas, representada por una semilla o portada. | Libro / Book |
| Tarjeta | Hoja que contiene una idea. | Idea / Idea |
| Hijos de tarjeta | Hojas relacionadas por un tallo. | Ver detalle / Read more |
| Tarjeta diaria | Hoja que aparece hoy junto al compañero. | Idea del día / Today's idea |
| Acción de repaso | Una pequeña apertura del brote. | Ya la he leído / I've read it |

Mantener los nombres reales en navegación. La metáfora aparece en ilustraciones, transiciones y copy secundario. Una tarjeta sigue siendo texto; la decoración no cambia su contenido.

La v1 conserva dos recorridos: lectura ordenada de un libro y tarjeta diaria. Biblioteca es el acceso al primero. El spike no añade jardín, riego, moneda, inventario, tienda, tareas ni rachas.

El prototipo muestra una tarjeta y un cierre de lectura. El estado solo vive en memoria de la sesión. El contenido es original y de ejemplo; no se atribuye a ningún libro. La plataforma final sigue abierta.

## Formato futuro de contenido

Ejemplo: `brand/sprout/example-cards.ndjson`. Una tarjeta por línea, texto bilingüe y `parentId` opcional. Esto permite anidación sin archivos recursivos; la interfaz deriva el árbol.

- El lector no modifica texto ni relaciones.
- Autores futuros podrían editar texto o importar el mismo formato.
- Separar el contenido del estado de lectura y de la mascota.
- Para la app real: validar IDs únicos, padres existentes, ausencia de ciclos y versiones completas por idioma.
- Antes de elegir la tarjeta diaria: decidir si se sortea entre todos los libros o los seleccionados, y si una tarjeta hija requiere contexto. Esa decisión no afecta al símbolo.

## Plan para decidir

Mostrar las tres siluetas a 24 y 160 px, sin nombre. Pedir qué representan. Después probar la conversión en mascota y la tarjeta diaria.

Criterios propuestos para la próxima revisión:

- Se distingue lectura o crecimiento antes de explicar la metáfora.
- Se reconoce el personaje al quitarle la cara.
- La tarjeta se lee antes de prestar atención a la animación.
- En móvil, texto y acción siguen cómodos y el contenido no desborda.
- El cambio ES/EN no cambia el significado del estado.

Si la ruta B parece solo un libro, hacer las hojas más orgánicas. Si parece solo una planta, marcar mejor la unión central. No sumar más objetos.

## Referencias revisadas

- [Diseño de Duolingo](https://blog.duolingo.com/hub/design/): referencia de expresividad y personalidad de producto. Las antiguas URLs de la guía de marca redirigen actualmente a este hub.
- [Forest](https://www.forestapp.cc/): referencia de crecimiento vegetal como respuesta visible a una acción. La conexión hoja / página y el compañero propuestos aquí son una interpretación para este producto.
- [Reed](https://dictionary.cambridge.org/dictionary/english/reed), [read](https://dictionary.cambridge.org/dictionary/english/read), [grow](https://dictionary.cambridge.org/us/dictionary/english/grow), [glow](https://dictionary.cambridge.org/us/pronunciation/english/glow) y [bloom](https://dictionary.cambridge.org/pronunciation/english/bloom), Cambridge: significado y pronunciación usados en la exploración sonora.

## Resultado del spike

Tres SVG editables, comparador con tamaños y monocromo, transformación a mascota, cuatro expresiones y una tarjeta diaria ES/EN. La elección definitiva depende de revisión del usuario.

La revisión posterior conserva la dirección visual y «De hoja a hoja», y añade cuatro nombres con selección de vista previa. Verificados en navegador: cambio de símbolo, conversión a mascota, cierre de lectura, nombres por click y teclado, y traducción ES/EN conservando el estado de la tarjeta. Revisada la composición en móvil y escritorio; sin imágenes rotas ni desbordamiento horizontal en las vistas comprobadas.

El prototipo no demuestra recuerdo ni cambio de hábitos. La siguiente decisión pendiente es el nombre.
