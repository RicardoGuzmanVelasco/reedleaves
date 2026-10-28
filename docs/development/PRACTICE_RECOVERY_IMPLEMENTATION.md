# Brief técnico: recuperación de sesiones de Repasar

Este documento acota los incrementos 01a y 01b de `INTERESTS_PLAN.md`.
El plan vigente es la fuente de alcance y producto; este brief concreta contratos y orden técnico.

## Límites de entrega

### 01a: lectores compatibles, sin recuperación activa

- Añadir un marcador persistido de cancelación a `practice_sessions`.
- Adaptar estado, consultas, índices, validadores y cliente para reconocerlo.
- Establecer un único orden de locks por cuenta en PostgreSQL.
- Devolver y consumir el estado de sesión autoritativo del servidor.
- Mantener apagada la sustitución de guías y la cancelación/refund automáticos.
- No cambiar sesiones compradas, sus respuestas ni datos históricos existentes.

### 01b: exclusión y recuperación activadas

- Excluir guías en todos los modos de Repasar y al hidratar una sesión.
- Reparar las posiciones pendientes o cancelar y devolver el coste una sola vez.
- Activar recuperación compartida en lectura de estado, arranque y respuesta.
- Requiere 01a verificado y pruebas de concurrencia con PostgreSQL real en CI.
- El rollback compatible de 01b es 01a; no desplegar una versión que ignore cancelaciones.

## Contrato y archivos de 01a

- `server/schema.sql`, `server/schema.postgres.sql`: añadir `cancelled_at`, nullable.
- `server/database.mjs`: migración SQLite 41→42 y PostgreSQL 33→34; actualizar versiones.
- Añadir fixtures inmutables `server/fixtures/migrations/sqlite-v41.sql` y
  `server/fixtures/migrations/postgres-v33.sql`; enlazarlas en el índice de fixtures.
- Actualizar el índice parcial de sesiones activas a
  `completed_at IS NULL AND cancelled_at IS NULL` en ambos esquemas.
- Cambiar cada lector de sesión activa para usar la misma condición. Buscar usos en
  `server/reader-repository.mjs`, `server/practice-economy.mjs`, perfiles y validadores.
- Conservar `completed_at`, `completed_local_day`, `cost`, IDs, respuestas y fechas.
- No añadir `refunded_at`: en 01b `cancelled_at` y el abono se escriben en la misma
  transacción; el marcador junto al lock de sesión impide devolver dos veces.
- El fixture debe describir exactamente el esquema previo; no construirlo mediante
  reemplazos del esquema actual. La migración solo añade estado y ajusta el índice.

## Transacción y orden de locks

- Crear una función interna compartida en `server/practice-economy.mjs`, por ejemplo
  `reconcilePracticeSessionInside(db, userId, now)`, que recibe una transacción activa.
- No abrir otra transacción dentro de esa función. Reutilizar el wrapper de cada ruta.
- Helper pequeño: `SELECT ... FROM accounts WHERE user_id=? FOR NO KEY UPDATE`.
  Serializa por cuenta sin bloquear los `KEY SHARE` de comprobación de FK. Estas rutas
  no cambian claves de cuenta. Orden: cuenta → sesión → monederos, con orden fijo entre
  monederos. Adquirir cuenta antes de cualquier otra escritura de la transacción.
- `startPracticeSession`: actualmente devenga pétalos y luego consulta sesión activa;
  ordenar el acceso por cuenta antes de ambos. Reanudar la activa existente.
- `answerPracticeSession`: bloquear cuenta antes de la fila de sesión; hoy solo bloquea
  la sesión. Mantener el mismo orden incluso para respuestas intermedias.
- Invocar helper al inicio de `readReaderState`, `addDeckToCollection`,
  `removeDeckFromCollection`, `selectDeck`, `openCard`, `changeReading`,
  `changePreferences`, `dailyIdea`, `startPracticeSession` y `answerPracticeSession`.
  `stateInside` supone la cuenta ya bloqueada. Hacerlo solo allí sería tarde: select
  puede tener `deck_selections` y esperar a collect, que ya bloqueó cuenta, o una
  escritura de preferencias puede invertir el mismo orden.
- `readReaderState` bloquea cuenta al inicio, lee/reconcilia sesión y después devenga
  hoja/pétalo. `dailyIdea` adquiere cuenta antes de su advisory lock global.
- No extender este cambio a autoría ni guardadas: sus APIs leen estado tras terminar
  la transacción, o no lo leen. No introducir transacciones anidadas.
- SQLite conserva su transacción `BEGIN IMMEDIATE` y serialización actual.
- No endurecer `AsyncLocalStorage` en este incremento. `PostgresDatabase` guarda un
  cliente transaccional en un ALS global: cada transacción concurrente de una misma
  instancia tiene su contexto, pero tests no deben mezclar instancias distintas de
  `PostgresDatabase` dentro del callback de otra. Los tests de concurrencia usarán una
  instancia y un pool con varias conexiones.

## Contrato de sesión y cliente

- `readReaderState` incluirá `activePracticeSession` con `id`, `topic`, `cardIds`,
  `index`, `cost` y `startedAt`; sesión ausente seguirá siendo `null`.
- Start y answer devolverán `state` después de la mutación/reconciliación, como ya hace
  `server/reader-api.mjs`; el cliente debe hidratar IDs, índice y pétalos desde ese estado.
- No incrementar el índice local a ciegas tras responder. Aplicar el snapshot del
  servidor y continuar solo si la identidad de sesión y tarjeta coincide.
- En 01a, `cancelled_at` se interpreta como sesión no activa. La API no crea cancelación
  ni sustitución; no debe inventar una razón de cancelación en la interfaz.
- Si el snapshot referencia IDs no hidratables o está incompleto, no filtrar elementos
  y desplazar el cursor. Fallar cerrado y volver a pedir estado autoritativo.
- Rutas a revisar en `app/reader-app.mjs`: restauración de sesión, ruta directa
  `#practice/session`, Continue, start y respuesta. En 01a conservar el flujo existente
  salvo sustituir el estado local por la respuesta autoritativa.

## Activación de recuperación en 01b

- Aplicar el filtro común de guía en `availableCards` en `server/practice-economy.mjs`.
- La reconciliación carga `practice_session_cards` ordenadas por posición y comprueba
  integridad permanente: existencia, permiso de acceso vigente y exclusión de guías.
  No invalidar tarjetas compradas por cambiar después el estado de lectura, fuentes,
  colección o preferencias de idioma/afinidad. Las fuentes actuales del modo sirven
  para seleccionar reemplazos, no para reinterpretar la compra ya válida.
  El prefijo respondido se conserva; reparar solo `position >= card_index`.
- Retener IDs pendientes válidos bajo ese contrato. Sustituir las guías pendientes por
  IDs elegibles no duplicados; actualizar `card_ids` y filas de sesión en una transacción.
- No borrar ni reescribir respuestas históricas. Una guía contestada antes del rollout
  permanece solo como historial y no se vuelve a emitir.
- Si faltan alternativas para completar la sesión, fijar `cancelled_at` y acreditar
  `cost` en la misma transacción. Usar `accruePetalWallet` y el ciclo centralizado de
  `server/daily-cycle.mjs` antes de ajustar el saldo.
- Cancelar no fija `completed_at`/`completed_local_day`: no concede progreso de mascota
  ni cambia la semilla del descuento. No comprar otra sesión automáticamente.
- Answer reconcilia antes de validar input. Si la tarjeta/índice enviados fueron
  sustituidos, no guardar la respuesta antigua; devolver estado reparado/cancelado.
- Start, lectura de estado y respuesta llaman al mismo reconciliador bajo los locks.
  Repetir GET/start/answer debe producir el mismo resultado y un único refund.
- Frontend aplica el estado completo de cada respuesta. Si la tarjeta cambió, descarta
  animación/avance de la respuesta en vuelo. Si se canceló, vuelve al selector con copy
  funcional localizado; nunca inicia otra sesión sin acción del usuario.
- Desde 20, guardar el snapshot mínimo de idiomas de compra y usarlo para reemplazos.
  Para sesiones anteriores materializar una sola vez los idiomas efectivos de sus IDs;
  no recalcularlos al editar el perfil. Si no queda idioma recuperable, cancelar y devolver.

## Pruebas y CI

- 01a: pruebas de migración desde fixtures históricos SQLite/PostgreSQL; preservar filas
  y valores, sesión completada intacta, cancelada excluida del índice activo y nueva
  sesión permitida. Añadir contrato de estado autoritativo del cliente.
- 01b: SQLite y PGlite cubren filtro por modo, prefijo histórico, sustitución sin IDs
  repetidos, cancelación/refund exactamente una vez, sin crecimiento, y respuesta antigua
  descartada. Cubrir dos pestañas/reintentos y restauración directa.
- Añadir un test real de PostgreSQL aislado, activado solo con `REED_TEST_POSTGRES_URL`.
  Construir `new PostgresDatabase(url)` directamente; nunca usar `DATABASE_URL` ni
  `openDatabase` para seleccionar el servicio de test.
- Rechazar URL cuyo host no sea loopback (`127.0.0.1`, `localhost` o `::1`). No conectar
  a servicios externos ni a la base de producción.
- CI añade servicio PostgreSQL con health check y URL loopback. Configura
  `REED_TEST_POSTGRES_REQUIRED=1`: si falta la URL o el test no se ejecuta, el job falla.
- Con una instancia DB y pool de varias conexiones, ejecutar operaciones concurrentes
  reproducibles que ejerciten lectura, start y answer. Comprobar resultado, saldo,
  sesión única, y que no haya deadlock. Consultar `pg_backend_pid()` en transacciones
  concurrentes para confirmar que se usaron conexiones distintas.
- Añadir cruces de `selectDeck`/collect y de preferencias concurrentes: son rutas reales
  con escrituras previas a `stateInside` que deben quedar serializadas desde el inicio.
- Mantener PGlite para SQL rápido; no presentarlo como prueba de ausencia de deadlocks.
- 01b no se activa hasta que CI real pase y 01a se haya verificado. No probar contra
  producción como parte de la suite.

## Riesgos de transición y revisión

- Desplegar 01a antes de 01b evita que código antiguo lea una cancelación que aún no
  sabe representar; no revertir 01b a una revisión previa a 01a.
- Lock order debe ser idéntico en lectura, start y answer: una ruta invertida puede
  bloquear dos pestañas concurrentes.
- Refund fuera de la transacción o sin el lock de sesión permite doble abono.
- Reescribir el prefijo contestado, `completed_at` o `completed_local_day` alteraría
  historial/progreso; limitar actualizaciones a posiciones pendientes.
- Las pruebas PostgreSQL no deben caer silenciosamente en SQLite/PGlite en CI.
