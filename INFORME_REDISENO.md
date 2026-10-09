# Killaq · Informe de la actualización

9 de octubre de 2026 · Campañas, categorías y pieza exclusiva

La tienda conserva la composición y la identidad de blanco cálido, dorado y negro. Esta actualización suma una segunda campaña, imágenes de referencia para las cinco categorías y un apartado administrable para un modelo exclusivo de colección.

## Cómo quedó

| Área | Resultado |
| --- | --- |
| Portada | Se mantiene el anillo dorado sobre negro. La segunda campaña presenta un collar sobre negro, dentro del mismo arco. |
| Animación | Fundido de 1,25 segundos y acercamiento suave; transición breve en los textos. Rotación cada 9 segundos, configurable, con flechas y pausa. Se detiene al interactuar y respeta movimiento reducido. |
| Categorías | Fotografías de referencia generadas para Anillos, Collares, Aretes, Pulseras y Charms. Oro sobre negro y aretes plateados sobre dorado. Las fotos propias del catálogo tienen prioridad. |
| Subcategorías | Estilos separados bajo cada categoría, en el menú y en los filtros. Anillos: compromiso, matrimonio, moda y sellos. Collares: cadenas, dijes y gargantillas. Aretes: argollas, broqueles y largos. Pulseras: brazaletes, cadenas y amuletos. Charms: símbolos, iniciales y piedras. |
| Modelo exclusivo | Bloque especial de portada con foto, colección, nombre y precio reales. Se puede mostrar u ocultar desde el panel. |
| Móvil | Dos categorías por fila, menú desplazable, filtros plegables y controles de carrusel y estilos con mayor área táctil. |
| Identidad existente | Se conservan la bienvenida del logo y anillo, la página de atención personalizada y la animación del proceso artesanal. |

Las cinco imágenes son referencias de campaña, identificadas como tales; no representan productos ni existencias reales. Los PNG originales, los WebP de 1200 px y los prompts de `imagegen` están documentados en `design-assets/IMAGENES_REFERENCIA.md`. Los cinco WebP suman aproximadamente 280 KB.

## Cómo administrar el exclusivo

1. Entrar con una cuenta cuyo perfil tenga rol `admin`.
2. En **Pieza exclusiva** (`/admin/exclusivos`), crear una colección si todavía no existe.
3. En **Productos** (`/admin/productos`), publicar la pieza, cargar su imagen y asignarle categoría, subcategoría y colección.
4. Volver a **Pieza exclusiva**, seleccionar el modelo, editar el título y la descripción, marcar «Mostrar pieza exclusiva» y guardar.
5. Desmarcar la opción para ocultar el apartado. Si la pieza se despublica, pierde su imagen o pertenece a una colección inactiva, el bloque también permanece oculto.

El apartado empieza oculto. Una colección creada por sí sola no publica contenido. El panel valida que el estilo corresponda a la categoría seleccionada, y el SQL incorpora la misma validación. Los ajustes de Experiencia de marca y Pieza exclusiva conservan los campos del otro apartado al guardar.

Las campañas se editan en `/admin/carrusel`; la rotación e intervalo, en `/admin/experiencia`. Las campañas activas propias reemplazan el contenido de respaldo, y una campaña desactivada permanece desactivada.

## SQL manual

**Nuevo archivo: `src/sql/005_categories_and_exclusive_showcase.sql`.** Copiarlo completo al SQL Editor de Supabase después del 004. Si aún no se aplicaron los anteriores, seguir **001 → 002 → 003 → 004 → 005**. No se ejecutó SQL en Supabase remoto.

El 005 agrega Charms y sus estilos, completa imágenes vacías sin sobrescribir fotos propias, añade la segunda campaña de Killaq y configura el exclusivo oculto. Activa la rotación en su primera aplicación; si se repite, conserva la elección posterior del administrador. No crea productos de ejemplo y no reactiva campañas deshabilitadas.

## Verificación

- Lint y compilación de producción sin errores; 19 rutas generadas.
- Once pruebas de carrito, configuración, categorías y condiciones de visibilidad del exclusivo.
- Cinco migraciones ejecutadas dos veces en PostgreSQL local con PGlite. Comprobación de roles, conservación de ajustes, campaña única, imágenes propias y rechazo de subcategorías de otra categoría.
- Prueba del admin en una aplicación aislada con datos locales: creación de colección, selección de producto, mostrar/ocultar el bloque y reinicio del estilo al cambiar de categoría. Los filtros Símbolos e Iniciales mostraron resultados distintos según la pieza de prueba.
- Revisión visual local de portada y catálogo a 320, 390 y 1440 px, sin desbordamiento horizontal; carga de las imágenes y navegación a los filtros. La herramienta de navegador no estuvo disponible para repetir la revisión visual después del último ajuste de áreas táctiles; la publicación se comprueba también por HTTP.

El catálogo remoto consultado sigue sin productos públicos. Las pruebas administrativas locales no sustituyen la comprobación con una cuenta admin real después de aplicar las migraciones. No se enviaron mensajes ni pagos reales. La compra continúa coordinándose por WhatsApp.

## Próximas mejoras útiles

La prioridad es cargar un catálogo pequeño con fotografías reales, precios, tallas y stock. Después conviene incorporar una guía de tallas y cuidados, fotos de las piezas puestas, y material auténtico del taller. Una bandeja de consultas y pedidos facilitaría el seguimiento; la integración de pagos requiere completar conjuntamente pedidos, stock y envíos.
