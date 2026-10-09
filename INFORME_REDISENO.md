# Killaq · Informe de rediseño

8 de octubre de 2026 · Identidad dorada y atención personalizada

La tienda ahora presenta una identidad de blanco cálido, dorado y negro. Se conserva la composición editorial que te gustó, con más contraste para las joyas y una atención personalizada que tiene su propia página. El proyecto sigue disponible en http://localhost:3000 con actualización al guardar cambios.

## Cómo quedó

| Área | Resultado |
| --- | --- |
| Identidad | Marca dorada, textos en negro, superficies blancas y acentos de oro. Fondos oscuros reservados para composiciones de joyas y pie de página. |
| Portada | El anillo dorado queda sobre negro y permanece fijo por defecto. No alterna automáticamente con la segunda campaña de ejemplo. |
| Campañas | Fondo automático: oro sobre negro y plata sobre dorado. También se puede elegir negro, dorado o blanco y mostrar la pieza completa o una foto que cubra el área. |
| Bienvenida | Logo dorado, transición al anillo sobre negro y apertura a la tienda clara. Se puede omitir, repetir o desactivar desde administración. |
| Categorías | Ilustraciones de joyería con combinaciones de negro, blanco y dorado. Las fotografías cargadas en la base tienen prioridad. |
| Atención personalizada | Nueva página «Hecho para ti» accesible desde el menú, inicio y pie de página. Incluye explicación de la atención, preguntas frecuentes y preparación de una consulta. |
| Proceso artesanal | Secuencia ilustrada de boceto, forma del metal, engaste y acabado; termina con el anillo de campaña. Permite elegir etapas, pausar y repetir. |
| Consulta | El visitante elige pieza y material y escribe una idea opcional. El botón prepara esos datos en WhatsApp para revisarlos antes de enviar. No crea un pedido ni envía un mensaje automáticamente. |

La animación artesanal es una interpretación gráfica, no una filmación del taller ni una garantía de que todos los productos siguen el mismo proceso. El anillo generado sigue identificado como imagen de campaña. El catálogo utiliza productos y existencias reales de Supabase.

## Panel propio

Acceso con una cuenta cuyo perfil tiene el rol `admin`. La comprobación de acceso del panel se complementa con políticas SQL que restringen las escrituras.

- **Portada y campañas** (`/admin/carrusel`): mensajes, enlaces, URL de imagen, descripción accesible, color de la joya, fondo, encuadre, orden y estado. Incluye vista previa de fondo y encuadre. Los títulos admiten saltos de línea.
- **Experiencia de marca** (`/admin/experiencia`): bienvenida, animación artesanal, rotación automática e intervalo; título, descripción y WhatsApp de la página personalizada.
- **Productos y videos**: se conserva la administración existente, incluida la gestión de tallas y medios.

Para que el fondo negro o dorado se vea detrás de una joya, usar una imagen PNG transparente. Una foto que ya trae fondo conserva sus píxeles. Las imágenes de campaña se gestionan por URL; la carga directa de archivos de campaña puede añadirse como siguiente mejora.

Si no hay campañas activas propias, la tienda muestra la composición de Killaq como respaldo. La primera campaña activa por orden determina la entrada. Las campañas de administración ya no se colocan obligatoriamente después de una pieza fija en código.

## SQL que debes aplicar

Nuevo archivo: **`src/sql/004_brand_and_storefront.sql`**. Copiar completo al SQL Editor de Supabase después de los archivos anteriores. No ejecuté ninguna migración en tu base remota.

El 004 agrega opciones de material, fondo y encuadre a `hero_slides`, y una configuración pública de marca con escritura exclusiva de administradores. Convierte únicamente la primera campaña de ejemplo intacta y desactiva la segunda campaña de ejemplo intacta, conservándola para editar. No cambia campañas propias ni sobrescribe ajustes al volver a ejecutarse.

La última consulta de Supabase todavía detecta pendientes las tablas de videos (`001`) y reclamaciones (`003`), y las nuevas columnas de marca (`004`). Orden documentado: **001 → 002 → 003 → 004**. No volver a ejecutar el esquema inicial completo.

## Verificación y límites

- Compilación de producción y lint sin errores.
- Nueve pruebas de carrito y configuración de marca aprobadas.
- Las cuatro migraciones se ejecutaron dos veces en PostgreSQL local. Se probaron permisos de visitante, cliente y administrador, los fondos admitidos y la conservación de cambios del dueño al repetir 004.
- Revisión visual a 320, 390 y 1440 px, sin desbordamiento horizontal; navegación a la nueva página, selección de etapa artesanal y preparación del enlace de consulta. Se comprobó la repetición de bienvenida y el retorno del foco. Sin mensajes ni pagos reales.
- El acceso sin sesión a `/admin/experiencia` redirige al inicio de sesión.
- El catálogo público remoto sigue sin productos. Hay cuatro categorías y cinco materiales. Hace falta cargar las piezas comerciales, precios, tallas y fotografías antes de presentar la tienda como lista para vender.
- Las nuevas escrituras administrativas no se probaron en Supabase remoto: el 004 sigue pendiente y no se inició sesión con una cuenta administradora. La lógica del frontend compiló y los permisos se verificaron con la base local.
- El cobro y la entrega siguen coordinándose por WhatsApp; no hay pasarela de tarjetas, reserva automática de stock ni pedido automático desde este botón.
- Confirmar los canales comerciales definitivos: el nuevo panel permite editar el WhatsApp de atención personalizada, mientras los contactos generales y el carrito mantienen su configuración existente.

Capturas: `screenshots/killaq-preview-v3.jpg`, `screenshots/killaq-personalizada-v3.jpg` y `screenshots/killaq-personalizada-mobile-v3.jpg`.

## Qué agregaría después

1. **Catálogo y fotografías reales.** Piezas sobre negro si son doradas y sobre dorado si son plateadas, con fotos del detalle, escala y vista puesta. Es la prioridad para dar confianza y convertir visitas en consultas.
2. **Historia real del taller.** Un video breve del artesano, sus herramientas y el acabado. Puede complementar o sustituir la interpretación animada con evidencia propia de la marca.
3. **Guía de tallas y cuidados.** Medidas orientativas, ayuda para elegir y cuidados por material en cada ficha. Reduce dudas antes del pedido.
4. **Gestión de consultas y pedidos.** Bandeja administrativa con estado, responsable y seguimiento, en lugar de depender únicamente de las conversaciones de WhatsApp.
5. **Carga directa de campañas.** Subida de imágenes, recorte y vista previa móvil desde el panel, con almacenamiento y permisos de administrador.
6. **Favoritos y regalos.** Lista de deseos, opciones de presentación y dedicatoria según el servicio real que ofrezca Killaq.
7. **Pago integrado.** Elegir un proveedor y completar pagos, confirmación de pedidos, stock y envíos como un flujo consistente antes de habilitar cobro en línea.

La siguiente entrega más valiosa sería cargar un catálogo pequeño y completo con fotos reales y mostrarlo a los dueños junto con esta identidad dorada.
