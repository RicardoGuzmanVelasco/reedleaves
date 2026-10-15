# Creación de barajas desde Codex mediante MCP

El servidor ofrece `/mcp` con transporte Streamable HTTP. Está desactivado si no se configura `REED_MCP_TOKEN`.

## Herramientas

- `find_book`: busca libros por título, título localizado o autor. Úsala solo si el libro no está claro en la conversación.
- `create_deck`: guarda una baraja completa y sus tarjetas en una transacción. `requestId` es un UUID estable para reintentos; el servidor lo usa como ID de baraja. El propietario técnico y la atribución visible son `reed-team` / «Equipo Reedleaves».
- `append_cards_to_draft`: añade tarjetas a una versión `draft` creada por el equipo. No edita ni elimina tarjetas existentes.

Las tarjetas se validan con las mismas reglas del catálogo. Cada baraja utiliza un idioma, elegido independientemente del idioma original del libro. La versión queda en `draft`, pero los borradores guardados son visibles en el catálogo compartido.

## Activación

1. Genera un secreto aleatorio de al menos 32 caracteres. No lo guardes en Git ni en `codex-plugin/`.
2. Configura ese valor como `REED_MCP_TOKEN` en el entorno del servicio Reedleaves. Para producción, usa el gestor de secretos del servicio.
3. Instala `codex-plugin/` como plugin de Codex y conecta su servidor MCP con autenticación Bearer usando el mismo secreto.
4. Inicia una conversación nueva para que Codex descubra las herramientas del plugin.

La ruta existente `/api/author/decks` mantiene el comportamiento de autoría por cuenta. MCP tiene una ruta independiente y fija la identidad del equipo en el servidor; no acepta `creator_user_id` del modelo.

## Límite actual

El token es una credencial privada de integración y concede estas acciones de equipo a quien lo posea. Si la conexión se amplía a más personas, migrar a OAuth con permisos por cuenta. La unificación del fallback de atribución entre libros y barajas queda pendiente; este flujo ya usa explícitamente `reed-team`.
