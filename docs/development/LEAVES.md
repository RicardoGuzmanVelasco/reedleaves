# Ajustar hojas manualmente

El monedero `leaf_wallets` admite saldos enteros no negativos, incluidos 10 o 100. El abono diario tiene un máximo de tres: si el saldo ya es mayor, lo conserva sin añadir hojas. Añadir una baraja ajena a Decks cuesta una hoja por baraja; las propias aparecen automáticamente. Abrir tarjetas y repasarlas no gasta hojas.

La migración inicial del monedero amplió el saldo máximo permitido por el esquema y conservó las filas existentes. El esquema vigente es SQLite v22 / PostgreSQL v14. Su migración más reciente retira los cobros por abrir tarjetas y conserva el saldo de hojas y el gasto histórico.

`user_id` es el ID interno de `users`, no el nombre de acceso. Solo hay un monedero por usuario: insertar otra fila para la misma cuenta falla por clave duplicada. `last_accrual_day` es obligatorio y usa `YYYY-MM-DD`.

## Desde SQL Editor de Supabase

Después de la migración, sustituir `tu.usuario` por el nombre de acceso guardado en `accounts.username` (en minúsculas) y `100` por el saldo deseado:

```sql
INSERT INTO leaf_wallets (user_id, balance, last_accrual_day)
SELECT user_id, 100,
       to_char(CURRENT_TIMESTAMP AT TIME ZONE time_zone, 'YYYY-MM-DD')
FROM accounts
WHERE username = 'tu.usuario'
ON CONFLICT (user_id) DO UPDATE
SET balance = EXCLUDED.balance,
    last_accrual_day = EXCLUDED.last_accrual_day
RETURNING user_id, balance, last_accrual_day;
```

Deja el saldo total en 100; no suma 100 al saldo existente. Si devuelve cero filas, no existe ese nombre de acceso. La fecha se calcula en la zona de la cuenta para que recargar no añada otra hoja ese día. Después de ejecutarla, recargar la app para ver el saldo actualizado. También se puede editar directamente `balance` en la fila existente desde Table Editor; no modificar `user_id` ni insertar una fila duplicada.

## Desde la terminal del proyecto

```sh
npm run db:leaves -- tu.usuario 100
```

Deja el saldo total en el número indicado. Crea el monedero si falta y lo actualiza si existe. Un usuario desconocido, saldo negativo, decimal o número no representable con precisión provoca un error. Solo está disponible para quien tenga acceso a la terminal y a la base; no hay una ruta pública para modificar hojas.

La selección de base sigue las reglas de los otros comandos: `DATABASE_URL` usa PostgreSQL; sin ella se usa SQLite local (`REED_DB_PATH` o `var/catalog.sqlite`). Para modificar producción, ejecutar con la conexión de producción configurada en el entorno. `npm run` no carga `.env` automáticamente. Si se usa un archivo local de variables:

```sh
node --env-file=.env server/manage.mjs leaves tu.usuario 100
```

No pegar cadenas de conexión ni contraseñas en el chat o en archivos versionados.
