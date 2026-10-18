# ADR 0002 — Barajas en el catálogo común

- Fecha: 2026-10-11; revisión del modelo: 2026-10-18.
- Estado: aceptada.

## Decisión vigente

Crear una baraja la incorpora al catálogo común. Sus tarjetas se comparten al
guardarlas. El estado `draft` conserva la capacidad de edición de su creador;
la visibilidad no concede permisos de autoría. Las cuentas pueden encontrar,
abrir y añadir barajas compartidas a Decks.

Una baraja mantiene un ID estable. Las correcciones de título, textos,
metadatos y relaciones entre tarjetas deben actualizar la misma baraja y
conservar los IDs afectados. El modelo no guarda entidades separadas ni
congela copias del contenido por cada corrección. Las tarjetas, prácticas,
respuestas, selección y pertenencia a Decks referencian directamente la baraja
o la tarjeta correspondiente. La eliminación de tarjetas publicadas sigue
protegida por las reglas existentes.

El estado editorial `draft`, `published` o `archived` pertenece a la baraja.
La interfaz muestra `draft` como **Borrador / Draft** y `published` como
**Terminada / Finished**. Terminar una baraja cambia su estado, pero no crea una
copia. Las reglas de edición y cierre siguen aplicándose al estado y al
propietario.

## Consecuencias

- Una corrección conserva los IDs de baraja y tarjeta y, con ellos, las
  referencias de las cuentas y las prácticas existentes.
- Las tarjetas nuevas se añaden a la misma baraja. No hay historial de
  versiones ni estado de repaso separado para cada edición.
- Las barajas de cuentas y sus tarjetas son visibles en el catálogo común;
  editar su contenido sigue reservado a quien las creó.
- No se añade un selector de privacidad ni un flujo de publicación distinto
  del estado de creación.
- La migración de base de datos aplana únicamente barajas con una sola versión
  histórica identificable. Si encuentra varias versiones o una relación
  ambigua, aborta sin combinar ni descartar contenido.

## Decisión anterior

El diseño inicial congelaba las barajas publicadas y proponía crear una nueva
versión al añadir tarjetas. Esa decisión queda sustituida por el modelo mutable
vigente arriba. Las referencias a versiones en diarios, fixtures y migraciones
describen el formato histórico necesario para conservar y migrar esos datos;
no forman parte del modelo actual.
