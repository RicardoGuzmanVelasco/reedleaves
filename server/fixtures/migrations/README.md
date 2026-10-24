# Esquemas históricos para pruebas

Copias de los esquemas publicados, extraídas con `git show <commit>:<ruta>`.
La primera línea de cada SQL identifica su procedencia. No contienen datos de
cuentas ni copias de bases reales.

| Commit | SQLite | PostgreSQL |
| --- | --- | --- |
| db659af | 9 | 1 |
| 8a72ca9 | 10 | 2 |
| 85413a8 | 11 | 3 |
| df62e45 | 12 | 4 |
| f54496c | 13 | 5 |
| e8cf899 | 15 | 7 |
| 9d3cfad | 18 | 10 |
| 36227ed | 19 | — |
| ecb10a6 | 25 | 17 |
| 7ef797c | 26 | 18 |
| c3f20cc | 28 | 20 |
| 117e406 | 29 | 21 |
| 3e482fd | 30 | 22 |
| ff3c943 | 32 | 24 |
| 4706949 | 35 | — |
| feb47a1 | — | 27 |
| 4496429 | 36 | 28 |
| 5acfbf1 | 37 | 29 |

Estas copias son inmutables. Al añadir una migración, guardar aquí el esquema
anterior con otro nombre y añadir una prueba que migre desde él. No regenerar
las copias antiguas desde el esquema nuevo, ni simular una versión anterior
bajando solo `user_version`/`reed_schema`.

`test-support/historical-database.mjs` abre el motor local, comprueba la versión
de partida y carga el catálogo editorial histórico desde `catalog/`, usando el importador congelado en `test-support/historical-seed.mjs`. Estos archivos conservan la estructura antigua exclusivamente para comprobar migraciones; el seed y el catálogo activos no guardan bibliografía. Para v9/v10 de SQLite y v1/v2 de
PostgreSQL, el validador actual del seed necesita temporalmente
`books.creator_user_id`; el helper la retira antes de entregar la base.

Los datos de lectura se insertan con SQL compatible con el esquema antiguo.
Los repositorios actuales solo se invocan después de migrar. Las pruebas
comparan datos anteriores y posteriores y ejecutan la inicialización dos veces.
