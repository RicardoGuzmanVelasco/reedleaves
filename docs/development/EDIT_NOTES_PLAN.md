# Plan: editar y reorganizar notas

Estado: borrador para revisión. Una nota es una `card` (`server/author-repository.mjs`, `takeNote`). Hoy solo se crea; los triggers congelan el borrado en barajas terminadas y no existe ruta para editar ni borrar.

## Por qué hoy son inmutables (deducido del código)

Crear o terminar evita decidir a la vez:

- Moderación: las guías ya pasan por revisión; editar plantea si reabre la revisión.
- Identidad del contenido: votos (`card_votes`), XP por «me gusta» y guardados apuntan a un texto concreto.
- Referencias: `card_saves`, `practice_answers`, `practice_session_cards`, `card_views`, `daily_ideas` y enlaces `#card/…`.
- Orden y jerarquía: posiciones `1..N` consecutivas y descendientes (`parent_id`).
- Idiomas: la nota solo tiene texto en el idioma de la baraja.
- Caché: el catálogo usa ETag; no hay `updated_at` por tarjeta.

## Principio

Separar estructura (padre y orden; el texto no cambia) de contenido (el texto cambia). Entregar de menos a más riesgo.

## Fase 0 — Vista de gestión de baraja

Preparación: sin ella, las fases 1–2 no tienen dónde vivir. Leer `docs/frontend/DESIGN.md` antes de tocar la interfaz. Principio: quitar antes que añadir. Todo en tres pasos, en este orden.

Decisiones tomadas:
- «Terminar» se queda como está. Hoy hace cuatro cosas: cierra la baraja (sin notas nuevas ni borrado), publica sus ideas raíz para la idea del día, saca el libro de Inicio y hace que el «+» cree otra baraja. Quitarlo es una decisión aparte, más adelante.
- Una baraja personal la ve, la añade al Tarjetero y la repasa cualquiera; «Terminar» no protege el repaso.
- El diálogo de cierre al marcar «Leído» se queda: termina las barajas con notas y borra las vacías.
- Editar el texto no rompe ninguna tabla (repasos, guardados y votos van por `card_id`); el riesgo es solo editorial.

### 0a — Bug del router (hecho, sin probar)

`#deck/<id>` abría siempre la hoja de la primera nota cuando la baraja nacía del «+» de Inicio, porque baraja y nota comparten id (`app/reader-app.mjs`, ruta `deck`). Ahora gana el id de baraja; el atajo antiguo `#deck/<idDeTarjeta>` solo se aplica a ids que no son de baraja. Pendiente: comprobarlo en la app.

### 0b — Fusionar pantallas (hecho, sin probar)

Hecho en código: `authorView`, la acción `author-deck`/`inspect-card` y los botones «+ hija» por nodo desaparecen; `#author` redirige a `#deck`; «Tomar nota» dentro de una nota vive en su hoja; abrir una nota de una baraja en borrador que puedes escribir no pasa por `/api/reader/open` (sin efectos de Tarjetero). Pruebas y CSS ajustados; no ejecutadas. El contexto de visualización `author` del servidor (`recordCardView`) queda sin uso en el cliente: limpiar después con sus pruebas.

- Una sola pantalla de baraja (`#deck/<id>`), sin modo de gestión. Desaparecen `authorView` y `#author`, que redirige a `#deck` (sin alias). Cinco puntos de entrada a `#author` en `app/reader-app.mjs` y sus pruebas deben migrarse.
- Tocar una nota abre la hoja de la nota. Quien puede editar esa nota ve además sus acciones: tomar nota dentro; después cambiar de padre y editar (fases 1–2). Los botones «+ hija» por nodo desaparecen.
- Acciones solo para quien corresponde: dueño con baraja en curso → ajustes plegados (título, idioma, colaboradores) y «Terminar baraja»; quien puede aportar → «Tomar nota» con texto.
- Los permisos los decide el servidor; la interfaz solo los refleja.
- Sin copy nuevo salvo aprobación.

### 0c — Quitar información de la vista de baraja

Hecho (1, 2, 3, 4, 5, 6, 8): idioma, título y colaboradores dentro de «Información de la baraja»; sin chip de estado en la baraja personal propia en curso; contador «N tarjetas» hasta cerca del tope; alternador y filtro desde 6 tarjetas. Pendiente: el punto 7 (atribución en la hoja) y ver el resultado en la app.

Medido en móvil: el árbol empieza al 73 % de la pantalla, tras ocho bloques. Quitar o mover, en este orden:

1. Selector «Idioma de la baraja» (ya sale en el meta): a los ajustes plegados.
2. Chip «Baraja en curso» y su frase explicativa, en las propias.
3. «Cambiar nombre de la baraja» como texto grande: a los ajustes.
4. «Ver baraja →»: desaparece con la fusión.
5. Contador «N de 25 tarjetas», salvo en colectivas.
6. Botones «+ hija» repetidos por nodo, con el mismo icono: a la hoja de la nota.
7. Fila de usuario en la atribución de la hoja cuando la nota es propia.
8. Alternador Árbol/Previsualización y filtro Todas/Citas con pocas notas (hipótesis; comprobar el umbral).

Hacerlo sobre la vista ya fusionada, no antes.

## Interfaz nueva (`?ui=2`)

Decisión: rehacer la interfaz de notas y barajas desde cero, a partir de mockups (flujo D, alternativa A: esquema de notas con hoja de acciones; una sola pantalla de baraja). Las pantallas nuevas conviven con las viejas tras un parámetro de URL (`?ui=2`); no hay endpoints `/api` nuevos, solo vistas.

- Iconos nuevos: inventario de los actuales y propuesta por icono. Estilo: muy redondeado, trazo grueso, perspectiva cuando proceda (referencias: pila de tarjetas redondeadas y el símbolo `rectangle.on.rectangle.angled` de SF Symbols, con rectángulos superpuestos en ángulo).
- Familia de iconos aprobada (47 SVG en `app/assets/icons/ui2/`, con su README): `+` para toda alta, lápiz para toda edición, pilas rectas para barajas y tarjetas en ángulo para notas y repaso, activo con contorno más relleno suave, términos del glosario (`practice`, no `review`). Al terminar el cambio de interfaz, esa carpeta pasa a ser el conjunto único.
- Condición de cierre: cuando estén todas las pantallas nuevas, se activan para todos y se borra de una vez todo lo viejo (vistas, CSS, pruebas, reglas de `DESIGN.md`, el parámetro). Sin variantes sin fecha.
- Renombrado en el mismo cierre: `app/ui2/` pasa a ser el módulo normal; las claves `ui2…` de `app/i18n.mjs`, las clases `.ui2-…`, el atributo `data-ui2-*` y `app/assets/icons/ui2/` pierden el prefijo. «ui2» no puede sobrevivir al cierre.
- Al cierre se borra la opción “Probar la nueva UI” de la UI vieja junto con el parámetro.
- Fuera del interruptor, y por decidir una a una: quitar «Seleccionadas» con límite por colaborador, idea del día como opción explícita al terminar, repasar una instantánea de barajas ajenas en curso, no cobrar hoja por la baraja propia, etiqueta para «terminada».
- Las fases 1–2 (servidor) no dependen de la interfaz y pueden avanzar en paralelo.
- Por evaluar al terminar todas las pantallas (transversal): subir a la cabecera de la app lo que se está viendo (nombre del libro o de la baraja), sustituyendo temporalmente la chapa del perfil. El hueco de la cabecera está muerto en la mayoría de pantallas y el perfil se visita poco.
- Principio de las pantallas de baraja y tarjeta: pesa más el libro que la baraja (título del libro prominente; enlaces de libro y autor con estilo propio, como el enlace de usuario).
- Por explorar: quitar del tarjetero una baraja propia (hoy no está pensado).
- Pendientes de la página de baraja ui2 (diseño aparte): vista de tarjetas (D6/D7, delegada a su propio diseño), pantalla «Editar baraja» (lápiz de la cabecera; ahí vive «Guardar», idioma, colaboradores, título) y price tags nuevos (propuestas en `pricetags-v1`, por decidir).

## Fase 1 — Reorganizar dentro de la baraja

- Cambiar padre y orden. No toca votos, XP, moderación ni idiomas.
- Una transacción que reordene origen y destino con posiciones `1..N`; posiciones temporales por los índices únicos.
- Impedir ciclos; operación idempotente.

## Fase 2 — Corregir el texto

- Solo el autor, y solo en barajas personales (`contribution_policy='owner'`), también si están terminadas.
- Quedan fuera las barajas colectivas y las guías de lectura (tienen su flujo).
- Votos y XP no se tocan (la XP es por crear).
- Añadir `updated_at` a la tarjeta; comprobar si el ETag actual basta sin él.
- Sin marca visible de «editada» por ahora.
- Editar es posible aunque la baraja esté terminada: no depende de «Terminar».
- Pendiente de confirmar: exclusión de las colectivas y ausencia de marca visible.

## Fase 3 — Mover entre barajas y partir barajas

- El texto debe existir en el idioma de la baraja de destino; se arrastran los descendientes.
- Conservar IDs, contenido, fechas y referencias; reordenar origen y destino en la misma transacción.
- Decidir qué pasa con guardados, votos, repasos y la idea del día.

## Fase 4 — Borrar

- Fuera del plan por ahora: referencias en cascada y sesiones de repaso a medias. Nadie lo ha pedido.

## Estado de la interfaz nueva (2026-11-18)

- En `Staging` con `?ui=2`: Home, Tomar nota (B y C), Repaso, Biblioteca (Estantería, Tarjetero, hoja del libro, «Leído», vacíos), Librería y ficha del libro, página de baraja, componente de price tag (`app/ui2/price-tag.mjs`, V1+), Perfil propio y ajeno (`app/ui2/perfil.mjs`), Ajustes (`app/ui2/ajustes.mjs`: idioma, idiomas de las tarjetas, portadas tintadas, comentarios y cerrar sesión con confirmación), Acceso (`acceso.mjs`: entrar, crear cuenta, consejo de crear cuenta tras credenciales erróneas, sesión caducada), elección de intereses del alta y su edición desde el Perfil (`intereses.mjs`, sobre `initial-interests.mjs`), carga inicial con brote dormido y botón «Echar un vistazo / por la librería» en Inicio vacío.
- Diseñadas sin implementar (mockups en el scratchpad de la sesión; no versionados): Sesión de práctica, Formularios y diálogos (aviso de interés, Catalogar nuevo libro, Crear baraja, saldo, red), Terminar baraja y «Leído» (flujo E), Barajas ajenas, perfil ajeno y Social (flujo F).
- Por diseñar: vista de tarjetas (D6/D7). Social se descarta de este plan y se diseñará aparte, completo y nuevo.
- Copy: «nota sin guardar» queda obsoleto; es «nota en borrador» (glosario actualizado; los textos de `i18n.mjs` con «sin guardar» se normalizan al implementar flujo E).
- Barajas propias: en curso, el primary es «Editar» (Compartir secundario); al terminar, «Editar» desaparece y Compartir pasa a primary. Chip de idioma: solo bandera, sin etiqueta.
- Callout de guía de lectura: aparece siempre que un libro leído no tenga guía escrita por la persona, hasta que la escriba. Explorar premio de experiencia: prize tag con medallón de nivel sin número (no hay icono de XP).
- Escribir guía de lectura: pantalla ui2 (`app/ui2/guia.mjs`, ruta `#guide/<libro>`): callout verde con «Ver ejemplos» si hay guías ajenas, mínimo de caracteres (`READING_GUIDE_MIN_LENGTH`, servidor y cliente), pendiente con prize tag de XP, rechazada con motivo, aprobada con «Leer tarjetas». Las guías de un libro son una baraja especial que se abre directo en el carrusel, sin lista. Pendiente: que ese carrusel y «Leer tarjetas» dejen de abrir la UI antigua al diseñar la vista de tarjetas.
- Revisar después el estilo de booklink y authorlink para unificarlos y comunicar mejor que son enlaces.
- Sin sesión, «Echar un vistazo por la librería» abre la Librería de la UI vieja (la de ui2 exige sesión); decidir si ui2 tendrá Librería de visitante. Tras guardar los intereses del alta, el saldo se actualiza sin la animación de recibo de la UI vieja.
- Perfil ajeno: «Ver estantería» aún abre la Estantería de la UI vieja.
- Pendiente técnico: «Catalogar nuevo libro» y «Leer tarjetas» aún abren la UI vieja; el toast «Baraja añadida al tarjetero.» no cruza esa navegación; aviso de interés (`confirmationRequired`) sin diálogo ui2.
- Transversal: revisar discrepancias de callouts y unificar: mismo icono y color por significado (error, warning, consejo) en toda la app.
- Chips de interés: el estilo quedó unificado en ui2 (`app/ui2/interest-chip.mjs`, clase `.int-chip`: propuesta B, relleno liso, borde y sombra del tono oscuro, prioridad en insignia de esquina; estados por defecto, prioridad, bloqueado ✓, rechazado ×, deshabilitado, con texto o solo emoji). Lo usan la ficha del libro, Catalogar libro y el Perfil. La UI vieja conserva sus variantes hasta que se borre al cierre.
- Errores de conexión, servidor o red: una sola pantalla superpuesta (fondo negro muy translúcido, brote triste grande y centrado, texto del error en callout rojo, botón «Reintentar»; al reintentar vuelve el brote dormido o el estado que toque). Nunca dentro de formularios. Las validaciones por campo se quedan en el campo.
- Actividad final, justo antes del cierre y de solidificar la ui2: revisar qué identidad visual se ha perdido en los estilos de ui2 (p. ej. el verde claro degradado de fondo en la elección de intereses o en Repaso) y decidir de forma consciente si perderla nos sirve o si se mantiene de algún modo.
- Editar baraja (mockup v2 en curso): las barajas terminadas no se pueden editar ni corregir; el aviso de «Terminar baraja» debe decirlo claro. Borrar nota entra en el editor, así que `NEW_NOTE_XP` deja de ser seguro (crear y borrar para ganar XP): pensar el sistema de experiencia desde producto antes de implementarlo. Quitar «Corregir» y «Colocar debajo de» de la hoja de nota de la página de baraja (un solo sitio para cambiarla). Arrastrar en el editor reordena y reubica (cambia de madre o pasa a raíz).
- Borrar nota = soft delete: la tarjeta se marca borrada (no se elimina la fila); guardados, valoraciones, vistas y repasos conservan la referencia. Sale de árboles y sesiones nuevas; `#card/…` y guardados la muestran con icono de papelera y el aviso «La nota de esta tarjeta ha sido borrada de su baraja» (texto exacto al rediseñar la vista de tarjetas). Las hijas no movidas se borran con ella. Citas como madre: permitido.
- La baraja personal propia en curso no tiene página: `#deck/<id>` redirige a `#edit/<id>`, que incluye Compartir (enlace de lectura `#preview/<id>`, sin `?ui=2`), Leer tarjetas y Terminar baraja; al terminarla (o si otra sesión la termina, 409 `deckReadOnly`) se sustituye por su página. La página queda para barajas terminadas, ajenas o colectivas.
- Editar baraja implementado (mockup `editar-baraja-v2`): `app/ui2/editar-baraja.mjs`, ruta `#edit/<baraja>`, arrastre en `app/ui2/edit-drag.mjs` (y teclado en el asa). Servidor: `editNote` con tipo y madre, `moveNote` (`/api/author/notes/move`, sustituye a `place`), `deleteNote` (borrado suave, `cards.deleted_at`, esquema SQLite 70 / PostgreSQL 62) y `changeDeckDescription`; todo solo en barajas personales en curso (409 `deckReadOnly`). `NEW_NOTE_XP` retirado. Pendiente: lista de guardadas de la UI vieja (oculta las tarjetas borradas; el enlace `#card/…` sí las muestra) y el aviso definitivo al rediseñar la vista de tarjetas.
- XP en ui2: `observeXp` y `xpFeedback` (`app/ui2/index.mjs`) son el enganche de la animación de ganar experiencia y se conservan aunque hoy ninguna ruta del servidor les mande `xpReward`; no borrarlos como código muerto. Se usarán al diseñar de dónde sale el XP.
- Vista de tarjetas (mockup `tarjetas-v1`: A Mazo, B Hilo, C Inmersiva): se iteran las TRES por separado hasta pulirlas; la intención es usarlas como layouts distintos según el contexto y, más adelante, dejar que el lector elija. Las modificaciones de la v2 las aporta el dueño.
- Vista de tarjetas C (inmersiva) implementada en ui2: `app/ui2/tarjetas.mjs` (datos y marcado) y `tarjetas-gestos.mjs` (arrastre y hojitas). Rutas `#preview/<baraja>[/<tarjeta>]` (también `/carousel`) y `#card/<id>`; «Leer tarjetas» (página, editor, guía aprobada) y «Ver ejemplos» ya no salen a la UI vieja. Los enlaces compartidos siguen sin `?ui=2`. Cada tarjeta mostrada cuenta como vista (`/api/reader/view`, contexto `practice`). Pendiente: B (barajas propias en curso), ajuste de preferencia de layout, acceso a las guías desde la ficha del libro ui2.

## Pendiente tras la vista de tarjetas inmersiva (2026-11-21)

- Vista de tarjetas: C inmersiva implementada (`app/ui2/tarjetas.mjs`, `tarjetas-gestos.mjs`; rutas `#preview/<baraja>[/<tarjeta>]` y `#card/<id>`). Falta: layout B «Hilo» (baraja propia en curso; spec `tarjetas-v2-b`), ajuste de preferencia «Forma de leer las tarjetas» (Inmersiva / Lista, por defecto Automático; en Ajustes), y decidir si A se construye (hoy, reserva).
- Reparto aprobado: «Leer tarjetas» de baraja terminada/ajena, guías y `#card` → C; baraja propia en curso → B; Repaso (futuro) reutiliza el contenido de C sin la barra (la valoración ahí no puede ir por swipe lateral).
- Por probar en la app real: flujo de visitante (valorar/guardar → Acceso → retoma), copia al portapapeles al compartir, aviso de interés al guardar.
- Acceso a las guías desde la ficha del libro en ui2 (hoy solo por el editor de guía).
- Los enlaces compartidos (`deckShareUrl`, `cardShareUrl`) no llevan `?ui=2` y abren la ui2 (también los antiguos con `?ui=2`).
- Decisión abierta de C: gestos verticales (hoy abajo = profundizar, arriba = volver; se recomienda probar la dirección contraria con 3–5 personas).
- Compartir baraja desde la vista de tarjetas: no; solo compartir tarjeta (la baraja se comparte desde su página o el editor).
- Sesión de práctica, pantalla completa de la nota (F6), editor de intereses en ui2 y sistema de XP (de dónde sale la experiencia; conservar `observeXp`/`xpFeedback`).
- Cierre: borrar la UI vieja y el prefijo `ui2`, quitar «Probar la nueva UI», `.library-tabs`, normalizar copy con nombres de sección en mayúscula, etc.
- Tests: `app/ui2/*.test.mjs` entran en `npm test` y en la CI (`TEST_FILES` de `scripts/test-postgres.mjs`). Son los que se quedan al retirar la UI vieja; en el cierre se borran los tests de la UI antigua, no estos.
- Tarjetas, por mirar después: choque visual libro–título (`tarjetas-titulos-v1`, recomendación S1 antetítulo en versalitas, S3 como variante), tono verde de los botones de A / verde de Repaso como fondo, A y B por construir sobre `app/ui2/tarjeta.mjs`.

## Repaso: decisiones (2026-11-24)

- Se retira «Ver más / menos a menudo» (herencia de dating app). Sin «Continuar»: navegación de la vista C (tocar o deslizar).
- Hito 1: sesión completa en ui2 sin pruebas. Cada tarjeta se marca como vista (valor neutro en `practice/answer`; las respuestas antiguas se conservan). Selección sin peso (solo diversidad de libros y barajas). Se completa al llegar a la última tarjeta.
- Hito 2: pruebas en algunas tarjetas (ocultar título, cuerpo…). Swipe «me acordaba / no me acordaba» solo en ellas; «no me acordaba» pesa en la selección.
- Abiertas: cancelar con reembolso, XP y racha, pantalla final, puntos de entrada, precios. Detalle en `reedleaves-mockups/repaso-propuesta.md`.
- Sin cancelar sesión: queda a medias y se reanuda (no hay reembolso).
- Selección y recompensa son partes distintas y desacopladas en el código. Selección: decide qué tarjetas entran (hasta cinco; si hay menos, menos). Recompensa: 25 XP al terminar el repaso, siempre, también con menos de cinco tarjetas. Invariante: un tema que no llega al mínimo de tarjetas no se puede lanzar.
- Mínimo para lanzar un repaso: 5 tarjetas (siempre cinco). Racha: las dos opciones que cuentan lo hacen al completar.
- Pantalla final del repaso: sofisticada, al estilo de otras apps del género, con toda la información de progreso (la propone el diseño UI/UX). El progreso de experiencia no se ve hasta salir de esa pantalla; salir vuelve a la pestaña Repaso. Sin «otro repaso» desde dentro.
- Sesión a medias: no se puede empezar otro repaso hasta terminar el actual (el servidor ya lo impone con `one_active_practice_session`). La pestaña Repaso muestra arriba «Continuar repaso» (animado, con CTA e información útil) y debajo, en gris y sin poder pulsarse, los contenedores de repasar y descubrir hasta terminarlo. Hint o toast al pulsar los grises: lo propone el diseño UI/UX.
- Entrada al repaso: solo desde la pestaña Repaso. Hito futuro: «Repasar esta baraja» desde la página de la baraja.
- Contexto de la tarjeta madre en el repaso: se ve y no saca de la sesión. Al pulsarlo sale un modal que invita a guardar la tarjeta o a añadir su baraja al tarjetero para repasarla después, con tres botones: guardar tarjeta (icono), añadir baraja al tarjetero (icono) y, a la izquierda, un descarte tipo «Me lo he pensado mejor…». Copy exacto: lo propone el diseño UI/UX.
- Progreso del repaso: segmentos arriba, estilo stories (cinco, como en la vista C).
- Economía (oferta diaria real, precio del tema pagado con hojas): no se toca en el hito 1; se aborda después.
- Hito 3 del Repaso (onboarding): pista de swipe la primera vez (una vez por usuario), junto al resto de onboarding.
- Modales: usan primary/secondary de siempre; los estilos marcados quedan reservados a tarjetas y repaso. El modal de la madre queda con dos botones primary en fila (guardar tarjeta, añadir al tarjetero) y solo cierre; sin «Me lo he pensado mejor».
- Pantalla final: sin chip de tema, sin fichas de XP/racha/tarjetas; +25 XP con prizetag; «Volver». Progreso de mascotas (hoy en modal) a integrar aquí; decisiones de nivel, mascota y racha pendientes del diseño UI/UX.
- Título del libro en la vista inmersiva y el repaso: hasta dos líneas, con tratamiento unificado.
- Pendiente al final: el azul de cita es un doble código de color; revisarlo.
- Hito 1 implementado en ui2 (`app/ui2/repaso-sesion.mjs`, ruta `#practice/session`): «Continuar repaso» y temas en gris con toast, entrada con mazo, sesión inmersiva con segmentos y disolver, modal de la madre, final con miniaturas, crecimiento de mascotas y racha al volver. Servidor: respuesta neutra `view` (no toca `practice_answers`), selección sin peso, siempre cinco tarjetas (también «La baraja del día»), notas borradas fuera de sesiones y de la reparación, 25 XP al completar (`PRACTICE_COMPLETION_XP`) y «La baraja del día» cuenta para la racha al completarse, no al empezar.
- Arreglos (2026-11-25): «Entre las novedades» siempre disponible: toma las ideas (sin citas ni borradas) de los `NOVELTY_BOOKS` libros más recientes del catálogo (orden «Más recientes»), sin depender de lo que el lector conoce; la selección reparte entre libros y barajas. Tras una sesión, los precios de Repaso se ocultan hasta releerlos y entran con «pop» (más fuerte el descuento y el de hojas). «¡Prueba!» dura 5,2 s y un toque la cierra, con 500 ms de guarda tras mostrarse y tras cerrarse (`introTap`).
- Mazo de entrada: SÍ aporta. `practice/start` sale al mostrar el mazo y corre en paralelo (8 ms en local; en producción, la latencia de PostgreSQL remoto con bloqueo y lectura del catálogo); la primera tarjeta espera a las dos cosas. Se mantiene con la animación de la v1 adaptada: nueve reversos se apilan desde una torre, se «corta» y salen los cuatro sobrantes, y se voltea el de arriba.

## Repaso hito 2: pruebas (diseño, 2026-11-24)
- Prueba = tipo + tarjeta + definición. Resultado `passed`/`failed`; el tipo fija si es `self` (swipe «me acordaba / no me acordaba») o `auto` (la evalúa el servidor, p. ej. preguntas futuras). Sin columna `assessed_by`: el tipo lo implica.
- Tipos iniciales: `hideTitle` y `hideContent`. Las citas no llevan prueba. Futuro: preguntas de elegir respuesta (`auto`).
- Una tabla de definición por tipo: `card_test_hide_title`, `card_test_hide_content`, clave `(card_id, language, fragment)`, cascada con la tarjeta. Cada fila oculta todas las ocurrencias del fragmento (sin mayúsculas, palabra completa). Fragmento vacío = campo entero y no se mezcla con otros. Debe haber al menos una ocurrencia; si deja de haberla, la prueba se descarta al servir.
- Las definiciones las cargamos nosotros (SQL desde el MCP) con validación estilo `checkCatalog`. Sin editor de autor. Futuro: los archivistas las crean ad hoc.
- `practice_results(id, user_id, card_id, session_id, kind, outcome, answered_at, local_day)`, solo se añaden filas, sin `CHECK` sobre `kind` (se valida en el registro del código). `practice_session_cards.test_kind` nula. Migración SQLite y PostgreSQL con esquemas históricos.
- Selección: al crear la sesión, tarjetas con definición válida, no cita y fuera de enfriamiento; todas llevan prueba con tope de 2 (sorteo si hay más); mínimo 0.
- Enfriamiento por prueba y tarjeta, en días locales de la fuente temporal centralizada: fallada, vuelve a ser elegible pasado mañana; acertada, a los 7 días. Constantes centralizadas.
- `failed` pesa en la selección de tarjetas; `passed` no. La recompensa no cambia (25 XP al completar).
- Registro por tipo en código: tabla, validación, interfaz y evaluación. API self: `{sessionId, cardId, outcome}`; auto: el cliente manda la elección y el servidor calcula el resultado.
- Retirada de «ver más / menos a menudo» en el cierre de la UI v1: botones, valores `see_less`/`see_more` del endpoint y su `CHECK`. `practice_answers` queda como histórico; decidir al cierre si se borra.
- Selección de pruebas: módulo pequeño y aislado (función pura: tarjetas elegibles, resultados previos y hora entran; lista de pruebas sale). Sin acoplarla al resto de la sesión, para cambiar la regla a futuro tocando solo ese módulo.
- Implementado (servidor, 2026-11-25): migración SQLite 71 / PostgreSQL 63; registro `server/practice-test-kinds.mjs`; selección pura `server/practice-test-selection.mjs`; peso de `failed` (×2 si el último resultado de la tarjeta es `failed`) en `server/practice-card-weights.mjs`; constantes de días y enfriamiento en `app/daily-cycle.mjs`. La sesión trae `tests: {cardId: {kind, fragments, outcome?}}`; resultado en `POST /api/reader/practice/test-result` `{sessionId, cardId, outcome}` (tarjeta actual, una vez) y después `practice/answer` `view`. Comprobador `checkCardTests` (`npm run db:check-tests`). UI implementada (2026-11-25, mockup repaso-pruebas-v2): `app/ui2/repaso-pruebas.mjs` (tapas, respuestas, entrada «¡Prueba!», cuentas de segmentos) y flujo en `app/ui2/index.mjs`; la tarjeta con prueba solo se marca vista al responder. Copy [PROPUESTO] en `app/i18n.mjs`.

## Siguiente hito de pruebas: ocultar lo del título también en el cuerpo (2026-11-25)
- Falta una forma de que lo que se oculta en el título se oculte también en el cuerpo cuando el cuerpo usa derivadas, singular/plural o sinónimos (la coincidencia actual es por palabra completa). Se aborda junto a las preguntas de elegir respuesta.
- Casos de partida (descartados del primer lote por esta fuga; no deben quedar descartados): «Rechazo y Retirada» (título tapado deja «rechazado»), «Proponles algo que perder» («perdido»), «Pensamientos y acciones como destino» (singular), «Enlazamiento de hábitos» («enlaza»), «Stocks» («stock»), «X-as-a-Service» («service»), «Feeling» («feel»), «Clarify the Decision» («the choice»).
- Carga inicial en producción: definiciones del primer lote revisadas por el usuario (archivos en reedleaves-mockups/pruebas-propuestas*.json, fuera del repo). Una definición por tarjeta y tipo: una segunda prueba del mismo tipo en la misma tarjeta no cabe en el modelo actual.

## ui2 como única UI visible (2026-11-25)
- `startReader` (`app/reader-app.mjs`) monta siempre la ui2, con o sin `?ui=2`; ningún parámetro, ruta ni enlace abre la UI vieja. Su código sigue en el repo, inaccesible (`startLegacyReader`), hasta decidir su retirada; el prefijo `ui2` se mantiene.
- Quitado «Probar la nueva UI» (y su clave `tryNewUi`). Los enlaces de libro de Inicio, Biblioteca y Librería ya no salen a la UI vieja (`c.legacy` retirado): van a `#book/<id>` de la ui2.
- `#bookstore/book/<id>` (enlace viejo) abre la ficha ui2 del libro. El resto de rutas solo de la UI vieja abren Inicio sin aviso: `#library/<usuario>`, `#daily-idea[/…]`, `#guides/<libro>`, `#guide-preview/…`, `#saved/…`, `#mascots/…`, `#practice/empty`, `#bookstore/author/<autor>`. Una baraja o libro desconocido (`#deck/…`, `#book/…`) también abre Inicio.

## Pantallas que aún no existen en ui2 (toast Próximamente)
Acción `data-ui2="coming-soon"`: toast «Próximamente» / «Coming soon» (`ui2ComingSoon`) sin navegar.

| Ruta o acción | Dónde se origina | Qué falta |
| --- | --- | --- |
| «Ver estantería» de otro lector (antes `#library/<usuario>` de la UI vieja) | Perfil ajeno, sección Lecturas (`app/ui2/perfil.mjs`) | Estantería ajena de solo lectura en ui2 |

Revisado sin caso «Próximamente»: perfil ajeno, editor de intereses y página de baraja ya existen en ui2; la ficha completa de nota (F6) no tiene entrada en ui2 (la página de baraja abre la hoja de nota); Social sigue deshabilitado en la barra.
