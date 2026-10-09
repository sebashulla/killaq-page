# Killaq Joyería Fina

Tienda en Next.js 16.4, React 19 y Supabase, con Motion para las animaciones. El proyecto conserva el catálogo y la administración existentes e incorpora la nueva dirección visual de marca.

## Desarrollo local

Requiere Node.js 24 para ejecutar también las pruebas TypeScript nativas.

```bash
npm install
npm run dev -- --hostname 127.0.0.1
```

Abrir http://localhost:3000. El servidor de desarrollo actualiza la vista al guardar archivos. La bienvenida puede repetirse con el botón «Ver bienvenida» de la portada.

Configurar `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No usar una clave de servicio en el frontend. Sin conexión no se inventan productos; la tienda muestra estados de carga, indisponibilidad o catálogo en preparación.

## Migraciones pendientes

Los archivos no se ejecutaron en el proyecto remoto. Copiar cada archivo completo al SQL Editor de Supabase, en orden:

1. `src/sql/001_restore_media.sql`.
2. `src/sql/002_harden_store_permissions.sql`.
3. `src/sql/003_restore_complaints_book.sql`.
4. `src/sql/004_brand_and_storefront.sql`.
5. `src/sql/005_categories_and_exclusive_showcase.sql`.

Las cinco migraciones son idempotentes, usan transacciones y se probaron en PostgreSQL local mediante PGlite. Ver `src/sql/README.md`. No volver a ejecutar el esquema base completo sobre la base existente.

## Marca y atención personalizada

La paleta actual combina blanco cálido, dorado y negro. La portada conserva el anillo sobre negro y agrega una segunda campaña de collares, con transición suave y controles de pausa. La rotación predeterminada es de 9 segundos y se detiene al interactuar o usar movimiento reducido. `/atencion-personalizada` presenta una animación artesanal y prepara una consulta por WhatsApp según pieza, material e idea del visitante.

En `/admin/carrusel` se administran campañas, fondos y encuadres con vista previa. En `/admin/experiencia` se controlan animaciones, rotación, título, descripción y número de consultas personalizadas. Para configurar los nuevos fondos, aplicar el archivo 004. La consulta pública puede usar la composición local mientras está pendiente.

Informe de esta iteración: `INFORME_REDISENO.md`.

La revisión de móviles y tablets del 9 de octubre está documentada en `RESPONSIVE_AUDIT.md`, con comparaciones antes/después en `screenshots/responsive/`. Conserva la composición de escritorio, adapta la pasarela, categorías, filtros y footer, y corrige el movimiento reducido de la animación artesanal. Los scripts `audit:responsive`, `test:responsive`, `compare:responsive` y `audit:stability` permiten repetir la verificación con Playwright. Esta iteración no modifica SQL.

## Categorías y pieza exclusiva

Anillos, Collares, Aretes, Pulseras y Charms tienen imágenes de referencia generadas y enlaces separados a sus estilos. Las imágenes propias de Supabase tienen prioridad. Originales, versiones WebP y prompts: `design-assets/IMAGENES_REFERENCIA.md`. Las referencias no crean productos ni existencias.

El 005 agrega Charms y subcategorías, completa solo imágenes vacías, incorpora la segunda campaña y activa la rotación en su primera aplicación. Si se repite, conserva los ajustes posteriores del administrador. No reactiva una campaña deshabilitada.

En `/admin/exclusivos` puedes crear una colección, editar el texto del apartado, elegir una pieza y mostrarla u ocultarla. En `/admin/productos`, asigna categoría, subcategoría y colección a cada modelo. El apartado solo aparece si la pieza elegida está publicada, tiene una imagen y pertenece a una colección activa; permanece oculto inicialmente.

## GitHub y Vercel

El repositorio contiene la aplicación en su raíz. En Vercel usa Next.js, Root Directory `./` y Node.js 24. Los comandos de instalación y compilación están en `vercel.json`.

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en las variables de Vercel para producción y vistas previas. Utiliza la clave pública del proyecto y sus políticas RLS. `.env.local`, credenciales, registros locales y archivos de Vercel se mantienen fuera de Git. `.env.example` muestra los nombres sin valores reales.

Las migraciones SQL siguen siendo manuales: publicar la web no las ejecuta en Supabase.

## Comprobaciones

```bash
npm run lint
npm run build
npm test
npm run check:supabase
npm audit --omit=dev
```

`npm test` verifica cantidades, stock compartido entre tallas, carrito corrupto, configuración de marca, fondos por material, categorías, visibilidad del exclusivo, idempotencia SQL y permisos de visitante, cliente y administrador. La fixture SQL local reproduce las tablas y roles usados por las migraciones; no utiliza credenciales ni escribe en Supabase.

`check:supabase` solo consulta tablas con la clave pública y sus políticas RLS. Informa conteos y errores de esquema, sin imprimir claves ni registros personales.

En la revisión del 8 de octubre de 2026 pasaron lint, build y las pruebas del carrito y SQL. Se comprobaron portada, menú, búsqueda, filtros y navegación con tamaños de 320, 390 y 1440 px, sin desbordamiento horizontal. La bienvenida se pudo repetir y omitir, y devolvió el foco al botón de origen. Las rutas públicas respondieron correctamente; un producto inexistente devuelve 404 y `noindex`.

Las fichas de producto se cargan desde el servidor con título y descripción propios. La galería y selección de talla siguen siendo interactivas. El panel permite configurar tallas, conserva imágenes secundarias al quitar la principal y muestra errores reales al guardar medios.

Capturas de la revisión: `screenshots/killaq-preview-v2.jpg`, `screenshots/killaq-desktop-v2.jpg` y `screenshots/killaq-mobile-v2.jpg`.

Capturas de la identidad dorada: `screenshots/killaq-preview-v3.jpg`, `screenshots/killaq-personalizada-v3.jpg` y `screenshots/killaq-personalizada-mobile-v3.jpg`.

## Estado comercial de esta revisión

- Supabase reactivado: consulta pública exitosa, 4 categorías, 5 materiales y ningún producto público disponible.
- Se detectaron tablas ausentes de videos de producto, videos sociales y reclamaciones. Los archivos 001 y 003 las restauran.
- El pedido se coordina por WhatsApp. No hay cobro con tarjeta, reserva automática de stock ni creación automática de pedidos al abrir WhatsApp.
- El carrito vuelve a consultar precio y stock antes de habilitar la coordinación; el equipo confirma disponibilidad y envío.
- El teléfono y correo visibles mantienen los valores existentes en el frontend. Los `site_settings` remotos contienen números de ejemplo distintos: confirmar los canales comerciales definitivos antes de publicación.
- No se enviaron mensajes, formularios ni pagos reales durante la revisión. No se inició sesión como administrador ni se validaron escrituras administrativas remotas.
- La nueva sección exclusiva y la asignación de estilos se probaron en una aplicación aislada con datos locales: mostrar/ocultar, validación de pieza, creación de colección y cambio de categoría. No hubo escrituras en Supabase remoto.
- La auditoría de dependencias de producción quedó sin vulnerabilidades reportadas. Persisten cinco avisos altos transitivos en la cadena de ESLint (`braces` / `micromatch` / `fast-glob`); `npm audit` no ofrece una corrección compatible. No se forzó un downgrade de Next.js.

La dirección visual, el archivo del anillo y su prompt están documentados en `BRAND_IDENTITY.md`.
