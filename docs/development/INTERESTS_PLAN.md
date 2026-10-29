# Intereses, descubrimiento y novedades — plan de desarrollo

Estado: ejecución autorizada por el usuario, precedida por revisión independiente Astra. Incluye implementación por incrementos, publicación mediante PR y seguimiento hasta producción comprobada. Las correcciones técnicas del plan se resuelven entre agentes; consultar al usuario solo ante una decisión de producto crucial.

## Objetivo y reglas de trabajo

Guardar, en orden, los intereses que le interesan a cada usuario y los intereses que no le interesan. Aplicarlos a exploración y recomendaciones, con algoritmos fáciles de sustituir. Publicar incrementos pequeños, funcionales y comprobados.

- Implementación y revisión de cada incremento: **Luna, razonamiento Alto**. **Astra** revisa previamente el plan. Se permiten agentes **Sol** para diseño/UI/UX cuando haga falta. El coordinador conserva contexto y asigna tareas acotadas; no sustituye las revisiones independientes.
- La calidad visual debe resultar muy efectista, al nivel de la pantalla de Repasar, respetando las guidelines. Para cada superficie nueva, comparar capturas móvil/escritorio con Repasar y comprobar animación, tacto, jerarquía, foco y movimiento reducido antes de publicarla. Un build correcto no sustituye esta revisión visual.
- Seguir `AGENTS.md`, `docs/frontend/DESIGN.md` y las skills aplicables. Mantener simplicidad funcional, pomposidad estética y pocos casos de uso.
- Briefs operativos complementarios: [interfaz](../frontend/INTERESTS_UI.md) y [recuperación de sesiones](PRACTICE_RECOVERY_IMPLEMENTATION.md). Concretan componentes/contratos sin sustituir este plan ni acreditar QA aún no realizada.
- El objeto de dominio se llama **interés**. No introducir otros nombres de producto. En las pantallas de selección se usa el verbo: «Marca cuáles te interesan especialmente» y «Marca cuáles no te interesan en absoluto». Excepciones aprobadas: sección pública «Intereses», avisos «¡Nuevo interés!» / «¡Nuevos intereses!» y orden «Mis intereses».
- ES/EN en toda la interfaz. Idioma del título del libro, idioma de sus tarjetas e idioma de interfaz son datos independientes.
- No probar con OpenAI real. Los proveedores de IA se simulan.
- Usar ramas `codex/…` del worktree y destino `main`. Publicación y seguimiento autorizados para ejecutar este plan; sin push directo a `main`, integración manual ni `--admin`.
- No empezar todos los incrementos a la vez. Integrar y comprobar uno antes de publicar el siguiente que dependa de él. El trabajo paralelo se limita a archivos y contratos independientes.

## Hechos comprobados

- Node del proyecto: el indicado en `.node-version` (actualmente 24.21.0).
- La auditoría inicial consultó 25 libros y 7 intereses, sin libros con cero o más de tres intereses; la comprobación HTTP previa a ejecución ya devuelve 26 libros, 7 intereses, 47 barajas y 377 tarjetas en un catálogo válido. Son snapshots, no cantidades fijas. El seed local no representa todo el catálogo real.
- Intereses reales: `personal-growth`, `finance`, `productivity`, `society`, `software`, `mindfulness`, `metaphysics`.
- `book_genres` no guarda posición. La lectura del catálogo y el normalizador ordenan por ID; eso no expresa importancia editorial.
- No existe preferencia personal vigente de intereses ni de idiomas de tarjetas. Las tablas históricas de intereses del lector fueron eliminadas; no confundirlas con el esquema actual.
- `books` no guarda fecha fiable de incorporación. Su `position` permite conservar el orden previo, pero `updated_at` no debe presentarse como fecha de alta.
- Las hojas ya admiten saldo superior a 10 y lo conservan. Diez es límite de recarga. Los pétalos todavía recortan al límite de recarga; hay que corregirlo.
- El sorteo actual trabaja por grupos de respuestas y favorece grupos pequeños de forma excesiva. Los rótulos actuales de frecuencia están cruzados con el efecto de sus valores persistidos. Las respuestas sustituyen la última respuesta; no se acumulan.
- La Idea del día es global. Su asignación no depende de preferencias, idiomas elegidos ni otros datos seleccionados por el usuario. Solo su estado de vista es personal.
- Hay vista vertical de guías en `#guide-preview/:bookId`. Una colección de guías puede contener aportaciones de varias personas.
- Producción: Supabase, proyecto `werxfzdrtzbqhvvnfbek`; Render, workspace RGV `tea-db59i2nlk1mc73978ao0`, servicio `srv-db59j98473hc73ac2u5g`. Revalidar identidad y configuración antes de operar. No usar una base PostgreSQL de Render.

Rutas principales a contrastar al ejecutar: `app/interests.mjs`, `app/book-metadata.mjs`, `app/book-list.mjs`, `app/core.mjs`, `app/views.mjs`, `app/reader-app.mjs`, `app/reader.css`, `app/practice-progress.mjs`, `app/wallet.mjs`, `server/catalog-repository.mjs`, `server/author-repository.mjs`, `server/reader-repository.mjs`, `server/profile-repository.mjs`, `server/practice-economy.mjs`, `server/reading-guides.mjs`, ambos esquemas y sus migraciones.

## Especificación acordada

### Apariencia de los intereses

| ID | Nombre ES | Emoji |
| --- | --- | --- |
| personal-growth | Crecimiento personal | 🌱 |
| finance | Finanzas | 💰 |
| productivity | Productividad | 🎯 |
| society | Sociedad | 🌍 |
| software | Software | 💻 |
| mindfulness | Mindfulness | 🧘 |
| metaphysics | Metafísica | 🔮 |

- Sustituir los SVG actuales de intereses por estos emojis. Mantener el nombre localizado y accesible.
- Incorporar emoji y color tenue al contrato del catálogo y a sus fuentes editoriales, no mantener una segunda lista de intereses solo en el cliente. Dar valores a los siete IDs existentes, incluido Metafísica aunque no esté en el seed local. Crear un interés futuro exige nombre ES/EN, emoji y color antes de publicarlo. No se añade una pantalla administrativa de intereses.
- Chips con un degradado radial tenue entre blanco y un color asociado al interés. Reutilizar familias de la paleta del proyecto y definir los colores una sola vez. No añadir sombras o bordes contrarios al contrato actual de chips.
- El color no comunica por sí solo estado. Lo que le interesa lleva tick verde estilizado; lo que no le interesa, aspas rojas estilizadas.
- Los selectores nativos conservan controles semánticos y texto legible; no simular un chip dentro de cada opción nativa.

### Intereses de cada libro y creación manual

- Todo libro nuevo necesita entre uno y tres intereses distintos y existentes.
- El orden importa: primero principal, después segundo y tercero.
- Las casillas mantienen su lugar en la pantalla. Al marcar aparecen 1, 2 y 3 según el orden de selección. No hay controles subir/bajar, arrastre ni recolocación visual automática.
- Quitar uno conserva el orden relativo de los restantes y renumera. Volver a marcarlo lo añade al final.
- Explicar: «Elige la principal. Añade hasta dos más solo si describen una parte importante del libro». Traducir a EN.
- El formulario permite introducir todos sus campos manualmente desde el principio. No exigir una búsqueda ni el autorrelleno para mostrar los campos editables.
- Las validaciones del servidor se aplican igual a creación manual, autorrelleno, importación y cualquier escritura equivalente. No ordenar alfabéticamente al normalizar ni deduplicar alterando el orden.
- El autorrelleno del usuario propone una lista ordenada de hasta tres intereses; la persona puede corregirla antes de guardar. No utiliza un circuito de agentes revisores.
- La revisión por dos agentes de los libros existentes es una tarea editorial nuestra de implementación. Conserva sus asociaciones y solo establece el orden según contenido. Generar inventario antes/después y revisar todos los libros con más de un interés. Si aparecen datos nuevos fuera del límite, no truncarlos: preparar una resolución explícita antes de activar la restricción.
- Conservar permisos actuales de edición. Esta feature no concede edición de metadatos de libros ajenos ni abre un editor general nuevo.

### Preferencias personales ordenadas

- Dos listas disjuntas, ordenadas e independientes: intereses que le interesan e intereses que no le interesan. Lo no incluido en ninguna es neutral y no influye.
- La primera lista admite de uno a cinco; la segunda, de cero a cinco.
- Tres es la cantidad ideal recomendada. Si marca más de tres, mostrar una recomendación funcional y discreta; no impedir llegar a cinco.
- El orden de selección determina los números y queda explicado. No recolocar las casillas. Quitar renumera; volver a marcar añade al final.
- El primero de los intereses que le interesan es el que más le interesa. El primero de los que no le interesan expresa el mayor rechazo.
- Un mismo ID no puede estar en ambas listas. La interfaz permite corregirlo dentro del mismo borrador; el servidor rechaza duplicados, IDs desconocidos y listas incompatibles.
- La sección pública del perfil se llama «Intereses» y muestra ambas listas en su orden, con los símbolos aprobados. Solo el propio usuario puede editarlas.
- Editar exige mantener al menos un interés que le interese. No concede divisas.
- Los idiomas permitidos para tarjetas son un ajuste del propietario del perfil, no una nueva lista pública por inferencia.

### Flujo inicial y premios

- Al llegar a Inicio con sesión y sin preferencias configuradas, abrir un flujo obligatorio de dos pasos. Los visitantes conservan el acceso actual a registro y exploración; no se inventa un onboarding de invitado.
- Paso 1: «Marca cuáles te interesan especialmente». Necesita al menos uno para continuar.
- Paso 2: «Marca cuáles no te interesan en absoluto». Marcar alguno es opcional; explicar su utilidad para centrar recomendaciones y repasos y que podrá cambiarlo después. No prometer efectos nuevos sobre notas que este plan no define.
- Apariencia coherente con Repasar: fondo compartido y lenguaje expresivo del proyecto, con controles accesibles y navegación táctil. Permitir volver al primer paso antes de guardar.
- Premio de 3 hojas si guarda al menos tres intereses que le interesan durante este flujo. Premio de 2 pétalos si guarda al menos tres que no le interesan durante este flujo.
- El incentivo de hojas aparece después de la primera selección del paso 1. El de pétalos aparece desde cero selecciones en el paso 2.
- Mostrar ambos con `priceTag`, su icono y cantidad. No escribir «tres hojas» como sustituto del componente.
- Copy aprobado para hojas: «Solo las recibirás si las marcas ahora, no después al editar tu perfil». Adaptar concordancia para pétalos y traducir a EN.
- Al guardar se vuelve a Inicio y se reciben los premios elegibles. Preferencias, cierre de la oportunidad y concesión se confirman en una sola transacción. Después no se puede recuperar el premio editando el perfil o reabriendo la pantalla.
- La concesión es única por cuenta y tipo de premio. Reintentos, doble clic, reconexión o dos pestañas no duplican nada. El servidor decide elegibilidad y cantidades.
- Al volver a Inicio, animar el saldo real recibido: incrementos de uno en uno con un latido de tamaño por cada +1. La animación no escribe saldo. Con movimiento reducido, mostrar el resultado sin latidos. No hace falta otra ronda de diseño de la animación.
- Conservar el borrador durante pasos y errores. Guardarlo localmente por cuenta mientras no se confirme; restaurarlo al recargar y validarlo contra el catálogo actual. No subir un borrador como preferencias públicas. Una recarga o abandono no concede premios ni termina el flujo. Si se configura primero desde el perfil, guardar preferencias válidas cierra transaccionalmente la oportunidad inicial sin premio y evita exigir una segunda configuración en Inicio. Dos pestañas compiten por la misma oportunidad; solo la primera confirmación válida la cierra.

### Divisas

- Todos los límites son de recarga, nunca de almacenamiento.
- Mantener el comportamiento ya correcto de hojas. Corregir pétalos para conservar saldos superiores a su umbral, sin recortarlos en lecturas o recargas.
- Los premios se abonan íntegros, incluso sobre el límite de recarga.
- Reutilizar los ciclos y zonas horarias de `app/daily-cycle.mjs` / `server/daily-cycle.mjs` para las recargas. Los premios son únicos, no diarios: no inventarles un ciclo. Centralizar la nueva política de incorporación de catálogo antes de consumirla; guardar timestamps UTC de alta, no un día del ciclo local. No duplicar reglas temporales en UI, servidor o pruebas.
- Aclarar en la información del monedero la diferencia entre saldo y límite de recarga. Corregir documentación vigente obsoleta sobre cifras. No reescribir entradas históricas del diario como si fueran actuales.

### Algoritmos separados

Tres contratos independientes de UI, HTTP y base de datos. Los nombres de implementación son orientativos; el contrato funcional es obligatorio:

1. Comparar afinidad de dos libros para un usuario.
2. Determinar si un libro podría no resultarle interesante, devolviendo además la razón y el interés que la provoca.
3. Sortear tarjetas según respuestas de frecuencia.

Ninguna vista vuelve a implementar estas reglas. Los consumidores reciben datos estructurados; la UI localiza el mensaje y decide cómo mostrarlo. Constantes y políticas quedan en módulos pequeños, con entrada explícita y pruebas de comportamiento. No introducir un framework de experimentación, servicios remotos ni llamadas IA para estas decisiones.

Comparador inicial:

- Comparar primero el interés principal del libro; solo si empatan, el segundo y después el tercero.
- Los intereses que le interesan preceden a neutrales, que preceden a los que no le interesan.
- Dentro de los que le interesan gana el marcado antes por el usuario. Dentro de los que no le interesan, el primero implica mayor rechazo y queda detrás.
- Una posición ausente equivale a neutral. En empate completo se conserva el orden previo; nunca se muta el catálogo original.

Detección inicial:

- Si el libro contiene el primer interés que el usuario ha indicado que no le interesa, devolver que podría no resultarle interesante, aunque el libro tenga otro principal que sí le interese.
- Devolver el interés causante, no un texto ya renderizado.
- Sin esa coincidencia no mostrar el aviso inicial. La política se podrá cambiar sustituyendo esta función.

Frecuencia de tarjetas:

- Sorteo ponderado por tarjeta entre todas las elegibles del conjunto que se está sorteando. Peso 2 para «Ver más a menudo», 1 sin respuesta y 0,5 para «Ver menos a menudo». En los cuatro modos actuales se sortea su conjunto completo; en Descubrir los niveles de contenido definen conjuntos sucesivos, nunca grupos por respuesta.
- Extraer sin reemplazo dentro de la sesión. No hay cupos por respuesta ni acumulación al repetir una respuesta: manda la última.
- Una respuesta sirve para esa tarjeta en todos los modos donde sea elegible. No modifica preferencias del perfil, pagos ni premios.
- Decisión operativa sobre el histórico: interpretar todas las filas existentes conforme a los botones actuales, sin borrar ni reescribir respuestas. Con el contrato actual, el valor legacy `soon` corresponde a la pulsación «Ver menos» y recibe 0,5; `remembered` corresponde a «Ver más» y recibe 2. Encapsular esta traducción para no propagar esos nombres legacy. Algunas respuestas antiguas anteriores al cambio de rótulos pudieron expresar otra intención; se acepta esa limitación en este ajuste. No segmentar por fecha de commit ni inventar una fecha de despliegue.
- Sesiones ya generadas conservan sus IDs y orden; el nuevo sorteo se aplica a las nuevas.

### Librería y recomendaciones

- Selector con «Más recientes», «A–Z», «Mis intereses»; recordar elección por cuenta en servidor. Para visitantes, por navegador. Valor inicial: Más recientes. Al entrar en otra cuenta usar su elección, sin heredar la de la anterior.
- Más recientes usa fecha real de incorporación para libros nuevos. Para los existentes se congela en la migración una referencia inmutable a su `position` y se usa descendente como aproximación. Nuevos con timestamp real preceden al lote histórico; empates nuevos se resuelven por una referencia estable de incorporación e ID, nunca por `updated_at`. No fabricar fechas. Cubrir esquema, creación manual/IA, seed/importador y salida de `readCatalog`/`GET /api/catalog`.
- A–Z usa el título mostrado en el idioma de interfaz, incluyendo su fallback al título popular.
- Mis intereses usa el comparador central. Para visitantes requiere iniciar sesión. La personalización no modifica la organización de Biblioteca.
- Barajas del mismo libro comparten afinidad. Conservar su orden interno aprobado: guías y distintivos/recomendaciones siguen sus reglas.
- Búsqueda y filtros siguen funcionando sobre el mismo conjunto y combinan con cualquier orden elegido.
- Cuando no haya libros en Leyendo, Inicio ofrece hasta tres libros distintos. Puede incluir Por leer y libros todavía fuera de Biblioteca.
- Prioridades: libros relacionados con algo que le interese y sin detección desfavorable; después los relacionados detectados como posiblemente poco interesantes; después otros disponibles. Agotar los no leídos antes de recurrir a ya leídos. Si el catálogo entero tiene menos de tres, mostrar solo los disponibles.
- Usar el comparador dentro de cada nivel y desempate estable. No confundir la recomendación personal con la recomendación editorial del equipo de una baraja.
- Mantener el contenido de notas y los borradores que ya muestra Inicio. No ocultarlos para introducir recomendaciones.

### Aviso al incorporar un libro

- Consultar el detector antes de confirmar una nueva incorporación a Biblioteca. Mostrar que el libro tiene marcado **emoji + nombre del interés**, que podría no resultarle interesante.
- Permitir continuar o cancelar. No bloquear la decisión del usuario ni cambiar sus preferencias.
- Cubrir las entradas explícitas e implícitas existentes: estado Por leer/Leyendo/Leído, añadir una baraja y guardar una tarjeta si esa acción incorpora un libro nuevo. No repetir el aviso si el libro ya está en Biblioteca.
- No cobrar, guardar una tarjeta ni cambiar el estado de lectura antes de que confirme. Cancelar deja todo como estaba.
- Usar la pertenencia real de `shelfBookIds`/Biblioteca para determinar si es una incorporación; no deducirla solo de Leyendo/Leído o de barajas añadidas. Las tres vías anteriores son el alcance aprobado: autoría de barajas y captura de notas conservan sus flujos actuales y no incorporan otro aviso en este incremento.
- La detección y las mutaciones siguen siendo del servidor; no confiar en una decisión de afinidad fabricada por el cliente. Contrato mínimo: una petición normal que necesita aviso devuelve un resultado de confirmación requerida sin mutar. Reenviar la misma acción con confirmación explícita del ID del interés mostrado; el servidor vuelve a cargar sesión, preferencias, libro y precio. Si cambió la razón relevante, volver a pedir confirmación. La confirmación de una acción no confirma otra: enviar el mismo tipo de operación y recurso, nunca una autorización global. No hacen falta tokens caducables ni una tabla de permisos. Transacción e idempotencia de la operación protegen el cobro y los efectos de reintentos; la ruta de estado de lectura no vuelve a incorporar ni a avisar un libro ya presente.

### Descubrir y reglas comunes de Repasar

- Quinto modo «Descubrir», explicado en la ayuda junto a los demás.
- Cinco tarjetas; mismos precios, descuento, reanudación y respuestas que los otros modos. Puede usar tarjetas sin añadir su baraja al Tarjetero.
- Al activar el quinto modo se amplía deliberadamente el conjunto del descuento: el cálculo actual por hash puede cambiar qué modo está rebajado para una sesión todavía no comprada. Mostrar el precio vigente antes de comprar. No modificar coste ni IDs de sesiones ya compradas. No añadir persistencia de descuentos para evitar esta actualización; sí separar los modos habilitados de la enumeración de esquema y probar cliente/servidor durante activación.
- Se permiten borradores accesibles. Extraer y reutilizar la regla de acceso de `knownDeck`, no inferir acceso porque una fila esté en `allCards`: un borrador colectivo de contribución seleccionada requiere propietario o invitación; un colectivo abierto es accesible; un archivado exige la pertenencia que ya exige esa regla. No ampliar permisos. Cubrir las mismas condiciones en servidor al crear o recuperar sesiones y al hidratar la tarjeta. La auditoría general de todo el payload público del catálogo queda fuera de esta feature; Descubrir no se apoya en esa exposición para decidir permisos.
- Se admiten tarjetas raíz e hijas. No crear ahora otra interfaz de contexto; se revisará si la experiencia lo requiere.
- Construir primero la unión de tarjetas accesibles, de idiomas permitidos y no guías; deduplicar por ID. Clasificarla en seis niveles disjuntos: (1) fuera de Biblioteca, libro relacionado con algún interés que le interese y sin detección desfavorable; (2) fuera, relacionado y con detección desfavorable; (3) resto de fuera; (4) dentro de Biblioteca, relacionado y sin detección; (5) dentro, relacionado y con detección; (6) resto de dentro. Recorrer niveles en ese orden, sorteando por tarjeta dentro de cada uno hasta completar cinco. Pasar al siguiente solo si hace falta. No imponer diversidad por libro ni cupos por respuesta. Las preferencias de frecuencia cambian el peso dentro del nivel, no lo trasladan a otro nivel.
- Si el total elegible no alcanza cinco tarjetas distintas, deshabilitar con explicación funcional; no cobrar. No completar usando idiomas no permitidos o guías.
- Conservar atribución a libro, autor y creador, acciones disponibles y navegación existentes. Abrir/guardar no añade automáticamente la baraja.
- Las guías de lectura **jamás** son elegibles en ningún repaso, incluidas Guardadas, Mixto y Descubrir. Aplicar el filtro común en servidor y comprobar también la recuperación de sesiones anteriores para no servir guías congeladas en IDs antiguos.
- Si al aplicar la exclusión absoluta una sesión anterior resulta incompatible, no servir sus guías ni volver a cobrar. Bloquear la fila de sesión y sustituir solo posiciones pendientes `position >= card_index` por tarjetas elegibles del mismo modo, sin duplicar IDs ya contestados o pendientes válidos. Actualizar juntos `card_ids` y `practice_session_cards`. Una guía contestada antes del rollout queda como histórico y no vuelve a emitirse; no borrar respuestas.
- Si no se puede reponer, cancelar y devolver `cost` exactamente una vez en la misma transacción. Añadir estado persistido de cancelación/reembolso separado de `completed_at`; adaptar índice de sesión activa y consultas para excluir canceladas. Conservar respuestas válidas ya dadas; cancelar no cuenta como completada, no cambia la semilla de descuento ni concede progreso de mascota. Dos pestañas deben observar el mismo cierre y un único abono. Es una recuperación acotada, no un sistema genérico de reembolsos.
- La recuperación se comparte en lectura de estado (`readReaderState`), arranque, respuesta y restauración de ruta directa: reparar solo `/practice/start` no basta. Antes de aceptar una respuesta verificar de nuevo identidad de sesión/tarjeta/índice. Devolver siempre el estado autoritativo reparado o cancelado; el cliente reemplaza IDs/índice/saldo, en lugar de incrementar a ciegas su índice local. Una cancelación vuelve al selector con explicación y nunca compra automáticamente otra sesión. Probar respuesta en vuelo contra tarjeta sustituida, reanudación directa y dos pestañas.
- Serializar por cuenta con `FOR NO KEY UPDATE` en PostgreSQL, antes de cualquier escritura de la transacción: cuenta → sesión → monederos, con orden fijo entre monederos. El helper se llama al inicio de `readReaderState`, `addDeckToCollection`, `removeDeckFromCollection`, `selectDeck`, `openCard`, `changeReading`, `changePreferences`, `dailyIdea`, `startPracticeSession` y `answerPracticeSession`. `stateInside` supone ese bloqueo ya adquirido: bloquear solo ahí sería tarde y puede provocar deadlocks con `deck_selections` y preferencias. `dailyIdea` bloquea cuenta antes del advisory lock global. No extender a autoría/guardadas, que leen estado después de su transacción o no lo leen. No abrir transacciones anidadas. Mantener SQLite existente. Antes de 01b probar PostgreSQL real entre conexiones: reparación/respuesta, doble devolución, `selectDeck`/collect y preferencias concurrentes; PGlite no acredita ausencia de deadlocks.
- Rollout de 01a: añadir cancelación, adaptar todos los lectores, validadores e índices, pero mantener apagada la creación de cancelaciones/sustituciones. Solo 01b activa recuperación después de verificar 01a en producción. El rollback compatible de 01b es 01a, no una versión que ignore cancelaciones.

### Idiomas de tarjetas

- Ajuste editable en el perfil, con al menos un idioma.
- Predeterminado: inglés y el idioma de interfaz si es distinto. Materializar esa lista una sola vez para cuentas existentes y nuevas; no recalcularla en cada lectura. El estado indica si el usuario ya la editó, para distinguir un valor inicial de uno elegido, pero ninguna de las dos listas cambia al modificar después la interfaz.
- Listar la unión de idiomas efectivos presentes en tarjetas accesibles, idiomas seleccionados y defaults inglés/idioma UI, con sus nombres localizados. El filtro compara el idioma efectivo `card.language` y su fallback ya existente de baraja; una traducción de título o texto no cambia ese idioma. No fijar que solo puedan existir ES/EN. Usar la normalización/etiquetas de idioma central del proyecto y conservar los idiomas ya elegidos aunque no haya tarjetas disponibles temporalmente.
- Filtrar los candidatos de todos los modos de Repasar por idioma efectivo de la tarjeta.
- Aplicar cambios a nuevos repasos. El ya iniciado conserva sus tarjetas: es la opción simple aprobada.
- Distinguir integridad permanente (existencia, permisos y exclusión de guías) de filtros para comprar (idiomas y afinidad). Guardar desde 20 un snapshot mínimo de idiomas de compra, no de todas las preferencias. Las sustituciones necesarias por integridad respetan ese snapshot. En sesiones legacy, materializar una sola vez la unión normalizada de idiomas efectivos de sus IDs existentes; si no queda ninguno recuperable, cancelar y devolver el coste. Cambiar preferencias por sí solo no reemplaza tarjetas ni invalida la sesión.
- No aplicar este filtro a Idea del día ni a contenido que el usuario abra manualmente.

### Guías al empezar un libro

- En toda transición real de otro estado a Leyendo, si hay guías accesibles del libro, mostrar «¡Hay guías de lectura disponibles para ese libro!».
- Primario «Echarles un vistazo»; enlace pequeño «Ahora no...».
- El primario abre `#guide-preview/:bookId`, presentación vertical de todas las guías de ese libro. No abrir un carrusel ni iniciar un repaso.
- El enlace conserva Leyendo y vuelve al contexto anterior. No repetir el aviso si pulsa Leyendo estando ya en ese estado.
- Conservar navegación de regreso y foco. Evitar que otro aviso o sugerencia de tomar notas se superponga al modal.

### Nuevos intereses

- Comprobar al entrar en Inicio, desde el coordinador de navegación/estado, no en la vista de Inicio ni con un nuevo bucle de polling.
- Mostrar solo incorporaciones posteriores a lo conocido por esa cuenta. Las cuentas nuevas hacen la selección inicial; no reciben una cascada por el catálogo existente. El rollout tampoco anuncia todos los intereses anteriores como nuevos.
- Modal «¡Nuevo interés!» o «¡Nuevos intereses!», sin cierre ni Escape que lo descarte.
- UX decidida por delegación del usuario: dos pasos de selección ordenada, como el flujo inicial, con todos los intereses nuevos juntos. Primero los que le interesan; después los que no le interesan. Lo no marcado se guarda neutral al finalizar, sin exigir respuestas fila por fila.
- Mostrar el orden existente y añadir cada elección al final. Si una lista ya tiene cinco, pedir elegir cuál sustituir. Cancelar la sustitución conserva el borrador y permite dejar ese interés neutral.
- Mantener la intención de las tres respuestas aprobadas: «¡Me interesa!» con tick verde, «Me da igual», «¡No la quiero ni ver!» con aspas rojas. Usar los dos pasos también cuando hay un único interés nuevo: no añadir una variante especial de tres botones. Lo no marcado queda neutral al confirmar, sin imponer orden por filas.
- No hay premios. Guardar preferencias y conocimiento de los nuevos IDs atómicamente. Solo reconocer los mostrados: una incorporación concurrente queda pendiente para la próxima entrada.
- Error de red: conservar selección y permitir reintentar; no encerrar al usuario en un modal vacío, sin catálogo o con un error irrecuperable. Ante catálogo no disponible mostrar recuperación; no registrar respuestas ficticias.

### Libros nuevos y badges

- NUEVO significa libro incorporado desde la última visita del usuario a Librería.
- Cuentas recién creadas y libros ya existentes en el rollout parten con un baseline conocido, no con todo el catálogo marcado nuevo.
- En Portadas: sello NUEVO / NEW centrado en el libro, distinto de distintivos de barajas. Usar composición propia para no ocultar título o autor. La referencia a la mascota describe la zona visual; no cambiar mascotas.
- En Estantería densa y Apilados: grupo/repisa inicial de novedades con su sello. Cada libro aparece solo en un grupo.
- Dentro de novedades y del resto se aplica el orden elegido y los filtros actuales. Mantener ese orden semántico en las tres presentaciones: el render actual de apilados invierte la lista y hay que adaptar ese comportamiento.
- Badge ondulada en el acceso a Librería mientras haya novedades pendientes. Compartir geometría y animación con Idea del día, corregir la colocación de ambas y sus nombres accesibles. Verificar móvil, escritorio, navegación que aparece/desaparece, cifras y textos largos y movimiento reducido.
- Al cargar correctamente Librería, capturar sus novedades y reconocer solo ese snapshot; entonces retirar la badge. Los sellos y el grupo permanecen durante esa visita, incluidas fichas y regreso, cambios de orden/filtro/presentación. La visita termina al navegar a otra sección principal; abrir detalles y regresar no inicia otra. En la siguiente visita ya no se consideran pendientes. Si falla la carga, no reconocer nada. Una recarga inicia otra visita con el estado ya reconocido. No reconocer libros incorporados concurrentemente que no estaban en el snapshot.
- Un filtro sin resultados nuevos oculta su grupo vacío, sin perder el snapshot; al retirar el filtro reaparecen dentro de la misma visita. Ambos grupos respetan el orden elegido. Las badges se anclan al icono/contorno visible de cada pieza de navegación, con el mismo margen interior y sin invadir icono, etiqueta, pieza vecina ni borde del viewport; comprobar ambas activas a la vez y el desplazamiento de la barra. Recalcularlas desde estado común al cargar sesión, reconocer novedades o registrar vista diaria, no solo al entrar en Inicio.
- Para visitantes sin cuenta, usar el mismo comportamiento con conocimiento local. Al crear una cuenta comienza su baseline de cuenta, sin trasladar premios o respuestas por inferencia.

## Contratos de datos y concurrencia

- Añadir posición a asociaciones libro/interés; posiciones consecutivas 1..N, sin duplicados y con máximo tres cuando se active la validación. Preservar IDs, contenido, referencias y permisos.
- Preferencias por usuario e interés con estado y posición; claves/validación que garanticen disyunción y secuencias consecutivas en cada lista. Actualizar ambas listas en una transacción; usar posiciones temporales libres si lo exigen los índices.
- Separar preferencias de conocimiento de novedades. Un interés neutral puede estar ya conocido; ausencia de preferencia no implica onboarding pendiente ni aviso pendiente.
- Mantener un estado inequívoco de configuración inicial y oportunidad de premio cerrada. Restricciones persistentes por usuario/tipo impiden duplicar concesiones. Guardar estado y saldo dentro de la misma transacción, con bloqueo o escritura atómica adecuada a cada motor.
- Fecha real de alta nueva, referencia legacy inmutable y conocimiento de libros son conceptos distintos. No derivar novedades de `updated_at`, de cambios editoriales o de la posición mutable de Librería.
- El reconocimiento de novedades usa IDs/revisión del snapshot realmente mostrado. No usar «ahora» del cliente como corte que pueda saltarse incorporaciones concurrentes. Elegir la representación más pequeña compatible con ambos motores, documentarla y comprobar sus carreras antes de implementarla; no añadir infraestructura de eventos general.
- APIs autenticadas y consultas públicas separadas: perfil público expone listas y orden aprobados; mutaciones derivan usuario de sesión. No publicar balances, registros de premios ni preferencias de idiomas por inferencia.
- Las tablas nuevas de preferencias, conocimiento, configuración, recibos y registros auxiliares en `public` tienen RLS habilitada y sin acceso directo para `anon`/`authenticated`; la API del servidor ofrece las lecturas públicas aprobadas. Probar tanto esquema limpio como migración bajo roles Data API. No usar JWT de Supabase para autorizar las cuentas propias del proyecto ni confiar en datos editables por el usuario.
- El estado configurado y el cierre de oportunidad sin premio existen ya en 12/13, antes de publicar el editor de perfil. El paso 21 añade concesiones/recibos y respeta esas filas previas, sin volver a abrir oportunidades. Probar configuración hecha antes de 21/22.
- Cambios concurrentes de preferencias: no sobrescribir silenciosamente una edición más reciente. Devolver conflicto recuperable y permitir recargar conservando el borrador; nunca conceder un premio doble al resolverlo.
- Migraciones aditivas SQLite/PostgreSQL con compatibilidad durante despliegue. Capturar fixtures históricos inmutables de las versiones realmente anteriores a cada migración. No fijar números de esquema ahora: revalidarlos al ejecutar.
- Cada componente interpreta defaults durante rollout. Activar UI obligatoria solo cuando API, persistencia, premios y recuperación ya están desplegados y verificados. Las capacidades incompletas permanecen ocultas; no publicar botones sin efecto.

## Incrementos autocontenidos y publicables

Cada fila es una entrega. Puede contener varios commits locales si hace falta; solo se publica cuando está completa. «Publicable» no obliga a mostrar una capacidad antes de que sus dependencias estén disponibles. Las ampliaciones de datos/API son compatibles y útiles como preparación verificable; no se publican contratos rotos ni superficies a medio hacer.

| ID | Resultado cerrado | Depende de | Criterio específico de aceptación |
| --- | --- | --- | --- |
| 01a | Contrato de recuperación y lectores compatibles | 04 | Estado de cancelación separado, lectores/índice/validadores y cliente reconciliados; cancelación/sustitución aún apagadas. Pruebas de transición y locks de orden único. |
| 01b | Guías fuera de todos los repasos | 01a | Ningún modo ni ruta restaurada sirve una guía; recuperación sin doble cobro/reembolso. Gate: concurrencia con conexiones PostgreSQL reales, además de SQLite/PGlite. |
| 02 | Aviso de guías al pasar a Leyendo | 01b | Textos aprobados, vista vertical, regreso correcto y una sola apertura por transición. |
| 03 | Sorteo individual de frecuencia corregido | — | Pesos 2/1/0,5, intención de botones, última respuesta sin acumulación, sin duplicados. |
| 04 | Pétalos conservan saldo sobre el límite de recarga | — | Recarga/lectura/gasto no recortan saldo otorgado; hojas continúan correctas. |
| 05 | Emojis y chips de intereses | — | Siete emojis aprobados, degradados tenues, ES/EN y nombres accesibles en superficies actuales. |
| 06 | Campos de creación manual disponibles sin IA | — | Un libro puede completarse manualmente sin llamar al proveedor; IA sigue siendo ayuda opcional. |
| 07 | Persistencia/API de orden editorial del libro | — | Lectura/escritura/importación conservan orden; migración compatible, IDs y asociaciones intactos. |
| 08 | Revisión y aplicación editorial del orden existente | 07 | Orden editorial de los 13 libros objetivo aplicado en una migración transaccional e idempotente; conjuntos de asociaciones exactos, IDs intactos y catálogo válido. |
| 09 | Selector numerado y límite de uno a tres al crear | 05,06,07 | Orden por clic visible sin mover casillas; manual e IA cumplen mismo contrato. |
| 10 | Fecha de incorporación y orden Más recientes | — | Nuevos con fecha real, anteriores con fallback aprobado; no fabricar fechas. |
| 11 | Selector A–Z y persistencia del orden elegido | 10 | Títulos localizados, filtros combinados y orden consistente en portadas/estantes/apilados. |
| 11a | Runner local de PostgreSQL desechable | 01b | `npm test` exige la prueba de recuperación con PostgreSQL: reutiliza la URL loopback de CI o prepara Docker/Colima y un contenedor `postgres:16` efímero, publicado solo en loopback, sin volumen y retirado al terminar. No cambia el contexto Docker global ni sustituye el servicio PostgreSQL de CI. |
| 12 | Persistencia y API privada de preferencias ordenadas | 05 | Uno a cinco / cero a cinco, disyunción, orden y conflictos protegidos; estado configurado/cierre de oportunidad sin premio ya persistidos; sin UI obligatoria todavía. |
| 13 | Sección pública y editor de Intereses en perfil | 12 | Listas públicas ordenadas, solo propietario edita, tres recomendado, nunca premios. |
| 14 | Comparador y detector centrales | 08,09,12 | Contratos puros, orden estable, razón estructurada; sin reglas repetidas en vistas. |
| 15 | Orden opcional Mis intereses en Librería | 11,13,14 | Preferencia por cuenta, visitante inicia sesión para usar Mis intereses; Biblioteca conserva su organización. |
| 16 | Recomendaciones de Inicio | 14 | Build, pruebas focalizadas, lint y diff-check correctos. QA Safari responsive a 351, 390, 520 y 1439 px CSS: ratio 11:15, autor mínimo 10 px y títulos/autores máximos dentro de cuatro/tres líneas con elipsis; texto íntegro accesible. Dos columnas en móvil y tres en escritorio. Suite completa pendiente. |
| 17a | Contrato común de confirmación previa a incorporación | 14 | Tres mutaciones preparadas con confirmación y revalidación sin efectos previos; activación todavía deshabilitada. |
| 17b | Aviso en el flujo de estado de lectura | 17a | Emoji+nombre, confirmar/cancelar antes de mutación; integrado pero sin activar la política global. |
| 18 | Aviso al incorporar implícitamente con una baraja | 17a | Mismo detector/confirmación; cancelar no cobra hojas ni añade nada; activación aún deshabilitada. |
| 19 | Aviso al guardar tarjeta y activación de las tres vías | 17b,18 | Cancelar no guarda ni incorpora; acción continúa una vez; no queda ninguna entrada sin cubrir. |
| 20 | Preferencia de idiomas en perfil y en Repasar | 01b,13 | Default inglés+UI, mínimo uno, filtro en todos modos, sesión activa intacta, Idea del día global intacta. |
| 21 | Registro único y concesión transaccional de premios | 04,12 | API completa pero sin entrada obligatoria visible; pruebas de reintento, carreras y saldo superior al límite. |
| 22a | Pantallas y borrador del flujo inicial | 05,13,21 | Dos pasos completos, límites, vuelta atrás, restauración por cuenta y copy+priceTag; entrada obligatoria todavía oculta. |
| 22b | Animación de recepción de divisas | 21 | Recibo autoritativo, contador uno a uno, latidos, movimiento reducido y sincronización; aún sin activar onboarding. |
| 22c | Activación completa del onboarding en Inicio | 16,22a,22b | Gate, finalización atómica, cierre de oportunidad y recepción real al regresar; ningún acceso activo incompleto. |
| 23a | Conocimiento y detección de nuevos intereses | 05,13,22c | Baseline, snapshot y concurrencia probados; no abre todavía un modal. |
| 23b | Modal ordenado de nuevos intereses y activación | 23a | Dos pasos, sustitución, neutral implícito, sin cierre/premios ni cascada inicial; recuperación de errores. |
| 24a | Regla compartida de acceso a tarjetas de repaso | 01b,20 | Propietario, invitación, colectivo abierto y archivados contrastados con reglas vigentes; no amplía permisos. |
| 24b | Candidatos y soporte interno del quinto modo | 03,14,24a | Seis niveles, sorteo y esquema probados; disponibilidad mínima derivada en servidor del mismo selector. Endpoint público rechaza `discover` inactivo, sin cobrar/crear sesión; sin descuento ni UI todavía. |
| 24c | Descubrir visible y explicado | 24b | Habilitar servidor y UI juntos; selector/ayuda/precio/descuento/reanudación completos. Disponibilidad por lectura autenticada, estados carga/error/insuficiencia y revalidación al comprar; sin duplicar permisos en cliente ni polling. |
| 25 | Conocimiento de libros nuevos | 10 | Baseline y reconocimiento de snapshot sin carreras en cuentas y visitantes; contrato completo, todavía sin badge ni entrada visual incompleta. |
| 26 | Sellos y grupo de novedades en Portadas | 25,11 | Centro de portada legible y agrupación/filtros probados; novedad visual aún oculta hasta soportar todas las presentaciones. |
| 27 | Repisas en Estantería/Apilados y activación de novedades | 26 | Las tres presentaciones completas, orden correcto y móvil; ocultar grupos vacíos tras filtros sin perder snapshot. |
| 28 | Badge Librería y colocación común de badges onduladas | 27 | Ambas badges activas bien ancladas, sin solapar etiquetas/iconos ni salir del viewport, incluida barra animada. |

Las activaciones son pequeñas capacidades internas compartidas entre servidor y cliente; no requieren una plataforma de feature flags ni un nuevo panel. Mientras una capacidad esté incompleta permanece apagada y no cambia cobros, respuestas de API de producción ni navegación visible. Retirar sus ramas temporales al activarla y verificarla. Los incrementos 21–22c se preparan consecutivamente: no anunciar concesiones sin el flujo completo. Los pasos 17a–19 activan las tres entradas de aviso juntas. Los pasos 24b–24c no amplían el descuento hasta que existe la UI completa. Los pasos 25–27 no muestran badge ni novedad parcial.

Orden operativo inicial recomendado: 04 → 01a → 01b → 02 → 03 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 11a → 12 → 13 → 14 → 15 → 16 → 17a → 17b → 18 → 19 → 20 → 21 → 22a → 22b → 22c → 23a → 23b → 24a → 24b → 24c → 25 → 26 → 27 → 28. Solo adelantar tareas independientes si no aumenta el tamaño de la entrega ni oculta dependencias.

## Equipo y doble verificación por incremento

1. Coordinador entrega al implementador Luna/Alto una tarea: ID, objetivo, dependencias ya integradas, archivos/contratos relevantes, ejemplos de aceptación, pruebas y exclusiones concretas.
2. Implementador investiga el estado vigente, implementa y realiza verificación funcional. No asume que esta auditoría siga describiendo `main` semanas después.
3. Otro agente Luna/Alto revisa el diff y el resultado sin limitarse al resumen del implementador. Comprueba permisos, datos, UX, recuperación y pruebas significativas. Puede rechazar el incremento; el implementador corrige antes de publicar.
4. Con todos los cambios finales, ejecutar suite completa y build, lint y comprobación de diff. Un cambio posterior a la suite exige volver a ejecutar lo afectado y la suite completa antes del cierre.
5. Publicar ese incremento como PR listo y dejar actuar la CI/autointegración. El seguimiento hasta producción forma parte de la ejecución de este plan una vez confirmado. No publicar el siguiente dependiente mientras el anterior esté fallando o sin verificar.
6. El revisor verifica en producción el comportamiento concreto del incremento y el catálogo válido. Registrar evidencia y commit desplegado. Actualizar diario y estado del plan; actualizar `main` local y retirar la rama temporal cuando la integración esté confirmada.

No hacen falta tres implementaciones ni tres agentes editando el mismo archivo. Usar un implementador y un revisor independiente por incremento; un tercer agente puede investigar el siguiente contrato o preparar una tarea que no escriba sobre la actual.

## Verificación obligatoria

### Común

- Usar Node de `.node-version`. Si falta `node_modules`, `npm ci` antes de app o pruebas.
- `npm test` completo, salida 0, incluye build. Ejecutar desde el primer intento con permisos elevados porque abre listeners locales. No aceptar fallos previos ni EPERM como resultado final.
- `npm run lint` y `git diff --check`.
- Tests con estados base de `test-support/reader-state.mjs`, proveedores IA simulados y fixtures de migración históricos inmutables para SQLite y PostgreSQL.
- Pruebas de contrato y accesibilidad en contexto. No fijar SVG, wrappers, copy incidental ni snapshots que solo repliquen implementación.
- QA visual/interactiva de las superficies cambiadas en móvil y escritorio, teclado, foco, movimiento reducido, carga, vacío, error, reintento y textos largos ES/EN. No añadir dependencias de pruebas sin comprobar las herramientas existentes.
- En 05, 09, 13, 22a–c, 23b, 24c y 26–28 exigir evidencia visual comparativa con Repasar, revisada por otro agente: composición, profundidad, jerarquía, feedback táctil y movimiento. Sol puede diseñar, implementar o revisar la UI; Luna/Alto conserva la verificación de contratos funcionales. No aprobar una pantalla plana solo porque cumple sus controles.
- Para frontend: mantener los componentes actuales, diseño táctil y carácter Duolingo/Forest. Documentar reglas aprobadas en DESIGN al completar el incremento que las establece.

### Casos que no se pueden omitir

- Selección ordenada: marcar, quitar en medio, volver a marcar, límites, no duplicar entre listas, cambiar de cuenta y volver atrás sin perder borrador.
- Orden editorial: normalizador/IA/importación/API no vuelven a ordenar por ID; migraciones y edición conservan asociaciones y posiciones consecutivas.
- Frecuencia: RNG inyectable y ejemplos deterministas de probabilidad acumulada por tarjeta; una tarjeta no representa un grupo entero. Misma respuesta repetida mantiene peso, opuesta lo sustituye; cinco IDs distintos y sesión reanudada idéntica. No basar la suite en tests estadísticos inestables.
- Premios: probar uno/dos/tres/cuatro/cinco en el primer paso y cero/uno/dos/tres/cuatro/cinco en el segundo. Menos de tres no concede el premio de ese paso; desde tres concede su importe completo. Los premios de hojas y pétalos son independientes: pueden concederse ambos, solo uno o ninguno. Elegibilidad solo inicial; doble clic/reintento/pestañas; edición posterior no premia; saldos grandes sobreviven a recarga; fallo revierte toda la transacción.
- Comparador: prioridad estricta por posición del libro, orden de usuario, rechazo ordenado, posiciones ausentes y empate estable. Detector separado del comparador y de textos.
- Avisos: todas las entradas aprobadas, cancelación sin efectos, sin doble cobro, libro ya incorporado no vuelve a avisar y permisos de sesión correctos.
- Repasar: guías excluidas también guardadas y reanudadas; borradores accesibles permitidos; idioma efectivo de tarjeta; menos de cinco no cobra; quinto modo y descuento coherentes; sesión activa no se altera por un cambio de idiomas.
- Idea del día: misma asignación global para usuarios con preferencias e idiomas distintos. No crear llamadas ni recalcularla desde las nuevas preferencias.
- Nuevos intereses: cuenta nueva/rollout sin cascada, varias novedades, orden añadido, listas llenas, sustitución cancelada, error de red y otra incorporación concurrente.
- Libros nuevos: baseline, una sola aparición por grupo, snapshot estable al filtrar/ordenar/abrir ficha, otra incorporación no reconocida por accidente, todas las presentaciones y badges sin desbordamiento.

## Publicación, datos y recuperación

- Revalidar rama/base y estado de producción antes de cada incremento. No sobrescribir trabajo ajeno ni reutilizar credenciales en archivos.
- Migraciones compatibles: ampliar primero y activar consumidores después. Si el esquema anterior no puede leer el nuevo, resolver la compatibilidad antes de publicar. No eliminar datos para facilitar rollback.
- En cambios editoriales de producción, validar dentro de la transacción con `readCatalog`/`checkCatalog` o SQL equivalente de orden, jerarquía, referencias e idiomas. Si falla, revertir. Preservar IDs de tarjetas y descendientes, fechas, notas y referencias. No reordenar tarjetas como efecto secundario de ordenar intereses.
- Después de cambios de código o catálogo, exigir HTTP 200 y catálogo válido en `/api/catalog`, además del resultado solicitado. `/api/health` y estado live de Render no bastan.
- Un fallo de DNS de la shell no prueba que producción esté caída. Usar cliente HTTP autorizado o navegador para el GET real. SQL de Supabase sirve para inspección de datos, no sustituye verificar la respuesta pública.
- Si fallan CI, merge, deploy o comprobación funcional, informar con enlace, causa y siguiente acción; corregir o revertir antes de declarar el incremento terminado.
- Si fallan metadatos Git fuera del sandbox, repetir la operación autorizada con permisos elevados; no cambiar índices ni permisos como sustituto. No abandonar un hito sin intentar esa vía.
- Registrar por incremento: branch/PR, commit integrado, revisión independiente, comandos y resultados, commit de Render verificado, estado de catálogo y prueba funcional. No registrar secretos ni datos personales.

## Estado de revisión y ejecución

1. Dos agentes Luna/Alto han revisado el borrador en dos rondas. Se han incorporado sus correcciones técnicas sobre acceso a borradores, recuperación de sesiones, algoritmo por niveles, activación de APIs y tamaño/dependencias de las entregas.
2. El usuario ha autorizado ejecutar el plan y su entrega completa después de una revisión Astra, resolviendo autónomamente los problemas salvo decisiones cruciales. También ha autorizado Sol para diseño/UI/UX cuando sea necesario.
3. Astra confirma que el incremento 04 no tiene bloqueo y puede empezar mientras se cierran sus observaciones técnicas sobre los siguientes incrementos.
4. Revisión Astra cerrada: incorporados recuperación por todas las rutas y reconciliación cliente, locks por cuenta, rollout compatible de cancelación, snapshot mínimo de idiomas, disponibilidad de Descubrir en servidor, cierre previo del premio, RLS y puerta visual comparada con Repasar. No ha requerido nuevas decisiones de producto.
5. Astra ha vuelto a leer la versión corregida y confirma que no quedan bloqueos del plan. Se inicia la secuencia operativa por 04.

| Incremento | Estado de entrega | Evidencia |
| --- | --- | --- |
| 04 | Producción verificada | PR #113, main `1a4e548`, Render `dep-dbgj40oae00c73bmshog` live; 375 pruebas locales/CI, HTTP 200 y catálogo válido tras deploy. |
| 03 | Producción verificada | PR #114, main `9c6ba47`, Render `dep-dbgj8e29lscs73bd24r0` live; 378 pruebas completas. Catálogo HTTP 200 válido y módulo servido idéntico con comprobación determinista correcta. |
| 01a | Producción verificada | PR #115 y #116; main `519f882`, Render `dep-dbgtrh29lscs7393u87g` live. 389 pruebas completas, revisión independiente Luna/Alto y smoke local real. Supabase esquema 34/RLS/índice correctos, catálogo HTTP 200 válido y módulos servidos idénticos con guardas comprobadas. Recuperación automática aún apagada. |
| 01b | Producción verificada | PR #117; main `d418f71`, Render `dep-dbh299dckfvc73b3lmn0` live. Suite CI incluida la prueba PostgreSQL real y suite principal de main correctas. `/api/catalog` responde con catálogo válido: 26 libros, 7 intereses, 47 barajas, 377 tarjetas. |
| 05 | Producción verificada | PR #118; main `e6a00c0`, Render `dep-dbh2bth42hec73evmp50` live. CI y suite combinada correctas; catálogo público conserva 26/7/47/377 y devuelve emoji/color para los 7 intereses. Revisión Sol/Luna y QA visual local en escritorio/móvil. |
| 06 | Producción verificada | PR #119; main `68f5210`, Render `dep-dbh2la5ckfvc73b4bcgg` live. Suite con build: 413 pasan, 0 fallos y 1 omitida; revisión Luna aprobada. QA local comprobó bloqueo sin interés y creación manual sin usar IA; catálogo público válido después del despliegue. |
| 07 | Producción verificada | PR #120, main `a9db032`, Render `dep-dbh2sufb9u1s73e82ck0` live. CI pasó; `/api/catalog` HTTP 200 con `schemaVersion: 6`, 26 libros, 7 intereses, 47 barajas y 377 tarjetas. Orden persistido y conteo/conjunto de asociaciones conservados. |
| 08 | Producción verificada | PR #121, main `9def6a6`, Render `dep-dbh31urbc2fs738gf8fg` live. CI y suite local (419 pasan, 0 fallos y 1 omitida); revisión independiente Luna sin hallazgos. `/api/catalog` HTTP 200, esquema 6, 26/7/47/377 y los 13 órdenes coinciden; asociaciones y referencias válidas, máximo de tres respetado. |
| 09 | Producción verificada | PR #122, main `20aa6d5`, Render `dep-dbh3eep42hec73f1kssg` live. Suite completa: 431 pasan, 0 fallos y 1 omitida; revisión independiente Luna y QA ES/EN, teclado, móvil y comparación con Repasar. Selector mantiene el orden de clic y el catálogo cumple el límite de uno a tres. |
| 10 | Producción verificada | PR #123, main `9d68168`, Render `dep-dbh3r6p7lnhs738iuc6g` live. Suite completa: 436 pasan, 0 fallos y 1 omitida; revisión independiente Luna. Migración aditiva, orden reciente estable y fallback histórico sin fechas inventadas; catálogo HTTP 200 válido. |
| 11 | Producción verificada | PR #124, main `4d88ae8`, Render `dep-dbh47pq9bbkc73b3dohg` live antes del incremento 02. Suite completa: 444 pasan, 0 fallos y 1 omitida; orden A–Z localizado y preferencia persistida para cuentas y visitantes. |
| 11a | Producción verificada | PR #127; Render pasó a compilar UI en vez de ejecutar el runner Docker mediante PR #129 (`f610d64`), deploy `dep-dbh6du7avr4c73f1s59g` live. Suite local/CI con PostgreSQL: 464/464, sin omitidas; catálogo HTTP 200 válido. |
| 12 | Producción verificada | PR #128; preferencias privadas ordenadas, revisión optimista y conflicto 409 recuperable; migraciones SQLite 48/PostgreSQL 40, RLS y cierre inicial sin premio. Desplegado con PR #129; sin UI ni cambios de saldos. |
| 13 | Producción verificada | PR #130, main `41ebdca`, Render `dep-dbh6n18u01pc738a79p0` live. Perfil público con dos listas ordenadas; edición solo del propietario. Suite CI/local 464/464; revisión Luna sin hallazgos y QA Sol en escritorio 1422×768 y móvil 390×844. `/api/health` y `/api/catalog` HTTP 200; 26 libros, 7 intereses, 47 barajas, 377 tarjetas y referencias/órdenes válidos. |
| 14 | Producción verificada | PR #131; main `0fc2010`, Render `dep-dbh6sitckfvc73bfg86g` live. Suite completa con PostgreSQL real: 468 pasan, 0 fallos y 0 omitidas. `/api/health` y `/api/catalog` responden 200; catálogo válido (27 libros, 7 intereses, 47 barajas, 377 tarjetas crudas, 202 preparadas). |
| 15 | Producción verificada | PR #132; main `b7c9676`, Render `dep-dbh7dodg1s2s73fikrig` live. Suite local/CI: 477 pasan, 0 fallos, 0 omitidas. `/api/health` HTTP 200; `/api/catalog` HTTP 200, schemaVersion 7, 27 libros, 7 intereses, 47 barajas, 377 tarjetas y 0 errores de referencia/orden. Revisión Luna/Sol sin hallazgos; QA visual escritorio/móvil y estados accesibles. |
| 17a | Producción verificada | PR #133; main `006bf2e`, Render `dep-dbh7heg473hc73assea0` live. Suite 474/474; `/api/health` y `/api/catalog` 200; catálogo válido, 27 libros, 7 intereses, 47 barajas, 377 tarjetas y 0 errores de referencias. Gate apagado. |
| 18 | Producción verificada | PR #134; main `781fe16`, Render `dep-dbh7kgnb9u1s73anb1lg` live. Suite PR 488/488; API de salud y catálogo HTTP 200, schemaVersion 7, 27/7/47/377, 0 referencias inválidas. Gate global apagado. |
| 17b | Integrado; producción pendiente de verificación | PR #135, main `7c12df9`; CI pasó, suite local tras rebase 493/493. Aviso para Para leer/Leyendo/Leído ES/EN; gate de activación sigue apagado. |
| 20 | Verificado localmente; prueba tras última rebase pendiente | Preferencia de idiomas en perfil/Repasar rebasada tras 15/17a/18/17b; secuencia SQLite 48→49→50, PostgreSQL 40→41→42, Supabase ordenada. Revisión Luna sin hallazgos. |
| 02 | Producción verificada | PR #125, main `1688597`, Render `dep-dbh5g8j39bnc73aa3360` live. Suite completa: 450 pasan, 0 fallos y 1 omitida; revisión independiente Luna/Alto. `/api/health` y `/api/catalog` HTTP 200, catálogo válido (schemaVersion 7, 26 libros, 7 intereses, 47 barajas, 202 tarjetas) y módulo servido idéntico al commit. |
