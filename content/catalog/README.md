# Edición del catálogo

La app consulta SQLite, no estos archivos. Los CSV son el formato plano de autoría/importación para los desarrolladores; no hay editor de usuarios todavía.

| Archivo | Una fila representa |
| --- | --- |
| `users.csv` | Usuario creador; actualmente el equipo editorial real, sin sesiones ni lectores inventados |
| `genres.csv` | Un interés con nombre ES/EN |
| `books.csv` | Un libro con metadatos ES/EN y géneros separados por `|` |
| `links.csv` | Enlace externo de un libro: plataforma (`amazon` o `goodreads`) y URL HTTPS de su ficha |
| `decks.csv` | Baraja, creador, libro, idioma principal y versión; enfoque y nota editorial |
| `cards.csv` | Tarjeta con versión, padre opcional, orden entre hermanas, texto y fuente HTTPS |

`decks.csv` declara una etiqueta de idioma BCP 47 en `language`, por ejemplo `fr`, `pt-BR` o `zh-Hant`. Esa columna fija el idioma original de la baraja. Las columnas traducidas usan sufijos de idioma, por ejemplo `title_fr` y `body_fr`. Añade una columna y rellénala solo si quieres ofrecer esa traducción; cada tarjeta siempre debe tener título y texto en el idioma principal.

Comas, saltos de línea y comillas dentro de un campo siguen CSV estándar: rodear el campo con comillas y duplicar las interiores. No incluir citas largas ni transcribir capítulos. Mantener IDs y orden estables. Cada tarjeta tiene `version_id` y `parent_id`; el orden es entre hermanas. Para cambios de contenido publicado, crear otra versión con nuevos IDs.

Editar → `npm run db:seed` → `npm run db:check` → `npm test`. La importación es transaccional y repetible; rechaza datos incompletos, referencias ausentes y cambios de posición de tarjetas existentes. Los libros y tarjetas no se borran por omitirlos del CSV.

## Primera tanda

| Libro | Intereses | Tarjetas | Referencia principal |
| --- | --- | ---: | --- |
| Los 7 hábitos · Stephen R. Covey | Crecimiento personal, productividad | 7 | [FranklinCovey](https://www.franklincovey.com/courses/the-7-habits/) |
| Padre rico, padre pobre · Robert T. Kiyosaki | Finanzas | 6 | [Rich Dad](https://richdad.com/products/books/rich-dad-poor-dad/) |
| Getting Things Done · David Allen | Productividad | 7 | [David Allen Company](https://gettingthingsdone.com/what-is-gtd/) |
| Atomic Habits · James Clear | Crecimiento personal, productividad | 8 | [James Clear](https://jamesclear.com/atomic-habits-summary) |
| Same as Ever · Morgan Housel | Crecimiento personal, finanzas | 7 | [Morgan Housel](https://collabfund.com/blog/my-new-book-same-as-ever/) |

42 tarjetas en seis barajas. Los ejemplos alternan inglés y español: cada baraja tiene un solo idioma principal. Los cinco libros y los intereses requieren metadatos en español e inglés. La interfaz está disponible en esos dos idiomas; cambiarla no traduce ni cambia el idioma original de las barajas. El formato admite otros idiomas y traducciones opcionales. La original de Los 7 hábitos sigue siendo plana; «De dentro hacia fuera» agrupa esos hábitos en tres bloques con dos niveles. Cada tarjeta conserva su fuente concreta en `cards.csv` y en su fila SQL. Son selecciones breves, no reproducciones de todos los capítulos. Estado editorial `draft`: revisar antes de publicación pública.

## Títulos localizados

`books.csv` incluye `original_title` y `original_language`, obligatorios e importados como columnas propias de `books`. La etiqueta de idioma debe ser BCP 47 canónica. Los cinco libros actuales fueron escritos en inglés; futuros libros pueden tener otro idioma original. La ficha muestra ese título siempre, incluso si coincide con el título localizado. No deducirlo de `title_en`.

La búsqueda del catálogo cruza el título original y todos los títulos completos y cortos disponibles, sin depender del idioma de pantalla. Ignora mayúsculas, tildes y puntuación; no añade traducciones ni cambia el contenido del libro.

Cada idioma guarda `title` y `short_title` por separado en `book_translations`. `short_title` es una decisión editorial para las portadas pequeñas, no un recorte automático. `title` es el título completo del libro (sin añadir obligatoriamente subtítulos comerciales) y se usa en la ficha y en su etiqueta accesible. No cambiar IDs al traducir títulos. Las descripciones y notas francesas son traducciones de nuestros textos propios.

## Comprar y reseñar

Cada libro tiene dos enlaces editoriales en `links.csv`, importados a `book_links`: Amazon para comprar y Goodreads para escribir una reseña en la ficha del libro. No son fuentes del resumen ni enlaces de una baraja. No añadimos afiliación, votos ni reseñas automáticamente.

Los enlaces actuales de Amazon apuntan a ediciones en español de Amazon.es, independientemente del idioma de interfaz. La ficha lo indica. Goodreads enlaza la obra; el usuario puede iniciar sesión y escribir su reseña allí. Los dos enlaces se abren fuera del repaso, con iconos locales, flecha externa y aviso accesible de nueva pestaña.

Ediciones elegidas por ISBN y referencias de compra:

- Los 7 hábitos: ISBN 9788449331152, [Paidós / Planeta](https://www.planetadelibros.com/libro-los-7-habitos-de-la-gente-altamente-efectiva-ed-revisada-y-actualizada/195751?soporte=195751).
- Padre rico, padre pobre: ISBN 9788466373005, [Penguin Libros](https://www.penguinlibros.com/es/6291-robert-t-kiyosaki).
- Organízate con eficacia: ISBN 9788416997862, [ficha de edición](https://www.lacapona.coop/es/economiaempresa/29516-organizate-con-eficacia.html).
- Hábitos atómicos: ISBN 9788418118036, [Diana / Planeta](https://www.planetadelibros.com/libro-habitos-atomicos/310441?soporte=310441).
- Lo que nunca cambia: ISBN 9788408283430, [Planeta](https://www.planetadelibros.com/libro-lo-que-nunca-cambia/390034).

Los destinos se seleccionaron el 6 de octubre de 2026. No prometemos stock ni precios; Amazon y Goodreads pueden pedir sesión o comprobación humana. Validamos dominio, HTTPS y ruta de ficha tanto al importar como al recibir la API. Se rechazan duplicados, destinos de otra plataforma, redirecciones y parámetros de afiliación.

Referencias de los títulos, comprobadas el 6 de octubre de 2026:

- Los 7 hábitos, francés: [FranklinCovey France](https://www.franklincovey.fr/livres/7-habitudes/).
- Padre rico, padre pobre, francés: [Bibliothèque nationale de France](https://catalogue.bnf.fr/ark%3A/12148/cb454526408).
- Getting Things Done, francés: [Éditions Leduc / Alisio](https://www.editionsleduc.com/produit/2527/9782379350306/).
- Atomic Habits, francés: [Éditions Larousse](https://www.editions-larousse.fr/livre/un-rien-peut-tout-changer-9782035969200/).
- Same as Ever, francés: [Valor Éditions](https://www.valor-editions.fr/produit/128/9782361170813/); español: [Editorial Planeta](https://www.planetadelibros.com/libro-lo-que-nunca-cambia/390034).

Padre rico distingue explícitamente la mirada de Kiyosaki sobre flujo de caja de la definición contable de activo. Same as Ever se contrasta con textos del autor y un extracto oficial del libro. No se ofrecen instrucciones de inversión, deuda o fiscalidad.

## Siguiente tanda propuesta, aún no añadida

1. [The Psychology of Money · Morgan Housel](https://harriman.house/books/the-psychology-of-money/) — finanzas; conducta y decisiones sobre dinero.
2. [Deep Work · Cal Newport](https://calnewport.com/deep-work-rules-for-focused-success-in-a-distracted-world/) — productividad; concentración.
3. [Essentialism · Greg McKeown](https://gregmckeown.com/books/essentialism/) — productividad; elegir prioridades y descartar lo demás.
4. [Four Thousand Weeks · Oliver Burkeman](https://www.oliverburkeman.com/fourthousandweeks) — productividad y crecimiento personal; aceptar límites.
5. [Mindset · Carol S. Dweck](https://www.penguinrandomhouse.com/books/44330/mindset-by-carol-s-dweck-phd/9781400062751/) — crecimiento personal; cómo entendemos el aprendizaje.
6. [How to Win Friends and Influence People · Dale Carnegie](https://www.simonandschuster.com/books/How-to-Win-Friends-and-Influence-People/Dale-Carnegie/Dale-Carnegie-Books/9780671027032) — relaciones; ampliaría la variedad de intereses.

Propongo llegar a once libros con esta segunda tanda. Primero validar el recorrido con los cinco actuales; no introducir filtros o pantallas nuevos solo por aumentar el catálogo.
