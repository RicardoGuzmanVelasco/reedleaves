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
- Editar baraja implementado (mockup `editar-baraja-v2`): `app/ui2/editar-baraja.mjs`, ruta `#edit/<baraja>`, arrastre en `app/ui2/edit-drag.mjs` (y teclado en el asa). Servidor: `editNote` con tipo y madre, `moveNote` (`/api/author/notes/move`, sustituye a `place`), `deleteNote` (borrado suave, `cards.deleted_at`, esquema SQLite 70 / PostgreSQL 62) y `changeDeckDescription`; todo solo en barajas personales en curso (409 `deckReadOnly`). `NEW_NOTE_XP` retirado. Pendiente: lista de guardadas de la UI vieja (oculta las tarjetas borradas; el enlace `#card/…` sí las muestra) y el aviso definitivo al rediseñar la vista de tarjetas.
