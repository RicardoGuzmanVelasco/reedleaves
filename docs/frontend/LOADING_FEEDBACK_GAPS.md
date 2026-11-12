# Huecos de feedback de carga y espera

Auditoría del 2026-11-11 sobre el lector (`app/reader-app.mjs`, `app/views.mjs`, `app/card-features.jsx`, módulos de intereses). Se hizo leyendo el código; no se verificó en pantalla. Las líneas son aproximadas y pueden moverse.

Estado de cada punto: **Pendiente** hasta que el usuario elija una opción. Los puntos 1–3 ya están resueltos (ver «Decisiones tomadas»). Este documento recoge opciones, no decisiones. Antes de implementar, leer `docs/frontend/DESIGN.md`.

## Reglas para resolverlos

- Copy: usar solo textos ya existentes (`loading`, `aiLoading`, `interestSortLoading`) o aprobados por el usuario. No inventar textos nuevos.
- Movimiento reducido: todo spinner o animación debe quedar estático con `prefers-reduced-motion`.
- Accesibilidad: cada espera visible necesita su equivalente en `role="status"` o en `#live`.
- Tiempo: si se añade un umbral («tarda más de lo normal», retardo antes de mostrar el indicador), centralizarlo en una constante única; no repetir números en vistas ni pruebas.
- Pruebas: comprobar contratos accesibles (`aria-busy`, `role="status"`, botón deshabilitado), no marcado incidental.

## Patrones disponibles

Referencias para las opciones de cada punto.

| Clave | Patrón | Ya existe en |
| --- | --- | --- |
| **A** | Botón en curso: spinner o puntos dentro del botón pulsado, `aria-busy="true"`, el resto de controles quedan deshabilitados. | `.spinner` en el autorrelleno del libro. |
| **B** | Capa de bloqueo suave: velo translúcido sobre `main` con Brote (mascota) y `role="status"`, solo si la espera supera el umbral. | Mascota dormida del perfil; `.opening-loading`. |
| **C** | Placeholder en la zona que carga: esqueleto o mascota pequeña con el texto existente, en lugar del contenido vacío o falso. | `profilePendingView`, `dailyLoading`. |
| **D** | Estado intermedio de dato: distinguir «cargando» de «vacío» o «cero» (guion, esqueleto o nada) hasta que llegue la respuesta. | `record.loaded` en `CardActions`. |
| **E** | Aviso de lentitud + reintento: tras el umbral, mostrar texto y botón «Reintentar»; al fallar, estado de error con salida. | `loadingView(failed)`, `sync-note` con reintento. |
| **F** | Navegación optimista: pintar ya la pantalla destino con su placeholder (C) y rellenar al llegar. | Ninguno. |
| **G** | Anuncio en `#live` sin cambio visual. | Varias acciones ya anuncian al terminar. |

Combinaciones frecuentes: **A + G** para acciones puntuales, **F + C** para navegación, **D** para datos pequeños.

---

## 1. Navegación y arranque

### 1. Cambiar de pantalla mientras carga el catálogo completo
- **Dónde:** `route()` (líneas ~556–563), `ensureFullCatalog`.
- **Qué pasa:** si falta el catálogo completo, `route()` sale sin renderizar. Se pulsa Librería, libro o enlace y se queda la pantalla anterior hasta que responde.
- **Opciones:**
  1. **F + C** (recomendada): pintar la pantalla destino al momento con placeholder y rellenar al llegar.
  2. **B** con umbral: mantener la pantalla actual y mostrar el velo solo si tarda.
  3. **A** sobre el elemento pulsado (enlace de navegación o botón), útil solo si el origen es un botón.
- **Notas:** compartir solución con el 3. Añadir **E** si la carga falla (ya existe `syncError`).

### 2. Entrar a Home tras login o logout
- **Dónde:** `ensureHomeData`, `mutation` con `/api/auth/logout` (~1561).
- **Qué pasa:** pide saldos y libros sin pantalla de carga; el logout recarga el catálogo sin señal.
- **Opciones:**
  1. **C** en Home: mascota o esqueleto de la fila de libros hasta que llegue `homeBooksData`.
  2. **B** durante el logout, con el texto existente `loading`.
  3. Reutilizar la pantalla de arranque (`loadingView`) en estas transiciones.
- **Notas:** la opción 3 es la más simple; la 1 se siente más viva.

### 3. Abrir un libro o nota que necesita el catálogo completo
- **Dónde:** `withFullCatalogForBook` (~1118).
- **Qué pasa:** el toque no produce nada hasta que responde; si falla, solo se refresca con `syncError`.
- **Opciones:**
  1. **A** en la tarjeta o botón pulsado + **G**.
  2. **F + C**: abrir el modal del libro con placeholder.
- **Notas:** compartir con el 1.

### 4. Arranque con red lenta
- **Dónde:** `bootstrap` (~1736), `loadingView`.
- **Qué pasa:** solo hay mascota sin texto. Sin aviso de lentitud; el error solo llega al fallar del todo.
- **Opciones:**
  1. **E** con umbral: tras X segundos, texto existente de carga y reintento.
  2. Dejarlo así si el arranque es corto en producción (medir antes).
  3. Añadir un estado «sin conexión» propio, distinto del error genérico.
- **Notas:** medir el tiempo real de arranque en producción antes de decidir.
- **Decidido:** opción 1, sin cambios. El Brote del arranque ya es el feedback.
- **Futuro:** opción 3 (estado «sin conexión» propio) con el Brote triste o «haciendo pucheros». Requiere esa animación y copy aprobado.

---

## 2. Acciones que bloquean toda la pantalla

La base es `lockControls` (~373): `busy` solo pone `aria-busy` y deshabilita controles; visualmente solo baja la opacidad al 40 %. Una solución común resuelve los puntos 5 a 11.

### Decisión transversal (puntos 5–11)
- **Decidido: T3 con un verbo por acción.** Al pulsar, el botón activador muestra un spinner (**A**, atributo `data-busy-trigger`). Si la acción sigue tras 900 ms, un Brote dormido a pantalla completa (**B**, `popover` sobre diálogos) muestra el verbo de la acción con tres puntos animados (1→2→3→2→1) que pone el propio componente: `loadingPlaceholder(verbo,{visible:true})`. Quien llama pasa solo el verbo (claves `busy*` de i18n): `lockControls("Saving")`, `mutation(...,{verb:"Opening"})`. Enviar feedback usa solo **A**.
  - **Creando:** libro, baraja, idea o cita.
  - **Guardando:** completar datos de libro, título de baraja, guía de lectura, aprobar o rechazar guía.
  - **Actualizando:** idioma de baraja, colaboradores, estado de lectura, aviso de interés, idioma de la interfaz.
  - **Añadiendo / Quitando:** baraja del Tarjetero. **Abriendo:** elegir baraja, abrir tarjeta. **Saliendo:** cerrar sesión. **Terminando:** terminar baraja o notas. **Un momento:** por defecto.
- **Opción T1 (recomendada):** que `lockControls` marque el botón activador con `aria-busy="true"` y muestre el patrón **A**. Los demás controles siguen apagados. Poco código, cubre todo `mutation`.
- **Opción T2:** añadir **B** global a `main` con umbral para acciones largas.
- **Opción T3:** T1 + T2: **A** inmediato y **B** si pasa el umbral.
- Cada punto siguiente indica solo lo específico.

### 5. Todo lo que usa `mutation()`
- **Dónde:** `mutation` (~1556).
- **Casos:** cambiar idioma, añadir o quitar baraja, elegir baraja, abrir tarjeta, cerrar sesión, estado de lectura de un libro.
- **Qué pasa:** controles apagados sin señal; el idioma cambia solo al volver la respuesta.
- **Opciones:** T1/T3; para el idioma, además cambiar el interruptor de forma optimista (**G**) y revertir si falla.
- **Notas:** el estado de lectura (`syncBookReadingDialog`) ya actualiza `aria-pressed`; basta añadir **A** al botón elegido.

### 6. Login y registro
- **Dónde:** `main.addEventListener("submit")`, rama `[data-account-form]` (~1910).
- **Qué pasa:** el botón sigue diciendo «Entrar»; luego encadena intereses, baraja pendiente, `ensureFullCatalog`, votos o guardados.
- **Opciones:**
  1. **A** en el botón de envío durante toda la cadena, sin cambiar el texto.
  2. **B** con Brote durante la fase posterior al login (las cargas encadenadas).
  3. Dividir el estado en dos fases: «identificando» (**A**) y «preparando» (**B**).
- **Notas:** el servidor responde rápido; el tramo largo es el posterior.
- **Resuelto:** Brote dormido a pantalla completa desde «Entrar» hasta llegar al destino (identificación, cadena posterior y navegación en una sola espera). Si fallan las credenciales, vuelve el formulario con el usuario y el error. Si falla algo posterior, se llega al destino con el aviso.

### 7. Guardar o crear libro, baraja, tarjeta o nota
- **Dónde:** `saveAuthorForm` (~1434), recarga con `loadCatalog`.
- **Qué pasa:** todo se deshabilita sin texto ni spinner; luego recarga el catálogo, otra espera.
- **Opciones:** **A** en el botón de guardar durante guardado y recarga; **G** al terminar.
- **Notas:** solo el autorrelleno IA tiene spinner hoy; reutilizar `.spinner`.

### 8. Editar título, idioma o colaboradores de una baraja; guardar guía de lectura
- **Dónde:** `saveDeckTitle` (~1292), idioma (~1305), `addDeckContributor` (~1318), `saveReadingGuide` (~1052).
- **Opciones:** T1 con **A** en el control activador; mantener el foco como ya hacen.
- **Notas:** son formularios pequeños; no usar **B**.

### 9. Terminar baraja y terminar notas
- **Dónde:** `finishDeck` (~1345), `finishNotes` (~1225); `completion.saving`.
- **Qué pasa:** bloquea sin indicador; después `loadCatalog`.
- **Opciones:** **A** en el botón de confirmar dentro del diálogo; **B** si se quiere cubrir la recarga posterior a la navegación.

### 10. Aviso de interés al marcar libro o guardar tarjeta
- **Dónde:** `runBookInterestAction` (~1595), `bookInterestWarningView`.
- **Opciones:** **A** en el botón de confirmar del aviso y en el botón de estado de lectura de origen; **G**.
- **Notas:** `outcomeUnknown` ya deshabilita cancelar; mantener la regla.

### 11. Enviar feedback
- **Dónde:** `feedbackForm` submit (~1809).
- **Qué pasa:** solo se deshabilita el botón; se cierra al terminar.
- **Opciones:** **A** en el botón de envío; mantener el diálogo abierto hasta responder (ya ocurre).

---

## 3. Cargas que muestran un estado falso

### 12. Lista de tarjetas guardadas
- **Dónde:** `SavedCards`, `loadCollection` (`card-features.jsx`).
- **Qué pasa:** mientras no responde, muestra «No hay tarjetas guardadas» como si estuviera vacía.
- **Opciones:**
  1. **D + C** (recomendada): no mostrar el vacío hasta que `loadCollection` termine; mostrar placeholder.
  2. Mostrar primero las guardadas conocidas por `snapshot.cardSaves` y completar al llegar.
- **Notas:** añadir un estado `collectionLoaded` en el puente; la opción 2 evita el parpadeo si ya hay datos.

### 13. Votos y guardar de cada tarjeta
- **Estado:** descartado, sin trabajo (2026-11-11).
- **Por qué:** mientras `record.loaded` es falso, el contador sale vacío y aparece el número al llegar. Es la opción más simple y ya es el comportamiento actual; los botones funcionan desde el primer instante y, si la lectura falla, hay error con reintento.

### 14. Contador de tarjetas guardadas
- **Estado:** descartado, sin trabajo (2026-11-11).
- **Por qué:** es el número del botón «Guardadas» en la cabecera de la baraja. Sale de `snapshot.cardSaves`, que ya llega en el estado completo antes de pintar la baraja. Sin dato no muestra número, no un 0 falso. Solo habría un hueco justo tras login.

### 15. Home mientras llegan balances, libros y portadas tintadas
- **Dónde:** `ensureHomeData`; `loadInterests().then(...).catch(()=>{})`.
- **Qué pasa:** las portadas se tiñen en un segundo paso; el fallo es silencioso.
- **Opciones:** **C** en la fila de libros; las portadas pueden aparecer sin tinte y teñirse con transición suave. Sin aviso de fallo si el tinte es solo decorativo.

### 16. Saldos de la cabecera
- **Estado:** resuelto, sin trabajo. Descartado tras revisión (2026-11-11).
- **Por qué:** `bootstrap` espera `ensureHomeData` (saldos incluidos) antes de salir de la pantalla de carga, y login devuelve el estado completo. Además, `header()` muestra «—» y `aria-busy` mientras `balanceReady` es falso (`reader-app.mjs:~353–359`). La auditoría inicial se equivocó al decir que no había indicador.

---

## 4. Intereses y perfil

### 17. Selector inicial de intereses
- **Dónde:** `loadHomeInterestPreferences`, `openInitialInterestSetup` (~778–822).
- **Qué pasa:** carga preferencias e intereses antes de abrirse; si falla, queda «reintentar en la siguiente navegación», sin aviso.
- **Opciones:**
  1. **E**: aviso discreto con reintento si falla.
  2. Reintento automático con retardo, sin aviso, y aviso solo tras varios fallos.
  3. Dejarlo silencioso por ser opcional (decisión de producto).

### 18. Detección de nuevos intereses
- **Dónde:** `new-interests.mjs` `load()` (dos peticiones antes de abrir el modal).
- **Opciones:** mismas que el 17; el modal ya tiene estado `saving`, que podría mostrarse **A**-style cuando es visible.

### 19. Guardar ordenación por intereses
- **Dónde:** `bookSortPreferenceWriter`; login con intención de ordenar.
- **Qué pasa:** Librería tiene `interestSortLoading`; el resto de disparadores (tras login) no.
- **Opciones:** llevar el mismo estado al punto de entrada post-login (**G** al terminar) y reutilizarlo en Perfil.

### 20. Intereses e idiomas del perfil
- **Dónde:** `profileView`, `profile-interests-loading`.
- **Qué pasa:** solo texto «Cargando…» sin estilo.
- **Opciones:** **C** con esqueleto de las fichas de interés; o mantener el texto si la carga es muy corta.

---

## 5. Práctica y diario

### 21. Respuesta de práctica
- **Dónde:** `answerPractice`, `recoverPracticeSession` (~985–1020).
- **Qué pasa:** la tarjeta sale al instante; si la petición va lenta o falla, la recuperación ocurre sin que se vea.
- **Opciones:** **E** si la recuperación tarda; la siguiente tarjeta no se presenta hasta tener respuesta, con **C** discreto.
- **Notas:** el diseño es optimista a propósito; no bloquear la animación de salida.

### 22. Iniciar práctica
- **Dónde:** `startPractice` (~930), `practiceStarting`.
- **Qué pasa:** solo el botón del tema lo refleja.
- **Opciones:** **B** con Brote tras el umbral, **A** en el tema; **G** ya anuncia la preparación en Descubrir.
- **Resuelto:** `#practice` se abre sin catálogo completo y lo precarga en segundo plano mientras se elige modo. Tras elegir modo, Brote dormido a pantalla completa hasta que llega la sesión; después, la animación de apilar y cortar.
- **Futuro, parte 2:** animación de apilar y cortar en paralelo a `practice/start` (escena sin tarjetas, pausa hasta la respuesta). Gana como mucho la latencia de `practice/start`; toca `route()`, la vista, la presentación y los fallos. Solo si la espera sigue molestando.
- **Futuro, parte 4:** que `practice/start` devuelva las 5 tarjetas con sus libros y barajas, y el cliente no necesite el catálogo completo. La tarjeta de práctica enlaza libro, autor, baraja y usuario (`cardAttribution`), así que exige un catálogo parcial en el cliente. Hoy la precarga ya esconde esa carga tras la elección de modo.

### 23. Diario
- **Dónde:** `dailyLoading`, `daily-status`, calendario.
- **Qué pasa:** el texto existe, pero el estado y el calendario cargan en silencio.
- **Opciones:** **C** en el calendario hasta que llegue `dailyStatus`; **D** para días aún no confirmados.

---

## 6. Segundo plano sin aviso

### 24. `refreshState()` y sincronización periódica
- **Dónde:** `refreshState` (~1719).
- **Opciones:**
  1. No mostrar nada si todo va bien y avisar solo de fallos repetidos (**E**).
  2. Indicador mínimo en la cabecera mientras sincroniza (riesgo de ruido visual).
- **Notas:** probablemente se deje así; documentar la decisión.
- **Decidido:** sin cambios. Es un polling cada 30 s con la app visible (y al recuperar foco, visibilidad o conexión), invisible si no cambia nada; los fallos ya avisan con «Reintentar». **Rendimiento:** cada ciclo descarga el catálogo entero y lo compara con `JSON.stringify`; no escala con un catálogo grande. Entra en la nota de arquitectura «catálogo bajo demanda».

### 25. Visita de libros y registro de vistas
- **Dónde:** `/api/reader/book-knowledge/visit`, `/api/reader/view` (`catch {}`).
- **Opciones:** no mostrar nada al usuario; añadir reintento silencioso con tope. Sin UI.

### 26. Cola de revisión de guías (archivistas)
- **Estado:** ya tiene carga, error y reintento propios. Sin cambios; sirve de referencia del patrón **E**.

---

## Orden sugerido

1. **Estados falsos (12–14, 16):** barato y quita información errónea.
2. **Decisión transversal T1/T3 (5–11):** una sola decisión resuelve la mayoría.
3. **Navegación (1–3):** la espera más visible; elegir entre **F + C** y **B**.
4. **Arranque y login (4, 6).**
5. **Intereses, práctica y diario (17–23).**
6. **Segundo plano (24–25):** solo si se decide mostrarlos.

## Decisiones tomadas

- **Un solo placeholder de carga.** `app/loading-placeholder.mjs` exporta `loadingPlaceholder(label)` y es lo único que renderiza el Brote dormido de espera (navegación, capa de libro/nota, Idea del día, perfil, lista de guardadas). Cambiar el aspecto (spinner, etiqueta, puntos, animación de despertar) se hace solo ahí. CSS: `.loading-placeholder`.

- **Puntos 1–3: F + C.** Se pinta de inmediato un placeholder con Brote dormido (la misma animación del perfil) y se rellena al llegar el catálogo. Siempre se muestra, sin umbral.
  - Puntos 1 y 2 (`route()`): el placeholder sustituye el contenido de `main` (`navigationPendingView`).
  - Punto 3 (`withFullCatalogForBook`): el placeholder va como capa sobre la pantalla actual, para no perder el contexto.
  - Si la carga falla, se vuelve a la pantalla anterior con el aviso de sincronización existente.
- **T1/T2/T3 (puntos 5–11): aplazada.** Se decidirá cuando se vea el resto de soluciones.

## Incremento futuro: animación de Brote dormido

Aparte del feedback, hay que revisar la animación de espera. Se aborda después de mejorar el feedback general, cuando se vea cómo queda en todos los sitios que la usan (perfil, navegación y los que se añadan).

- La salida debe ser suave. Hoy el placeholder desaparece de golpe; el perfil solo tiene la transición `wake` propia.
- La animación debe dar la sensación prevista de espera tranquila y mantenerse siempre en estas esperas.
- Definir una sola gestión compartida (entrada, bucle, salida y movimiento reducido) en lugar de una por pantalla.

## Registro de decisiones

| Punto | Opción elegida | Fecha | Notas |
| --- | --- | --- | --- |
| 1 | F + C (Brote dormido) | 2026-11-11 | Implementado en `route()`. |
| 2 | F + C (Brote dormido) | 2026-11-11 | Implementado en `route()`. |
| 3 | F + C (capa sobre pantalla actual) | 2026-11-11 | Implementado en `withFullCatalogForBook`. |
| 4 | Sin cambios (opción 1) | 2026-11-11 | Futuro: «sin conexión» (opción 3) con Brote triste/pucheros. |
| 5–11 (T1/T2/T3) | T3 con etiquetas por acción | 2026-11-12 | Implementado en `lockControls`; 900 ms de umbral. |
| 6 | Brote dormido de «Entrar» al destino | 2026-11-11 | Implementado en el submit de cuenta. |
| 12 | Brote dormido en la lista | 2026-11-11 | Implementado en `SavedCards`. |
| 13 | Sin cambios (descartado) | 2026-11-11 | Comportamiento actual aceptado. |
| 14 | Sin cambios (descartado) | 2026-11-11 | Falso positivo de la auditoría. |
| 15 | Sin cambios (descartado) | 2026-11-11 | Home ya espera con el Brote; el tinte tardío es decorativo. |
| 16 | Sin cambios (ya resuelto) | 2026-11-11 | Falso positivo de la auditoría. |
| 17 | Sin cambios (descartado) | 2026-11-11 | Opcional; fallo silencioso aceptado. |
| 18 | Sin cambios (descartado) | 2026-11-11 | Mismo criterio que el 17. |
| 19 | Sin cambios (descartado) | 2026-11-11 | Login ya lo cubre el Brote (punto 6); el guardado avisa si falla. |
| 20 | Sin cambios (descartado) | 2026-11-12 | Tras optimizar el Perfil la espera es mínima; ya hay texto de carga. |
| 21 | Sin cambios (descartado) | 2026-11-12 | Diseño optimista a propósito. |
| 22 | Brote dormido + elección sin catálogo | 2026-11-12 | Partes 2 y 4 aplazadas (ver punto 22). |
| 23 | Sin cambios (descartado) | 2026-11-12 | Brote al cargar la idea; el calendario llega con ella; el estado solo alimenta el puntito. |
| 24 | Sin cambios (descartado) | 2026-11-12 | Polling invisible; el coste del catálogo va a la nota de arquitectura. |
| 25 | Sin cambios (descartado) | 2026-11-12 | Tarea interna, sin UI. |
| 26 | Sin cambios (descartado) | 2026-11-12 | Ya tiene carga, error y reintento propios. |
