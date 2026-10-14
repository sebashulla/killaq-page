# Migraciones de Killaq

Ejecutar cada archivo completo en el SQL Editor de Supabase, en este orden:

1. `001_restore_media.sql`: restaura videos sociales, videos de producto y el bucket de videos. Resuelve la tabla ausente detectada al reactivar el proyecto.
2. `002_harden_store_permissions.sql`: protege roles de perfil, moderación de reseñas, estado de pago inicial y estadísticas administrativas. Oculta por tabla las imágenes de productos inactivos.
3. `003_restore_complaints_book.sql`: restaura la tabla ausente del libro de reclamaciones. Permite enviar solicitudes nuevas y reserva la lectura y gestión a administradores.
4. `004_brand_and_storefront.sql`: permite administrar material, fondo y encuadre de la portada, animaciones y contenido de atención personalizada. Convierte únicamente las campañas de ejemplo intactas; conserva las campañas propias y la configuración guardada. Por defecto la portada queda fija sobre negro.
5. `005_categories_and_exclusive_showcase.sql`: agrega Charms y sus estilos, imágenes de referencia cuando no existe una imagen propia, la segunda campaña sobre negro y la configuración del apartado exclusivo, inicialmente oculto. Activa la rotación suave en su primera aplicación; las repeticiones conservan la elección del admin. Valida que una subcategoría pertenezca a la categoría de su producto. No crea productos de ejemplo.

Los cinco archivos usan transacciones y se pueden volver a ejecutar. **No se ejecutaron en tu proyecto remoto.** No contienen productos demo. El archivo 004 agrega un teléfono para la nueva consulta personalizada con el número que ya mostraba el frontend; puedes editarlo en «Experiencia de marca». No modifica las claves de contacto y checkout existentes.

Los archivos antiguos `killaq_schema.sql` y `killaq_architecture_additions.sql` se conservan como referencia. No vuelvas a ejecutar el esquema completo sobre la base existente. La migración complementaria antigua puede sobrescribir datos de contacto: usa las nuevas migraciones específicas para esta revisión.

La política SQL no oculta un archivo cuya URL ya se conoce en un bucket público. Usa un bucket privado para cualquier material confidencial.

6. `006_secure_complaints.sql`: después de 001–005, conserva la tabla del Libro, cierra los envíos directos públicos y habilita registro por backend, historial inmutable, cola de correo, calendario y avisos. Requiere configurar el servidor antes de habilitar el formulario. No se ejecutó remotamente. Aplicar después de revisar LEGAL_IMPLEMENTATION.md. Las hojas antiguas sin identidad o vencimiento requieren revisión manual; no se inventan datos históricos.

7. `007_admin_operations.sql`: después de 001–006, agrega RPC administrativos con RLS y verificación de rol para guardar producto + imagen + video de forma atómica, fusionar únicamente la sección de configuración editada y ordenar campañas sin sobrescribir una lista obsoleta. Es idempotente; no crea tablas ni inserta piezas, no asigna administradores y no cambia las políticas existentes. Incluye control de ediciones simultáneas de productos y configuración. **No se ejecutó en Supabase remoto.** Revisar `ADMIN_2_IMPLEMENTATION.md` antes de copiarlo completo al SQL Editor.
