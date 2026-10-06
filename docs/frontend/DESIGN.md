# Dirección de diseño

## Producto

Reedleaves es el nombre oficial del proyecto, la web y la app de repaso de ideas de libros de crecimiento personal. Usar siempre esta escritura, sin traducirla ni separar las palabras. Cada libro admite varias barajas creadas por usuarios. Cada baraja contiene un árbol de cartas. El usuario elige su recorrido en anchura o profundidad y recibe una idea aleatoria al día.

Logo y mascota quedan aprobados. El trabajo activo pasa a la funcionalidad: `app/index.html`, con cinco libros, seis barajas y 42 cartas. Los 7 hábitos conserva sus siete principales en nuestra baraja original y ofrece una segunda organización en dos niveles. Ver `docs/frontend/READER_SPIKE.md` y `docs/architecture/CATALOG.md`.

## Principios no negociables

1. **Simplicidad funcional.** Una pantalla, una decisión principal.
2. **Pomposidad estética.** La app debe sentirse viva, juguetona y recompensante, con el nivel de expresividad de productos como Duolingo o Forest.
3. **Pocos casos de uso.** Priorizar descubrir un libro, recorrer sus tarjetas y recibir la tarjeta del día.

Estas reglas aplican a dirección de arte, UX, animaciones, copy y componentes. Cualquier ampliación futura debe conservarlas.

## Modelo actual

- Libro: título, autor e intereses; varias barajas, no un único árbol.
- Baraja: libro, usuario creador, enfoque y versiones del árbol. Cartas y profundidad se calculan.
- Carta: versión, padre, título, texto y orden entre hermanas.
- Hoja: una unidad de avance; una carta nueva cuesta una hoja, también si es hija. Se gana una al día, con un saldo máximo de tres.
- `DailyCard`: una idea aleatoria del día, independiente del avance del repaso.
- Lectura del libro original: sin empezar, leyendo o leído; selección manual.
- Repaso: cartas vistas por usuario y versión. Termina al recorrer todas, incluidas las hijas.

La estructura debe seguir siendo plana, textual y portable para permitir autoría por usuarios en una fase posterior.

## UX base

- Sin sesión: acceso con usuario y contraseña y opción de crear cuenta. Dos campos con etiquetas, errores breves y exploración del catálogo sin cuenta. No añadir correo, confirmación de contraseña ni proveedores. Al entrar, retomar la baraja solicitada; no gastar una hoja al registrarse.
- Inicio: solo libros con repasos activos, representados como libros cerrados. Contenedor propio con portada, lomo y canto de páginas; no un icono de libro dentro de una tarjeta genérica. Un libro por contenedor, aunque tenga varios repasos activos. Sin árbol, tarjeta diaria, lemas ni título visible redundante. Una baraja elegida aparece aunque aún no se haya gastado su primera hoja; las terminadas se consultan desde Libros.
- Pulsar un libro con un solo repaso activo abre directamente su recorrido, sin gastar hojas. Si tiene varios, abre sus barajas para elegir. El árbol solo se muestra dentro del repaso.
- Cabecera: logo sin texto, icono de hoja con saldo numérico y botón de ajustes. Idioma dentro de ajustes; etiquetas accesibles sin texto adicional visible.
- Idea del día: acceso secundario desde Inicio. Conserva el sorteo y la acción de repasar el libro, en su propia pantalla.
- Sorteo: filtros plegados con leyendo, leídos, repasando, repasados, intereses y todos los libros. Los grupos se unen sin duplicar candidatos. «Todos» sustituye al resto.
- Una idea aleatoria por fecha de la cuenta, calculada en servidor, estable al recargar y cambiar de idioma. Una vez asignada, los filtros afectan al siguiente día; esta decisión está pendiente de confirmación.
- Repasar un libro abre primero una cuadrícula compacta de barajas: título, recomendación, idioma, cartas y niveles. Al elegir una se abre una ficha modal con autor, enfoque, métricas, progreso y «Repasar esta baraja».
- Recomendación del equipo primero. Más popular = personas que empezaron; preferida = más me gusta; más terminada = personas que terminaron. Deduplicar ganadoras y no conceder etiquetas con cero actividad.
- Repasar: una hoja nueva por fecha local, acumulable hasta tres. Se pueden gastar las acumuladas el mismo día. El árbol completo se despliega de arriba hacia abajo y usa el scroll vertical de la página. Cartas ya repasadas se pueden abrir gratis; las siguientes válidas muestran el coste de una hoja; el resto aparece bloqueado y sin título visible.
- La divisa «hoja» usa una hoja única grande, sin círculo, rayitas ni cara; distinta de la mascota de dos hojas. En la cabecera aparece junto al saldo numérico, sin texto.
- No saltar a hijas sin ver su madre ni a hermanas posteriores sin la anterior. El orden no obliga a terminar las hijas antes de pasar al bloque siguiente.
- Ver una idea aleatoria no desbloquea esa posición en el repaso.
- Lectura y repaso son independientes: un libro puede estar leído y repasándose.
- Catálogo actual: cinco libros con cantidades de tarjetas distintas. El número y los géneros proceden de la API, nunca de condiciones específicas en la interfaz.
- «Añadir libro»: cuadrícula de todos los libros disponibles, usando el mismo contenedor de libro cerrado de Inicio. Título, autor, intereses y número de barajas; sin formularios en la cuadrícula. Pulsar abre una ficha modal con título completo, descripción, intereses, número de barajas, idiomas de estas y «Ver barajas». La lectura original manual y el estado de repaso automático quedan en la ficha. Misma familia visual y comportamiento modal que las barajas; sin portadas comerciales ni iconos de libro dentro de tarjetas genéricas.
- Desde la ficha se pasa a las barajas del libro, con acceso de vuelta al catálogo. Explorar libros y barajas no añade un repaso ni gasta hojas; eso ocurre al elegir una baraja y abrir cartas, respectivamente.
- Catálogo: un único campo de búsqueda que filtra al escribir. Busca en todos los títulos completos, cortos y originales, en cualquier idioma disponible; ignora mayúsculas, tildes y puntuación. No busca en autores ni descripciones. La búsqueda se conserva al cerrar la ficha, volver de las barajas o cambiar el idioma; se borra al recargar. Sin resultados: mensaje breve y acción para borrar. Actualizar solo los resultados para no perder foco ni cursor al escribir.
- La ficha muestra siempre «Título original» y el título en su idioma original, aunque coincida con el título de la interfaz. Son datos propios del libro; no deducirlos de la traducción inglesa ni del idioma de una baraja. No añadirlos a las portadas pequeñas.
- La ficha de cada libro ofrece dos enlaces secundarios: Amazon para comprar y Goodreads para reseñar. Icono de plataforma, nombre, acción y flecha de enlace externo. Se abren en otra pestaña, sin cambiar progreso ni gastar hojas. «Ver barajas» conserva la prioridad visual; no añadir enlaces dentro de las portadas ni botones de plataformas en el repaso. Las ediciones actuales de Amazon son españolas y la ficha lo indica aunque la interfaz esté en inglés o francés.
- El saldo de hojas es global entre barajas, con máximo de tres. Los días ausentes suman hasta ese límite; los días excedentes no se guardan para después. Revisitar lo ya repasado es gratis. No introducir compras ni recompensas económicas.
- Cuenta, monedero y repaso se guardan en servidor. Durante una petición no se aceptan nuevos clics; una carta se abre solo después de confirmar el gasto. Fallo de red: mensaje breve y reintento, sin progreso provisional. Las actualizaciones de otra sesión no interrumpen campos ni modales abiertos.
- No mostrar mapas numéricos de tarjetas, marcas de leído, portadas grandes ni un cierre extra.

## Lenguaje

Usar lenguaje técnico simplificado. El texto de interfaz debe ser corto, directo y humano. Evitar términos internos como `node`, `payload`, `tree`, `schema` o `CRUD`.

## Sistema visual inicial

- Tinta bosque: `#173D2C` — texto y estructura.
- Verde hoja: `#58BE59` — acciones y progreso.
- Verde luz: `#B9E877` — superficies y segunda hoja.
- Salvia: `#779A72` — contorno del libro.
- Verde sombra: `#1E4C2E` — sombra exterior del libro.
- Melocotón: `#FFE0CB` — superficie de la idea del día.
- Crema: `#FFF9ED` — fondo cálido recomendado.
- Radios grandes, sombras suaves y profundidad por capas.

## Logo

El primer logo de tarjetas y estrella queda descartado. La dirección actual combina un libro abierto con la mascota de dos hojas de `brand/sprout/leaf.svg`. El pliegue central del libro debe coincidir con la separación entre las dos hojas. Las pruebas se encuentran en `brand/reed/index.html`.

El logo con libro no lleva ojos ni boca. La cara se reserva para la hoja cuando se transforma en mascota, sin el libro. La hoja ocupa gran parte del libro, con páginas estrechas y margen suficiente por arriba y abajo.

El usuario ha elegido la forma **D · Compacto** con el color **B · Salvia** (`#779A72`) en contorno y pliegue. Se recuperan exactamente las hojas del B original: sin separación adicional, sin estrecharlas y con sus sombras originales. Únicamente la sombra exterior del libro cambia de `#369247` a `#1E4C2E`. Mantener todos los trazados, proporciones y transformaciones del B original. La prueba actual está en `brand/reed/refinement.html`; los ajustes descartados quedan como historial.

El símbolo elegido debe funcionar en tres niveles:

1. Icono plano y reconocible a 24 px.
2. Marca expresiva en portada y navegación.
3. Mascota mínima con ojos, movimiento y estados; sin convertir la app en un juego complejo.

No se usará el símbolo descartado como base de futuras iteraciones.

## Historial de exploración: Sprout

Sprout fue la exploración inicial: lectura y crecimiento conectados por la doble lectura de «hoja» (página / planta). Ver `docs/frontend/SPROUT_SPIKE.md` y `brand/sprout/index.html` como historial, no como nombres vigentes.

**Reedleaves** es el nombre oficial, elegido por el usuario. Reed queda como nombre anterior en el historial. El lema inglés **Read. Plant a seed.** y **De hoja a hoja** en español se conservan. La mascota aprobada es la hoja intermedia de la exploración Sprout. El logo aprobado es **D · Compacto** con líneas **B · Salvia**, hojas originales y sombra exterior del libro oscura. La cabecera de la app sigue usando solo el símbolo; el título de pestaña usa «Reedleaves · [pantalla]». Las rutas `brand/reed/`, los IDs y las claves de almacenamiento se conservan para no romper enlaces ni progreso.

Se contempla una familia futura de mascotas según perfil: semilla, brote, hoja y bucle. No implementar selección ni personalización de mascotas por ahora. La v1 utiliza solo la hoja elegida.

La UI tendrá español, inglés y francés. Los nombres y metadatos de los libros e intereses están en los tres idiomas. Cada portada usa un título corto editorial; la ficha, el título completo. El idioma de cada baraja es independiente del de la interfaz y se muestra tal cual. No presentar traducciones inexistentes como disponibles. La plataforma (web, móvil o ambas) sigue sin decidir. Mantener los prototipos adaptables hasta resolverlo.

## Límites

- No usar estética de dashboard empresarial.
- No usar una pared de tarjetas sin jerarquía.
- No añadir gamificación que no ayude a leer o recordar.
- Limitar la navegación a Inicio, Libros e Idea del día. Ajustes contiene idioma, usuario y cerrar sesión. El acceso no introduce otra sección permanente.
