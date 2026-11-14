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
- Acciones solo para quien corresponde: dueño en borrador → ajustes plegados (título, idioma, colaboradores) y «Terminar baraja»; quien puede aportar → «Tomar nota» con texto.
- Los permisos los decide el servidor; la interfaz solo los refleja.
- Sin copy nuevo salvo aprobación.

### 0c — Quitar información de la vista de baraja

Hecho (1, 2, 3, 4, 5, 6, 8): idioma, título y colaboradores dentro de «Información de la baraja»; sin chip de estado en la baraja personal propia en borrador; contador «N tarjetas» hasta cerca del tope; alternador y filtro desde 6 tarjetas. Pendiente: el punto 7 (atribución en la hoja) y ver el resultado en la app.

Medido en móvil: el árbol empieza al 73 % de la pantalla, tras ocho bloques. Quitar o mover, en este orden:

1. Selector «Idioma de la baraja» (ya sale en el meta): a los ajustes plegados.
2. Chip «Baraja en borrador» y su frase explicativa, en las propias.
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
- Familia de iconos aprobada (45 SVG en `app/assets/icons/ui2/`, con su README): `+` para toda alta, lápiz para toda edición, pilas rectas para barajas y tarjetas en ángulo para notas y repaso, activo con contorno más relleno suave, términos del glosario (`practice`, no `review`). Al terminar el cambio de interfaz, esa carpeta pasa a ser el conjunto único.
- Condición de cierre: cuando estén todas las pantallas nuevas, se activan para todos y se borra de una vez todo lo viejo (vistas, CSS, pruebas, reglas de `DESIGN.md`, el parámetro). Sin variantes sin fecha.
- Fuera del interruptor, y por decidir una a una: quitar «Seleccionadas» con límite por colaborador, idea del día como opción explícita al terminar, repasar una instantánea de barajas ajenas en borrador, no cobrar hoja por la baraja propia, etiqueta para «terminada».
- Las fases 1–2 (servidor) no dependen de la interfaz y pueden avanzar en paralelo.

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
