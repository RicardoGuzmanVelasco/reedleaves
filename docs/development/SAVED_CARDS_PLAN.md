# Plan de implementación · Tarjetas guardadas y acciones optimistas

Fecha: 13 de octubre de 2026.
Estado: implementado en producción y disponible en local. Base previa corregida: 204/204. Resultado final: 214/214, más verificación de navegador en escritorio y móvil.

## Resultado esperado

Un lector guarda o quita una tarjeta desde su vista exclusiva. Sus guardadas forman una selección privada por libro, que combina tarjetas y citas de distintas barajas. Puede encontrarla al explorar ese libro y abrir sus tarjetas con el mismo papel, atribución, votaciones y marcapáginas que el resto de la app.

Me gusta, no me gusta y guardar responden de inmediato. El servidor confirma cada acción; ante un error, la interfaz recupera el estado correcto y ofrece reintento. La selección personal se mantiene entre sesiones y dispositivos.

## Código analizado antes de implementar

- `app/reader-app.mjs` controla rutas, sesión y render mediante `main.innerHTML`. No hay React ni compilación de frontend.
- `app/views.mjs` genera la vista exclusiva y `cardVoteMarkup`. Los votos se cargan al abrir una tarjeta; `voteCard` espera la respuesta y utiliza `busy` global.
- `app/account-client.mjs` envía cookies y CSRF y pone todas las peticiones en una sola cola. Una operación larga puede retrasar otras acciones.
- `server/card-votes.mjs` ya persiste una valoración por usuario/tarjeta. La API acepta el destino absoluto `-1`, `0` o `1`; votar en una tarjeta propia sigue prohibido.
- El catálogo identifica cada tarjeta, libro, baraja, versión e idioma. La colección personal puede conservar estas referencias sin crear una baraja editorial ni copiar contenido.
- `server/profile-repository.mjs` registra vistas legítimas separadas de los desbloqueos de repaso. El contexto actual admite `daily`, `review` y `author`.
- `app/bookshelf.mjs` no considera todavía las guardadas como relación personal con un libro.
- Esquemas actuales comprobados en código: SQLite 15 y PostgreSQL 7. La nueva tabla necesita migraciones transaccionales a 16 y 8.
- Las citas usan papel azul y `.quote-card` recorta su contenido con `overflow:hidden`; habrá que recortar solo la decoración para permitir que cuelgue la cinta.
- El servidor sirve módulos locales bajo `/app/` y aplica CSP sin scripts remotos. `render.yaml` compila hoy solo mediante `npm ci`.

## Decisión resuelta

**P1 resuelta por el usuario.** Una tarjeta guardada desde Idea del día podrá abrirse gratis desde Guardadas, manteniendo bloqueada su posición original. Abrirla así registra una vista, sin gasto de hojas ni avance del repaso. En otra entrega futura la Idea del día costará una hoja; ese cambio queda fuera de esta implementación.

Antes de empezar Guardadas se deben resolver los fallos existentes mediante una revisión del valor de sus pruebas. Ver `TEST_AUDIT_2026-10-13.md`.

## Decisiones propuestas que no requieren otro flujo

- Guardadas es privada y pertenece a la cuenta, por libro. No aparece en perfiles o bibliotecas ajenas.
- Guardar es independiente de votar. Se puede guardar una tarjeta propia; se conserva la prohibición de votar en ella.
- Se conserva el ID de la tarjeta y su origen. La misma tarjeta no se duplica; tarjetas de distintas barajas con texto similar siguen siendo entidades distintas.
- Orden inicial: guardadas más recientes primero, con desempate estable por ID. Volver a guardar tras quitarla la sitúa al principio.
- Guardar y quitar no gastan hojas ni alteran el árbol, las barajas elegidas, las versiones completadas o las reglas de mascotas.
- Un libro con guardadas aparece en la Biblioteca propia aunque no tenga un repaso iniciado. No se inventa un estado de lectura o repaso para incluirlo.
- Esta entrega conserva la Idea del día actual. Deja los datos preparados para un futuro repaso diario de guardadas.

## Recorridos

1. Abrir una tarjeta desde repaso, Idea del día o autoría. Cargar su estado confirmado de acciones. Mostrar el grupo compacto junto a la esquina inferior derecha.
2. Pulsar guardar: cambiar de inmediato color e icono y desplegar la cinta. Confirmar sin volver a renderizar el papel. Si falla, recoger la cinta y mostrar un error funcional con Reintentar.
3. Pulsar un voto: cambiar inmediatamente selección y recuentos. El mismo voto lo retira; el contrario lo sustituye. La prohibición de votar contenido propio permanece visible y accesible.
4. Explorar las barajas del libro: mostrar un acceso fijo **Guardadas / Saved cards** con su contador, también a cero. No atribuirle un creador, recomendación, versión ni progreso editorial ficticios.
5. Abrir Guardadas: álbum plano de tarjetas del libro, con el filtro existente Todas / Solo citas, atribución de origen y estado vacío. No exigir que sus padres formen parte de la selección.
6. Abrir una guardada: vista exclusiva compartida. Cerrar vuelve al álbum conservando filtro, scroll y foco. Un enlace directo comprueba sesión y pertenencia a la selección.
7. Quitar desde esa vista: actualizar contador y álbum optimistamente, manteniendo abierta la tarjeta hasta que el lector cierre. Al volver, recuperar foco en la siguiente tarjeta disponible o en el encabezado si quedó vacía. Un error restaura tarjeta y posición.
8. Cambiar de cuenta, salir o expirar la sesión: descartar datos privados y resultados pendientes de la cuenta anterior.

## Datos y servidor

Crear `card_saves(user_id, card_id, saved_at)` con clave primaria compuesta, referencias a usuarios/tarjetas y borrado en cascada si desaparece la tarjeta. El libro se obtiene de `cards.book_id`; no se duplica en la tabla. Añadir un índice para consultar la selección de una cuenta por fecha.

Migrar desde SQLite 15 y PostgreSQL 7 sin reiniciar ni resembrar las bases. Inicializaciones repetidas deben ser seguras y conservar votos, cuentas, sesiones, monedero, contenido y progreso existentes. No tocar bases de producción durante la entrega local.

Nuevo repositorio `server/card-saves.mjs`:

- Guardar/quitar con destino booleano absoluto, dentro de una transacción. Repetir una petición no crea duplicados ni cambia su fecha de guardado mientras siga guardada.
- Guardar valida que la tarjeta existe y que el lector pudo verla: desbloqueo, autoría propia, asignación diaria válida o vista legítima registrada. No basta con enviar un ID arbitrario.
- Quitar se limita siempre a la cuenta de la sesión y es idempotente.
- Consultar guardadas filtra en SQL por la cuenta autenticada y el libro solicitado. Conserva las referencias originales, también al crecer una baraja.
- Las respuestas de votos mantienen su contrato actual. Las respuestas de guardado actualizan solo guardado y colección; no pisan una votación pendiente.

API propuesta:

| Ruta | Método | Uso |
| --- | --- | --- |
| `/api/cards/:cardId/actions` | GET / HEAD | Estado confirmado de votos y guardado de una tarjeta |
| `/api/cards/vote` | POST | Endpoint existente; destino `value: -1 / 0 / 1` |
| `/api/cards/save` | POST | Destino `saved: boolean` y resultado confirmado con libro/contador |
| `/api/reader/saved/:bookId` | GET / HEAD | Selección privada ordenada del libro |
| `/api/reader/view` | POST | Añadir contexto `saved`, con comprobación de pertenencia si P1 permite abrir gratis |

Extender el estado propio de sesión con las referencias de guardadas y recuentos por libro, calculados en una consulta. La colección usa el contenido del catálogo actual. No publicar guardadas en `/api/catalog` ni en perfiles ajenos. Mantener autenticación, origen, CSRF, límites JSON y respuestas sin caché existentes.

## React en el frontend existente

Usar React y React DOM 19.3, con versión estable fijada en el lockfile al implementar. Incorporarlo de forma gradual a estas superficies:

- `CardActions`: votos y cinta.
- `SavedCards`: álbum personal, filtros y retirada optimista.
- `SavedCardsEntry`: acceso y contador al explorar el libro.

Un proveedor React mantiene el estado de estas funcionalidades fuera del contenido que reemplaza `main.innerHTML`. La integración con el render existente proporciona contenedores para portales y actualiza contexto, rutas e idioma. React y la manipulación manual del DOM no escriben sobre el mismo nodo. Desmontar o cambiar de tarjeta no debe perder una intención pendiente; cambiar de cuenta sí debe invalidarla.

Añadir una compilación pequeña con esbuild para JSX y dependencias, generando un módulo ESM local en `/app/generated/`. El servidor y CSP actuales siguen sirviendo esos archivos. Ignorar los resultados generados en Git. Añadir scripts de compilación/desarrollo, compilar durante el build de Render y ofrecer un arranque local que genere el bundle necesario.

La arquitectura de Node, API, sesiones y rutas hash continúa sirviendo esta entrega. No hace falta introducir SSR, un segundo servidor de producción o un framework completo para estas funcionalidades.

## Optimismo y concurrencia

- `useOptimistic` presenta la intención inmediatamente sobre el último estado confirmado. Actions con `startTransition` gestionan las escrituras asíncronas; las acciones capturan errores y permiten reintentos. Las colas por tarjeta/tipo conservan las intenciones rápidas sin serializar guardar y votar entre sí.
- El reducer de voto resta el voto previo del recuento correspondiente y añade el nuevo. Guardado actualiza pertenencia y contador de forma coherente. Las respuestas de servidor sustituyen el estado confirmado, sin sumar deltas dos veces.
- Enviar destinos absolutos, no operaciones toggle, tanto para votar como para guardar. El reintento repite ese destino.
- Ordenar las escrituras por cuenta, tarjeta y tipo de acción. Los cambios rápidos deben terminar con la última intención, aunque una petición anterior falle. Guardar y votar pueden avanzar de forma independiente.
- No utilizar `busy` global para estos clics. El monedero y desbloqueo de tarjetas conservan su confirmación antes de avanzar.
- Permitir cambios rápidos mientras hay una petición pendiente. Una respuesta antigua no puede borrar una intención más reciente, otra tarjeta ni datos de otra cuenta.
- Revalidar al volver al primer plano y después de errores de red con resultado incierto. Si la petición llegó al servidor pero se perdió su respuesta, el estado leído prevalece. Si tampoco se puede leer, restaurar el último confirmado y ofrecer reintento.
- La sincronización periódica debe actualizar datos sin cerrar, recrear o repetir la animación de una vista exclusiva abierta. Reconciliar cambios de otro dispositivo manteniendo las intenciones locales pendientes.
- El error aparece junto a la acción y se anuncia mediante un estado accesible. No presentar éxito confirmado si el servidor rechazó la operación.

React proporciona el estado optimista, no la persistencia, los permisos ni el protocolo de reconciliación. Referencias oficiales: [useOptimistic](https://react.dev/reference/react/useOptimistic), [useActionState](https://react.dev/reference/react/useActionState), [adopción gradual](https://react.dev/learn/add-react-to-an-existing-project), [versiones](https://react.dev/versions).

## Diseño parametrizable de producción

Trasladar el diseño aprobado desde el estudio a un componente de producción, reduciendo su peso visual. Mantener la pareja de pulgares con muñecas próximas y contadores opuestos, placa/cinta asimétricas, cinta corta inicial y despliegue recto al guardar.

- La tarjeta define variables CSS semánticas para iconos, borde, recuentos, placa, sombras, cinta normal/guardada y acento. `.idea-card` aporta Salvia; `.quote-card` sustituye la paleta por azules coherentes con su papel.
- El componente no consulta el tipo para dibujar o gestionar acciones. Un tipo futuro solo define sus tokens de color. La paleta incluye todos los estados; ningún SVG contiene colores fijos.
- Hacer el grupo visualmente más pequeño mediante parámetros de geometría compartidos. Conservar zonas pulsables de al menos 44 × 44 px y separación suficiente entre valorar y guardar; no reducir conjuntamente icono y área táctil sin revisarlas.
- Mantener papel, atribución y capas de la tarjeta. En citas, trasladar el recorte de las comillas a una capa decorativa independiente para que la cinta sobresalga sin desbordar la decoración.
- Animación reversible y movimiento reducido; foco visible, controles nativos, `aria-pressed`, etiquetas traducidas ES/EN y recuentos accesibles. No reiniciar la tarjeta al confirmar una acción.

## Orden de implementación

1. P1 resuelta; terminar la revisión de pruebas y obtener una suite completa correcta antes de implementar.
2. Tabla, migraciones, repositorio y API. Probar ambos motores antes de conectar la interfaz.
3. Añadir React y compilación; proveedor, reducer optimista y puente con el render actual.
4. Sustituir votos en la vista exclusiva por el componente compacto y parametrizable, añadir guardar y la animación. Comprobar tarjeta normal y cita.
5. Acceso Guardadas, rutas, álbum personal, retorno/foco y relación con Biblioteca propia.
6. Reconciliación, recuperación de errores y cambios de cuenta/dispositivo.
7. Verificación completa, actualización de DESIGN/arquitectura/README/diario y un commit local del hito. Dejar la app real abierta en localhost para probarla; no publicar rama ni desplegar.

## Pruebas y criterios de aceptación

- SQLite y PostgreSQL: unicidad, destinos repetidos, quitar/recrear, orden estable, pertenencia al libro, aislamiento entre cuentas, permisos y conservación en las migraciones.
- HTTP: autenticación/CSRF, rechazo de datos inválidos, tarjetas inexistentes/no accesibles, lectura de la selección propia y caso P1. Guardar/abrir guardadas no consume hojas ni desbloquea el árbol.
- Estado optimista: feedback anterior a la respuesta; alternar/retirar votos; guardar/quitar; errores, respuesta perdida y reintento; respuestas antiguas; mezcla de voto y guardado; navegación y cierre de sesión durante las peticiones.
- Navegador con datos locales: guardar desde Idea del día/repaso/autoría, recargar, entrar con otra cuenta, abrir Guardadas desde el libro, filtrar citas, quitar la última, volver conservando foco/scroll y seguir el repaso original.
- Revisar escritorio y móvil, ambos papeles y ambos estados, animación/reverso/movimiento reducido, teclado y texto ES/EN. Verificar el grupo compacto con los contenidos reales.
- Probar compilación limpia, arranque local y bundle servido con CSP. Todos los proveedores de IA de las pruebas serán simulados.

Referencia previa al cambio: `npm test` con Node 24.21.0 da **196/204**, con ocho fallos existentes: álbum, invitación, cuatro casos de autoría, API de autoría y perfil. Sus expectativas se contrastarán con las decisiones vigentes; no se atribuirán al nuevo caso de uso ni se ocultarán desactivando pruebas. Los nuevos casos deben pasar y el resultado global debe quedar documentado.

## Resultado de la implementación

- SQLite 16 y PostgreSQL 8, migraciones verificadas en ambos motores. Persistencia y API privadas completas, manteniendo el endpoint de voto anterior.
- React/React DOM 19.3 y esbuild 0.28.2 fijados. Raíz persistente y portales sobre las vistas actuales; paletas CSS por tipo, geometría compacta y animación reversible.
- Guardadas por libro, filtro de citas, origen, rutas propias y foco al volver. Los libros guardados se incorporan a Biblioteca sin alterar lectura o repaso.
- Suite completa: 214/214. Pruebas HTTP, motores SQL, migraciones, React renderizado y reducer/transporte. Verificación de navegador: respuesta antes del servidor, clics rápidos, rollback y reintento, respuesta perdida tras commit, otra sesión, cierre de sesión, autoría, cita azul, recarga y móvil. Sin errores de JavaScript inesperados.
- Arranque local con base de prueba independiente en `var/saved-cards-local.sqlite`; las capturas y sesiones de QA permanecen ignoradas. Sin llamadas reales a proveedores de IA.
