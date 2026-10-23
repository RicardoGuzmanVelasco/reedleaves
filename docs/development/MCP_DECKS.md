# Creación de barajas desde Codex mediante MCP

El servidor ofrece `/mcp` con transporte Streamable HTTP. Está desactivado si no se configura `REED_MCP_TOKEN`.

## Herramientas

- `find_book`: busca libros por título, título localizado o autor. Úsala solo si el libro no está claro en la conversación.
- `create_deck`: guarda una baraja completa y sus tarjetas en una transacción, siempre terminada (`published`). `requestId` es un UUID estable para reintentos; el servidor lo usa como ID de baraja. El propietario técnico y la atribución visible son `reed-team` / «Equipo Reedleaves». Hay que preparar todas las tarjetas antes de guardar: una vez terminada, su contenido queda cerrado. `quoteSourceUrl` es opcional, solo admite HTTPS y se guarda al crear una baraja del equipo que incluya citas. No se ofrece en la autoría de cuentas ni se puede modificar después.
- `list_team_drafts`: lista exclusivamente las barajas en borrador cuyo propietario es `reed-team`, con título, libro, idioma, número de tarjetas e ID de baraja. Admite un filtro opcional `bookId`. No modifica datos y permite localizar los borradores anteriores al cambio de creación.
- `append_cards_to_draft`: añade tarjetas a una baraja `draft` creada por el equipo, identificada por `deckId`. Se conserva para borradores anteriores; las nuevas barajas nacen terminadas. No edita ni elimina tarjetas existentes.
- `finish_deck`: marca como terminada (`published`) una baraja `draft` con tarjetas y cuyo `creator_user_id` es exactamente `reed-team`. Recibe `deckId`; solo se utiliza cuando el usuario pide terminar esa baraja. Repetir el cierre es seguro. Rechaza barajas de otras personas, sin propietario, vacías o archivadas. Tras terminarla no se pueden añadir tarjetas.
- `reassign_deck_creator`: cambia la atribución de una baraja publicada de `reed-team` a una cuenta existente indicada por `username`. La cuenta debe tener permiso para crear barajas. Solo se usa si el usuario pide explícitamente cambiar la atribución de esa baraja. No transfiere barajas de otras cuentas.

Las tarjetas se validan con las mismas reglas del catálogo. Cada baraja utiliza un idioma, elegido independientemente del idioma original del libro. La creación guarda y publica la baraja dentro de la misma transacción: un error revierte baraja y tarjetas, sin dejar un borrador parcial. El resultado devuelve `status: "published"` y los reintentos con el mismo contenido son seguros. Las barajas de cuentas creadas por la ruta habitual conservan su flujo de borrador.

## Activación

1. Genera un secreto aleatorio de al menos 32 caracteres. No lo guardes en Git ni en `codex-plugin/`.
2. Configura ese valor como `REED_MCP_TOKEN` en el entorno del servicio Reedleaves. Para producción, usa el gestor de secretos del servicio.
3. Instala `codex-plugin/` como plugin de Codex y conecta su servidor MCP con autenticación Bearer usando el mismo secreto.
4. Inicia una conversación nueva para que Codex descubra las herramientas del plugin.

La ruta existente `/api/author/decks` mantiene el comportamiento de autoría por cuenta. MCP tiene una ruta independiente y fija la identidad del equipo en el servidor; no acepta `creator_user_id` del modelo.

La transferencia de creador usa una regla limitada en la base de datos: solo permite pasar una baraja publicada de `reed-team` a una cuenta con permiso de autoría. Los cambios entre cuentas personales y los cambios de libro siguen bloqueados.

## Límite actual

El token es una credencial privada de integración y concede estas acciones de equipo a quien lo posea. Si la conexión se amplía a más personas, migrar a OAuth con permisos por cuenta. La unificación del fallback de atribución entre libros y barajas queda pendiente; este flujo ya usa explícitamente `reed-team`.
