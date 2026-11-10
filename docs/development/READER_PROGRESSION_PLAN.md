# Progresión lectora · Plan de implementación

Estado: incrementos 1–12 completados en `Staging`. El cierre local del incremento 12 pasó `npm test` en el SHA `06e803a` (683 pruebas, 0 fallos). No se ha consultado el estado de CI ni la promoción a producción. El incremento 8 permite revisar cada guía individualmente con comandos administrativos; los roles de Archivista y la cola dentro de la app siguen fuera de alcance. Cada incremento se entrega de forma autocontenida y puede publicarse por separado.

## Objetivo

Incorporar progresión global del lector basada en XP. Mostrar nivel, apellido y etapa en el perfil, con la mascota global correspondiente y el avance hasta el siguiente nivel. Conservar separada la progresión de las mascotas individuales de cada libro, que continúa dependiendo de los días distintos de repaso completados en ese libro.

## Reglas acordadas

### Niveles y etapas

| Etapa | Niveles | Apellidos o regla |
| --- | ---: | --- |
| Maceta | 1–2 | Vacía, Barnizada |
| Tierra | 3–8 | Virgen, Húmeda, Fértil, Abonada, Nutrida, Viva |
| Semilla | 9–12 | Dormida, Latente, Palpitante, Despierta |
| Raíz | 13–16 | Tímida, Exploradora, Profunda I, Profunda II |
| Germen | 17–22 | Naciente, Incipiente, Emergente I, Emergente II, Vigoroso I, Vigoroso II |
| Brote | 23–31 | Tierno, Prometedor, Fresco I, Fresco II, Verde I, Verde II, Verde III, Resistente I, Resistente II |
| Tallo | 32–41 | Joven, Erguido, Firme I, Firme II, Robusto I, Robusto II, Inquebrantable I, Inquebrantable II, Imponente I, Imponente II |
| Capullo | 42–50 | Tímido, Protegido, Resguardado, Inquieto, Silvestre, Inmaduro, Maduro, Paciente, Impaciente |
| Flor | 51–59 | Naciente, Delicada, Colorida, Fragante, Radiante, Exuberante, Resplandeciente, Majestuosa, Espléndida |
| Siempreverde | 60 en adelante | Numerales romanos crecientes, empezando por I en el nivel 60 |

La mascota global del usuario avanza con su nivel de XP. Los rangos de cada etapa determinan el icono de perfil y el cambio visual de esa mascota. La mascota de un libro mantiene su algoritmo actual basado en los días de repaso de ese libro. No mezclar ambas fuentes de progreso.

El documento Numbers editado por el usuario es la referencia editorial para apellidos y numerales existentes. Al convertirlo en datos de producto, mantener explícitas las secuencias y los recortes acordados aquí.

### XP y ritmo

- Hitos acumulados: nivel 1 = 0, 3 = 110, 6 = 330, 9 = 660, 13 = 1.100, 20 = 2.200, 30 = 3.300, 40 = 4.400, 50 = 5.500 y 60 = 6.600 XP.
- Interpolar linealmente los niveles intermedios y redondear al múltiplo de 5 más cercano. La curva de los niveles 1–60 es provisional, pero sus hitos acordados se conservan.
- Desde el nivel 61, el coste del siguiente nivel crece en 5 XP respecto del anterior. Para el nivel n, con k = n − 60, la XP acumulada es 6.600 + 110k + 5k(k+1)/2. Por ejemplo, pasar del 60 al 61 cuesta 115 XP.
- La hipótesis de 110 XP por día activo solo se usa en estimaciones. No es meta diaria ni límite de ganancia.
- No conceder XP retroactiva. La cuenta de XP empieza con el lanzamiento del sistema.
- Mantener XP, nivel y mascota global entre sesiones y dispositivos.

### Recompensas

| Acción | XP | Condición |
| --- | ---: | --- |
| Leer la idea del día | 20 | Una vez por persona e idea |
| Completar una sesión de repaso | 25 | Una vez por sesión completada, sin deduplicar por tarjetas repasadas |
| Guardar una nota nueva | 15 | Una vez por nota; editarla no vuelve a conceder XP |
| Guía de lectura aprobada | 30 | Tras revisión editorial manual y una vez por guía |
| «Me gusta» recibido | 5 | Una vez por persona que reacciona y contenido |
| Guardado recibido | 10 | Una vez por persona que guarda y contenido |

Cada guía se revisa y aprueba o rechaza individualmente; el estado editorial compartido `draft/reviewed` del libro no sirve para decidir sobre varias guías a la vez. Las guías siguen visibles desde el envío y muestran un aviso de que aún no están aprobadas, similar al borrador de una baraja. Su autor ve 30 XP fantasma, separados del saldo confirmado y excluidos del nivel y la barra. La aprobación acredita esos 30 XP una sola vez y anuncia la ganancia; el rechazo informa al autor y retira la cantidad pendiente. La cola de aprobación dentro de la app y los roles de Archivista quedan fuera de estos incrementos y se planifican aparte.

No retirar XP ya concedida por eventos que después se invaliden. El sistema podrá admitir reversiones en el futuro, pero no las implementa esta etapa.

## Experiencia

- En el perfil propio, reemplazar el avatar placeholder por la mascota global en su etapa actual. Mostrar nombre y apellido del nivel junto al nombre, fecha de creación y demás datos que ya contiene el perfil.
- Añadir una barra con XP actual y avance hasta el siguiente nivel.
- En perfiles ajenos, mostrar nivel, apellido y etapa. Mantener privada la XP exacta y la barra detallada.
- Al ganar XP, mostrar un toast desde abajo con la ganancia y el avance actualizado. Al subir de nivel, usar una celebración muy expresiva, inspirada en el feedback de crecimiento de mascotas.
- Respetar `prefers-reduced-motion` con una presentación calmada que conserve el anuncio y la información.
- El nivel se presenta por su nombre y apellido. No crear insignias todavía. Dejar las insignias para una fase futura.
- Mantener la interfaz y el copy de plataforma en español e inglés.

## Incrementos

Cada número es un hito separado. No acumular trabajo de incrementos distintos en un único lote sin publicar. Mantener cada cambio pequeño, desplegable y compatible con la versión ya publicada.

### 1. Fuente de verdad para niveles y XP

Definir en el servidor o en un módulo de dominio compartido la tabla completa de niveles 1–60, los nombres, las etapas, los hitos y la fórmula de niveles posteriores. Generar los intermedios desde hitos en un solo lugar. Añadir pruebas unitarias de límites, redondeo, nombres, nivel 60 y continuidad desde el 61.

### 2. Esquema persistente del saldo e historial

Añadir almacenamiento de XP por usuario y un ledger de eventos concedidos. Usar claves idempotentes que impidan duplicar la misma recompensa tras reintentos o concurrencia. No guardar secretos ni confiar en XP enviada por el cliente. Crear fixtures históricos inmutables de SQLite y PostgreSQL según los contratos actuales de migración.

### 3. API y cálculo de nivel

Exponer saldo, nivel derivado y etapa global en el estado autenticado. Derivar todo desde XP persistida y la fuente de verdad del incremento 1. Mantener la respuesta pública del perfil limitada a nivel, nombre completo y etapa. La XP exacta y el progreso de la barra solo se incluyen al consultar el perfil propio.

### 4. Recompensa por idea del día

Conceder 20 XP cuando la persona abre y lee la idea actual por primera vez. Atar la idempotencia a persona e idea. Usar el ciclo diario centralizado de la app para identificar la idea vigente. Reabrirla no concede de nuevo.

### 5. Recompensa por repaso completado

Conceder 25 XP al completar una sesión. Registrar un único evento por sesión completada. Empezar y abandonar una sesión no concede XP. Una sesión nueva completada sí concede XP aunque repita las tarjetas de sesiones anteriores.

### 6. Recompensa por nota nueva

Conceder 15 XP al guardar una nota nueva. La identidad persistente de la nota impide repetir la ganancia por editar, reintentar o guardar cambios. Reutilizar la transacción y la idempotencia de la captura de notas ya existente.

### 7. Recompensas sociales

Conceder 5 XP por «me gusta» recibido y 10 XP por guardado recibido. La clave combina receptor, actor, acción y contenido. Un actor no puede volver a conceder esa recompensa al mismo contenido mediante alternar la acción.

### 8. Guía pendiente y aprobación editorial

Registrar el estado de revisión por guía, con decisiones individuales de aprobar o rechazar. Mantener las guías visibles desde el envío y mostrar que siguen pendientes de aprobación, en un patrón parecido al borrador de una baraja. El autor ve 30 XP fantasma por guía pendiente, fuera del saldo y del nivel. La aprobación convierte una sola vez el pendiente en XP real; el rechazo lo retira e informa al autor.

La primera versión de la revisión se operó por CLI. El incremento de Archivista añade roles persistentes y la bandeja interna en la app. Solo el servidor concede acceso; la migración asigna el rol a la cuenta `ricardo` si ya existe. Las demás asignaciones requieren una operación administrativa, nunca una acción del cliente. El detalle completo y el motivo de rechazo son visibles solo para Archivistas y el autor correspondiente. Una decisión verifica una huella del contenido leído para impedir aprobar una versión editada en paralelo. Aprobar confirma los 30 XP del autor; el Archivista no gana XP por moderar.

Los comandos administrativos de roles son `npm run db:role-grant -- <usuario> archivist` y `npm run db:role-revoke -- <usuario> archivist`.

### 9. Mascota global por nivel

Añadir un cálculo independiente para la mascota global, determinado por el nivel de XP y los rangos de etapa acordados. No alterar `currentMascotStage` ni el progreso por libro. Cubrir con pruebas que diferentes libros conservan sus etapas basadas en sus días de repaso mientras el perfil muestra la etapa global.

### 10. Perfil propio y ajeno

Integrar la mascota global y el nivel en ambas vistas de perfil. Añadir la barra detallada solo al perfil propio. Localizar en español e inglés, conservar estados de carga y error, y comprobar accesibilidad y tamaños móviles.

### 11. Feedback de XP y subida de nivel

Añadir el toast inferior de ganancia de XP con avance actualizado y el anuncio de subida de nivel. La subida celebra el cambio de mascota global con tratamiento visual expresivo. Mantener foco, anuncio accesible, movimiento reducido y cierre sin bloquear la lectura.

### 12. Revisión de integración y saldo inaugural

Comprobar deduplicación bajo repetición y concurrencia, permisos de perfil propio y ajeno, flujos existentes de repaso/notas/votación/guardado y estados de revisión de guía. Confirmar explícitamente que las cuentas anteriores empiezan con 0 XP, sin reconstrucción del historial. El cierre técnico de cada incremento cumple las reglas vigentes de pruebas y migraciones.

Verificado localmente en ambos motores: la migración deja en 0 el saldo de cuentas existentes, las recompensas se deduplican y la XP exacta queda privada al perfil propio. Los flujos existentes y la revisión individual de guías pasan en la suite completa del SHA `06e803a`.

## Entrega por incremento

- Trabajar en la rama compartida `Staging`.
- Cerrar y subir cada incremento por separado a `Staging`, para que el progreso no quede acumulado en un lote.
- En cuanto un incremento esté completo, continuar con el siguiente sin esperar a que termine la CI, la promoción a `main` ni el despliegue a Render.
- Se puede asignar a una persona agente Luna ligera la vigilancia de la CI del incremento recién subido. Si detecta un fallo, avisará para corregirlo; esa vigilancia no bloquea el trabajo del siguiente incremento.
- La CI ejecuta lint, build y la suite completa. Si pasa, promueve automáticamente el SHA verificado a `main`; Render publica `main`. No saltar CI ni hacer push directo a `main`.
- Comunicar el SHA y el estado de entrega de cada incremento al terminarlo. No afirmar que está en producción sin verificarlo; no seguir CI, promoción o Render por defecto.
- Las pruebas locales y la CI siguen los requisitos vigentes de `AGENTS.md`. Ejecutar `npm test` con Node de `.node-version` antes de cerrar un incremento de código. Reutilizar `test-support/reader-state.mjs` para estados base de vistas y usar proveedores simulados en pruebas de IA.

## Delegación de tareas

- Delegar en **Astra** los incrementos de mayor complejidad y los que incluyan propuesta visual de UI/UX. Esto incluye el diseño de celebración de nivel, el tratamiento de perfil y el comportamiento de la barra cuando requieran decisiones visuales relevantes.
- Mantener **Luna** para cambios sencillos, tareas repetitivas, ajustes acotados y trabajo bien especificado.
- Si hay duda sobre si una tarea supera la complejidad sencilla, encargar la evaluación o ejecución a **Sol** antes de asumir que corresponde a Luna.
- El agente delegado entrega una unidad con alcance delimitado y su verificación. Integrar y revisar antes del push del incremento correspondiente.

## Fuera de alcance por ahora

- Insignias de nivel.
- Gestión de roles distinta del rol inicial Archivista.
- Gestión de Archivistas desde la propia interfaz; la asignación inicial usa la vía administrativa.
- XP retroactiva.
- Retirar XP ya concedida cuando se invalida el evento.
- Las reglas de XP posteriores al nivel 60 distintas de la fórmula acordada.
