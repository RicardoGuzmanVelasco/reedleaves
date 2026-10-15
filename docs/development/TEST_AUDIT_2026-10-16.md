# Auditoría de pruebas — 16 de octubre de 2026

Referencia: `42bd56e`, Node **24.21.0**, instalación limpia mediante `npm ci`.
Suite inicial: **204/231**, con **27 fallos**. Los fallos analizados son
reproducibles; no se ha encontrado aleatoriedad como causa de estos 27 casos.

## Qué fallaba

| Casos | Causa | Corrección |
| --- | --- | --- |
| 6 | Formularios sin `booksById` y búsquedas sin `statuses`: estados de prueba parciales que dejaron de representar el estado real del lector. | Base compartida en `test-support/reader-state.mjs`, con mapas y colecciones completos. |
| 3 | Inicio se seguía preparando mediante progreso/inscripciones de repaso, aunque ahora muestra lecturas activas o borradores propios. Afectaba dos pruebas de títulos y una de Inicio. | Preparar explícitamente el estado de lectura; comprobar la ficha común. Añadir contratos de notas, propiedad, estados y orden. |
| 5 | Expectativas de controles y contenido retirados: `select` de lectura, resumen de idiomas en la ficha y enlace indirecto desde Biblioteca ajena. | Comprobar las tres opciones accesibles, selección, bloqueo en solo lectura y acción explícita de barajas con su recuento. |
| 1 | Se prohibía `review` en todas las traducciones inglesas, incluso «Review the list before confirming». | Aplicar el glosario a las etiquetas de repaso; conservar el uso funcional del verbo en otros contextos. |
| 12 | Se construían bases históricas mediante reemplazos del SQL actual, o bajando solo el número de versión de una base reciente. | Esquemas históricos inmutables extraídos de Git para ambos motores, con procedencia en cada archivo. |

En SQLite, el fixture antiguo conservaba un índice sobre `cards.created_at`
que se intentaba restaurar antes de que esa columna existiera. En PostgreSQL,
el fixture ya traía la columna y la migración intentaba añadirla otra vez.
Las bases simuladas nunca habían existido en esas versiones del producto.
Las migraciones pasan contra los esquemas históricos reales. No ha sido
necesario cambiar lógica de producto ni migraciones para resolver estos fallos.

Las pruebas de migración comparan catálogo, cuentas, sesiones, saldo, progreso
y preferencias anteriores y posteriores. Ejecutan la inicialización dos veces;
conservan cobertura de citas, traducciones, permisos e inmutabilidad. Las notas
históricas reciben fecha nula, sin fabricar actividad reciente.

## Por qué se acumulaban

El diario del 15 de octubre documenta varias publicaciones con build y sintaxis
correctos pero sin ejecutar la suite. También recoge fallos aceptados como
«previos»: 19 en una comprobación completa, seguidos de otros pases parciales.
La auditoría del 13 había terminado en verde, pero ese estado no se convirtió
en un requisito automático de entrega.

El build de Render en el repositorio solo ejecutaba `build:ui`. No había un
workflow de GitHub Actions en el checkout. Por tanto, compilar no detectaba
estos fallos y el proceso permitía seguir publicando mientras se acumulaban.

## Prevención implementada

- **Una comprobación común:** `npm test` compila el bundle y ejecuta todas las pruebas. `AGENTS.md` exige salida 0 al cerrar hitos o publicar cambios de código. Los fallos previos se corrigen o se declaran como bloqueo; no equivalen a verificación completa.
- **CI:** `.github/workflows/tests.yml` ejecuta instalación limpia y suite en PR y push a `main`, usando `.node-version`. No necesita secretos.
- **Despliegue:** el Blueprint pasa a `npm ci --include=dev && npm test`, para que una prueba fallida detenga el build. Las dependencias de prueba se instalan también con `NODE_ENV=production`.
- **Fixtures estables:** estados compartidos de vistas y doce esquemas históricos fijos. El SQL vigente puede evolucionar sin cambiar retroactivamente el punto de partida de una migración antigua.
- **Contratos recientes:** siete pruebas nuevas cubren pertenencia/orden de Inicio, destinos de nota y, en ambos motores, primera nota transaccional, reintentos, permisos, saldo, rollback por fallo de escritura y cierre por lote con lista obsoleta o ajena.
- **IA simulada:** `npm test` precarga un guard que rechaza `fetch` externo. Dos pruebas verifican el bloqueo y el funcionamiento de HTTP local/datos de iconos. Un proveedor sin simular falla antes de llegar a la API.

La CI y el nuevo build de Render están preparados **localmente**. Para que
protejan la entrega remota hay que integrar/publicar estos cambios y
sincronizar el Blueprint; verificar que el Build Command activo coincide.
Como protección adicional, hacer obligatorio `Build and tests` en las reglas
de integración de `main`. No se ha cambiado la configuración remota en esta tarea.

## Verificación

- Suite reparada antes de ampliar contratos: **233/233**.
- Suite final con `NODE_ENV=production`: **240/240**, unos 28 segundos.
- Repetición final habitual: **240/240**, unos 25 segundos.
- Cero pruebas eliminadas, desactivadas u omitidas.
- Blueprint validado contra el JSON Schema oficial de Render; workflow validado como YAML.
- HTTP de pruebas en `127.0.0.1`, SQLite local y PostgreSQL mediante PGlite. Sin consultas a producción ni llamadas reales a OpenAI.

En el sandbox, los tests HTTP fallan con `EPERM` si no pueden abrir puertos
locales. La referencia y los pases finales se ejecutaron con ese acceso
habilitado. Ese fallo de entorno se distinguió de los 27 fallos del checkout.
