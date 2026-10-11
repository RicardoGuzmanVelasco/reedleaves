# Ajustar hojas manualmente

El monedero `leaf_wallets` admite saldos enteros no negativos, incluidos 10 o 100. Solo el abono diario tiene un máximo de tres: si el saldo ya es mayor, lo conserva sin añadir hojas. Las hojas manuales se mantienen hasta gastarlas. Cuando el saldo baja de tres vuelve el abono diario, sin recuperar días descartados.

El esquema anterior limitaba todo el saldo a tres, y por eso el editor rechazaba cantidades mayores. Arrancar la versión actual (o ejecutar `npm run db:init`) migra SQLite v13 → v14 y PostgreSQL v5 → v6, conservando las filas existentes. Desplegar el cambio antes de editar un saldo mayor de tres en producción: la versión antigua de la aplicación no sabe conservarlo. La migración prepara el esquema; no regala hojas ni altera ningún saldo.

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
