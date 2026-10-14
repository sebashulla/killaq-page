# KILLAQ · Admin 2.0

Revisión del 9–10 de octubre de 2026. Implementación local sobre el proyecto existente. La tienda pública conserva su diseño. No se escribieron datos en Supabase remoto ni se realizó un despliegue de esta revisión.

## Resultado y alcance

El administrador ahora agrupa catálogo, contenido, operaciones y configuración. Conserva la tipografía Cormorant existente, blanco cálido, crema, tinta y dorado. Las tablas tienen más densidad, los formularios usan secciones y columnas adaptativas, y las acciones comparten tamaños y estados. No se incorporó un framework visual ni otra dependencia de producción.

Las funcionalidades disponibles son reales: productos, colecciones de la tabla existente, campañas, videos, ajustes de marca, pieza exclusiva y expedientes. No se creó una pantalla ficticia de pedidos ni se presentó una venta de S/ 0 como dato validado. Los guardados atómicos nuevos necesitan la migración 007. Las dependencias pendientes del Libro siguen visibles.

## Auditoría y criterios utilizados

| Hallazgo | Naturaleza | Cambio |
| --- | --- | --- |
| Navegación plana y lateral horizontal en celulares | UX | Grupos, iconos Lucide, estado activo, lateral contraíble y drawer nativo móvil con Escape y retorno del foco. |
| Estadísticas inicializadas a cero aunque la consulta fallase | Funcional | Conteos independientes; `null` y mensaje de indisponibilidad ante fallos. Hora de consulta visible. |
| Ventas y pedidos sin flujo real de cobro o gestión | Operativo | Aviso explícito de fuente no configurada; no se usa la vista antigua como prueba de ingresos. |
| Consultas de videos y metadatos que ignoraban errores | Funcional | API y estados de error; una tabla ausente no aparece como un catálogo vacío confirmado. |
| Formularios largos en modales, etiquetas sin asociación | UX/accesibilidad | Editor de página, secciones numeradas, etiquetas asociadas, errores de campos, vista previa y barra de guardado. |
| Publicación del producto antes de guardar su imagen/video | Integridad | Transacción única para pieza y multimedia; rollback completo si falla un archivo de referencia. |
| Configuración leída y sobrescrita desde el navegador | Integridad | Fusión de claves permitidas dentro de una transacción, verificación de versión y rol. |
| Orden de campañas sin controles de movimiento | UX/integridad | Flechas accesibles con persistencia atómica, verificación de lista vigente y orden numérico alternativo. |
| Enlaces externos de video sin validación del proveedor | Seguridad | HTTPS, dominio y ruta del proveedor exactos; archivos directos para video externo; no iframe arbitrario. |
| Cierre o retroceso que podía perder una edición | Funcional | Confirmación de descarte, navegación y cierre de sesión; guardia de historial probada con cancelación de Back. |
| Expediente extenso sin separación de tareas | UX | Solicitud inmutable, línea de tiempo, evidencia y nueva actuación en vistas diferenciadas. |

Se consultaron estas fuentes primarias antes de implementar:

- [Shopify · Forms](https://shopify.dev/docs/apps/design/user-experience/forms): secciones para formularios extensos, edición con espacio suficiente y guardado explícito. Se aplicó el principio a KILLAQ, sin copiar Polaris.
- [Linear · Custom views](https://linear.app/docs/custom-views): filtros y presentación centrados en el trabajo que se quiere resolver. KILLAQ conserva una navegación propia, sin añadir vistas guardadas ficticias.
- [Vercel · Observability](https://vercel.com/docs/observability): distinguir datos observados, fallos y disponibilidad de métricas. El panel declara las fuentes no configuradas.
- [Stripe · Team roles](https://docs.stripe.com/get-started/account/teams/roles): permisos explícitos para acciones privilegiadas. No se añadió Stripe como proveedor de pago.
- [PostgREST · Resource embedding](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html#null-filtering-on-embedded-resources): filtros de relaciones para contar y listar productos sin imágenes sin traer primero un catálogo truncado.
- Documentación instalada de Next.js 16.4: Route Handlers, Data Security y Single-page applications. Se respetó el DAL de servidor y la integración de historial nativo con el router.

## Pantallas y funcionamiento

**Dashboard.** Publicados, borradores, agotados y solicitudes pendientes; stock bajo (1–3 unidades), productos sin imagen y vencimientos disponibles. Accesos compactos a tareas. Incorporación inicial con pasos respaldados por consultas, sin presentar todos como completos. Actividad basada en `updated_at` de productos, descrita como última modificación y no como un registro completo de auditoría.

**Productos.** Búsqueda por nombre, estado, categoría, filtros de atención, orden por actualización/nombre/precio y páginas de 20 registros. Miniatura, colección, categoría, precio, stock, estado, fecha y acciones. Editor con información general, precios, material/tallas, inventario, imagen principal/video, clasificación y publicación. Las imágenes secundarias se conservan; no se ofrece un reordenamiento que no persista. Las piezas nuevas empiezan como borrador. Al publicar se valida la información y se comprueba que la fotografía cargue en el navegador; el servidor valida el formato de URL sin consultar destinos arbitrarios. La disponibilidad posterior de un alojamiento externo no está garantizada por esa comprobación.

**Colecciones.** Gestión real de nombre, slug, descripción, imagen opcional, orden y actividad. Crear una colección no publica una joya ni activa el apartado exclusivo. El borrado requiere confirmar la pérdida de la asociación, siguiendo las claves foráneas existentes.

**Campañas.** Tarjetas con imagen, título, descripción, orden y estado. Editor con fondo, tono y encuadre, botón interno de tienda y vista previa de escritorio/móvil. La rotación se mantiene en Experiencia de marca. Flechas disponibles cuando se consulta la lista completa sin filtros, hasta 20 campañas; para listas mayores se puede editar el orden numérico. No se cambia una campaña pública al entrar o previsualizar.

**Videos.** Estado inicial útil, tarjetas y editor. Instagram: publicaciones/reels/TV con dominio exacto; TikTok: rutas de video implementadas; externos: archivos HTTPS directos MP4/WebM/OGG/MOV/M4V. No se añadieron proveedores no implementados. La vista previa reutiliza VideoFrame con activación explícita del contenido externo. Los videos de producto también conservan la subida al bucket existente: MP4, WebM o MOV, hasta 100 MB, con permisos de Storage verificados por Supabase. Si falla el guardado posterior, se intenta retirar el archivo recién subido; un fallo de limpieza se informa.

**Marca y exclusiva.** Dos regiones en escritorio, ajustes agrupados, controles de duración, previsualización contextual y guardado explícito. Se conserva el respeto al movimiento reducido. La exclusiva exige producto publicado, imagen válida y colección activa en interfaz y RPC. La lista de selección carga hasta 2000 publicados y avisa si se alcanza el límite; el catálogo mantiene su paginación. Sin piezas elegibles se explican los pasos y se enlaza a Productos/Colecciones.

**Expedientes.** Tabla con correlativo, consumidor, recepción, tipo, estado y vencimiento, filtros existentes y páginas de hasta 200 hojas. El detalle conserva los datos originales, las actuaciones append-only, notas, respuestas, referencias de evidencia y exportación. La respuesta escrita y el cierre piden confirmación. Registrar una nota no se presenta como haber respondido. La aceptación del proveedor de correo continúa diferenciada de la entrega/lectura. El cálculo de 15 días hábiles, calendario, cola y avisos persistentes de la implementación legal anterior no se sustituyó por simples avisos visuales.

**Configuración privada.** Datos del negocio, información legal y estado operativo consultan la configuración real del servidor mediante autorización. Separan identificación de condiciones comerciales y documentos. Se muestra pendiente de completar/revisión, aprobación declarada incompleta o publicación habilitada según las condiciones existentes. No se implementó un editor jurídico; por tanto, no se guarda un borrador como una política publicada ni se inventó un historial de versiones. La revisión y habilitación de `KILLAQ_LEGAL_CONFIG` siguen siendo explícitas y externas al editor de contenido.

## Seguridad y backend

Las nuevas rutas verifican el token con Supabase Auth y el rol en `profiles` antes de leer o escribir. Usan la clave pública y el JWT del usuario en el servidor: las consultas siguen sujetas a RLS. No se entrega una clave de servicio al navegador. El backend específico del Libro conserva su clave reservada y controles existentes.

El cuerpo JSON tiene límite de 24 KB y control de origen. Hay listas permitidas de recursos, campos, formatos, proveedores y claves de configuración. Los productos requieren precio positivo con dos decimales, stock entero no negativo y precio anterior superior al actual. El RPC comprueba clasificación y publicación, además de RLS. Los conflictos de versión devuelven error de conflicto; no se sobrescribe silenciosamente una edición más reciente. Las respuestas administrativas usan `Cache-Control: no-store, private`.

Las exportaciones de expedientes contienen datos personales y deben conservarse en almacenamiento privado autorizado. No se añadieron logs de documentos, domicilios, respuestas o secretos. No se modificaron las políticas RLS existentes ni se asignó el rol admin a ninguna cuenta.

## Estado remoto y SQL para copiar

La revisión remota fue **solo lectura**, con clave pública. Se detectaron 0 productos públicos, 4 categorías, 13 subcategorías, 0 colecciones públicas, 5 materiales, 2 campañas y 2 claves de configuración. Un conteo público de perfiles/pedidos no prueba ausencia de registros privados.

Faltan las tablas de videos de producto, videos sociales y Libro en el schema cache; falta `hero_slides.jewelry_tone`; el indicador de 005 tampoco está preparado. No se verificaron escrituras ni sesión administrativa reales en producción. El estado efectivo de 002 (permisos) debe confirmarse con pruebas autorizadas; no se deduce de una tabla visible.

**Nuevo archivo: `src/sql/007_admin_operations.sql`. Copiar completo después de revisar/aplicar 001–006 en el orden indicado en `src/sql/README.md`. No fue ejecutado remotamente.** Agrega cuatro funciones: capacidades, guardado atómico de producto, fusión de configuración y orden de campañas. Es idempotente, no crea tablas duplicadas, no añade productos, no cambia stock durante su aplicación y conserva RLS mediante `SECURITY INVOKER` y comprobación de rol. Las funciones se reservan a usuarios autenticados y verifican administración internamente.

Hasta aplicar las dependencias, los guardados que requieren 007 informan el bloqueo. Esta limitación se muestra como tal; las pruebas locales no certifican que las migraciones estén aplicadas remotamente.

El Libro continúa pendiente de identidad empresarial definitiva, domicilio/correo confirmados, políticas revisadas, migraciones, secreto de backend, hash, correo y scheduler operativo. RUC recibido: **10714330573**, pendiente de comprobación SUNAT; no se completó el nombre personal en documentos públicos. Los archivos `private-legal/REVISION_PRIVADA.md` y `private-legal/BORRADORES.md` conservan la revisión pendiente y están excluidos de Git/Vercel.

La configuración privada no interpreta una clave de correo como prueba de entrega, ni un secreto cron como prueba de ejecución. Se necesitan envíos y ejecuciones realmente verificados. Los correos recomendados siguen siendo una propuesta para cuando se disponga de dominio y buzones, por ejemplo atención y privacidad bajo el dominio confirmado de KILLAQ; no están operativos por aparecer en un informe.

## Verificación y evidencias

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | Sin errores ni avisos ESLint en la revisión final. |
| `npx tsc --noEmit` | Correcto. |
| `npm run build` | Correcto, Next.js 16.4. |
| `npm test` | 11 pruebas de carrito/marca, 8 grupos SQL anteriores, 25 suites legales y 15 nuevas pruebas admin. |
| SQL 007 en PGlite | Aplicación dos veces, RLS/rol, rollback por fallo de imagen, clasificación, conflicto de edición, fusión de ajustes, exclusiva inválida y orden obsoleto. |
| Playwright principal | 118 vistas distintas: 11 rutas × 9 anchos, 2 editores × 9 anchos y drawer. Sin overflow ni hallazgos axe. |
| Flujos adicionales | Back cancelado, cierre/navegación con cambios pendientes, colección, imagen inaccesible y rechazo HTTP de datos/origen/escrituras no autorizadas. |
| Expedientes | 27 vistas: lista/original/actuación × 9 anchos, nota y respuesta escritas, evidencia y descarga, original conservado. Sin overflow ni hallazgos axe. |
| Catálogo vacío | 18 vistas: dashboard y productos × 9 anchos. Sin overflow ni hallazgos axe; incorporación con pasos pendientes y CTA útil. |
| Pruebas legales de navegador | Envío sin sesión, validación, fallo de base/correo, constancia, descarga/impresión, nota administrativa y navegación por teclado; correctas en fixture aislado. |
| Tienda pública | 9 comparaciones: inicio, catálogo y atención personalizada × 393/1440/1920 px. Dimensiones idénticas y **0 píxeles distintos**, sin máscaras. |

Anchos: **320, 360, 393, 430, 768, 820, 1024, 1440 y 1920 px**. Se verificaron también los estados de catálogo vacío e incorporación; sus resultados finales están en `artifacts/admin-2/final/results.json`.

Las pruebas usan datos ficticios locales. La simulación HTTP de Supabase sirve para la interfaz; SQL, RLS y autorizaciones se prueban aparte con PGlite y el backend real transpilado. PGlite usa una conexión: la prueba de edición concurrente verifica la versión obsoleta, no una carga distribuida real de PostgreSQL. No se enviaron reclamos de prueba a producción ni correos reales. Axe automatizado no equivale a una auditoría completa de accesibilidad.

Entre las correcciones comprobadas durante la verificación: la cancelación de Back requería una entrada del mismo recorrido para conservar el editor, la captura del expediente necesitaba esperar a que terminase su carga y los textos dorados del bloque de incorporación necesitaban un tono más oscuro sobre crema. Los controles deshabilitados ahora mantienen contraste legible en lugar de reducir la opacidad.

**Capturas comparativas** — datos locales ficticios:

| Pantalla | Antes | Después |
| --- | --- | --- |
| Dashboard, escritorio | [Ver anterior](artifacts/admin-2/before/admin-1440.png) | [Ver actual](artifacts/admin-2/final/admin-1440.png) |
| Productos, escritorio | [Ver anterior](artifacts/admin-2/before/productos-1440.png) | [Ver actual](artifacts/admin-2/final/admin-productos-1440.png) |
| Marca, escritorio | [Ver anterior](artifacts/admin-2/before/experiencia-1440.png) | [Ver actual](artifacts/admin-2/final/admin-experiencia-1440.png) |
| Incorporación móvil | — | [Ver captura](artifacts/admin-2/final/dashboard-empty-393.png) |
| Editor móvil | — | [Ver captura](artifacts/admin-2/final/product-editor-393.png) |

- Dashboard anterior: `artifacts/admin-2/before/admin-1440.png`; actual: `artifacts/admin-2/final/admin-1440.png`.
- Productos anterior: `artifacts/admin-2/before/productos-1440.png`; actual: `artifacts/admin-2/final/admin-productos-1440.png`.
- Marca anterior: `artifacts/admin-2/before/experiencia-1440.png`; actual: `artifacts/admin-2/final/admin-experiencia-1440.png`.
- Incorporación inicial: `artifacts/admin-2/final/dashboard-empty-1440.png` y `dashboard-empty-393.png`.
- Editor: `artifacts/admin-2/final/product-editor-1440.png` y `product-editor-393.png`.
- Expediente móvil: `artifacts/admin-2/flows/claims-original-393.png` y `claims-action-393.png`.
- La comparación de tienda pública está en `artifacts/admin-2/after/public-comparison.json`.

Las campañas con joyas de prueba se utilizaron para verificar las tarjetas y su orden. Son una demostración aislada del administrador, no nuevas campañas publicadas. Las capturas, resultados y expedientes ficticios están en `artifacts/`, excluido de Git/Vercel.

## Archivos principales

| Área | Implementación |
| --- | --- |
| Navegación | `src/app/admin/layout.tsx`, `admin.module.css` |
| Sistema reutilizable | `src/components/admin/AdminUI.tsx`, `AdminUI.module.css`: Field, Section, Notice, Empty, Loading, Status, ActionLink, Dialog y useDirtyGuard |
| Gestión visual | `ContentManager.tsx`, `BrandSettings.tsx`, `ConfigurationPanel.tsx` |
| Pantallas | `admin/page.tsx`, `productos/page.tsx`, carrusel/videos/colecciones/experiencia/exclusivos, `configuracion/[section]/page.tsx`, `reclamaciones/page.tsx` |
| DAL y validación | `src/lib/admin/client.ts`, `server.ts`, `validation.ts` |
| Backend | `api/admin/catalogo/[resource]`, dashboard, settings, configuracion, campanas/orden |
| SQL | `007_admin_operations.sql` y README de migraciones |
| Pruebas | `test-admin.mjs`, `test-admin-ui.mjs`, `test-admin-flows.mjs`, `admin-ui-fixture.mjs`, `admin-baseline.mjs`, `capture-admin-final.mjs` y adaptación de selectores de `test-legal-ui.mjs` |

Se retiraron las hojas de estilos administrativas antiguas que ya no tenían consumidores. Se preservaron los cambios legales anteriores del proyecto; la tienda pública no recibió cambios visuales durante Admin 2.0.

## Preparación para lanzamiento

1. Revisar y aplicar manualmente las migraciones específicas 001–007, sin volver a ejecutar el esquema completo. Confirmar especialmente 002 y probar rol cliente/admin con datos aislados.
2. Acceder al panel local con una cuenta realmente autorizada; no se crearon cuentas demo en Supabase. Confirmar un guardado de borrador y sus archivos en un entorno de staging antes de producción.
3. Completar y revisar la identidad y condiciones comerciales en la revisión privada. Resolver la identificación legal con asesoría peruana antes de publicar políticas definitivas.
4. Configurar buzones/dominio, correo, secretos del Libro y cron; validar entrega, reintentos, aviso preventivo y constancia sin solicitudes reales de prueba.
5. Formalizar el flujo comercial de WhatsApp y comprobantes antes de implementar pedidos, pagos o indicadores de ingresos. Para mayor volumen, añadir selección paginada/búsqueda específica de elegibles y un historial editorial de catálogo.

Proyecto local: `http://localhost:3000/admin`. El entorno de prueba usa 3001/3100, nunca la base de producción. La implementación técnica verificada no demuestra por sí sola habilitación operativa ni cumplimiento jurídico total.
