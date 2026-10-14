# KILLAQ · Ficha de producto

Revisión: 14 de octubre de 2026.

Se reorganizó la ficha conservando tipografías, encabezado, footer y paleta de KILLAQ. La galería comparte fotografías y videos, con miniaturas pequeñas, navegación y contador cuando hay varios elementos. Una foto única se muestra sin duplicarla debajo. Las fotografías no se recortan para ampliar artificialmente la pieza.

En escritorio, el cursor amplía la imagen hasta 1,85× y mueve el punto de detalle. El clic abre un diálogo con la fotografía completa; incluye acercar/alejar, desplazamiento, navegación entre imágenes, Escape, foco inicial y retorno al control de origen. En móvil se abre al tocar; el área ampliada permite desplazarse con gestos y con teclado. Se respeta movimiento reducido. La imagen de alta resolución se monta al abrir la vista, con un indicador durante la carga.

La información ahora tiene una jerarquía de categoría/estado, nombre, precio real, tallas, disponibilidad, carrito y consulta. La explicación completa, material/peso/referencia y condiciones relacionadas se organizan en desplegables. El contacto toma el WhatsApp configurado en storefront y el enlace incluye la pieza y talla elegida; no se envía ningún mensaje automáticamente. Las interacciones de galería y consulta conservan el control de consentimiento analítico existente.

La muestra digital conserva aviso de IA y ausencia de pieza física/venta, sin mostrar el precio interno ni presentarse como una joya agotada. El texto original permanece íntegro en «Acerca de esta muestra». No se modificó su registro remoto. No se inventaron fotografías adicionales, certificaciones, garantías ni condiciones de envío. Las recomendaciones se muestran solo cuando hay otras piezas publicadas elegibles; las muestras digitales no se recomiendan como productos comerciales.

## Videos opcionales

Admin → Productos → editar/añadir → **04 · Fotografías y multimedia → Video de la pieza · opcional**. Puede usarse un archivo subido, enlace directo HTTPS, Instagram o TikTok, con título y portada opcional. El editor modifica el video principal y conserva los secundarios existentes. Los videos activos de la pieza se consultan en servidor y forman parte de su galería; un video inactivo no se publica. El producto sigue funcionando sin video o si la tabla opcional aún no está disponible.

El archivo seleccionado tiene vista previa local antes de guardar. Quitar el video limpia también el selector de archivos; cambiar de proveedor descarta el archivo local pendiente. Los objetos temporales del navegador se liberan. La vista previa de un enlace requiere que corresponda al proveedor elegido. El guardado mantiene validación de servidor, autorización y operación atómica existentes. No se ejecuta reproducción automática; al cambiar de foto se desmonta el reproductor. Los errores de reproducción conservan un enlace directo.

**SQL:** no hay migración nueva ni cambios remotos. Se reutilizan `product_images`, `product_videos`, el bucket `product-videos` y el RPC de la migración 007 ya existente. La subida necesita que el bucket/permisos de 001 estén habilitados; no se afirmó una nueva prueba de almacenamiento remoto.

## Verificación

- `npm test`: pruebas existentes de carrito, tienda, SQL/RLS, Libro, administración, analítica y recuperación/redes, aprobadas con transporte/base aislados.
- `npm run lint`, TypeScript y build de producción.
- `npm run test:product:ui`: cinco escenarios de ficha a 320/393/820/1440/1920 px y dos de administración a 393/1440 px. Fotografías fuera del antiguo límite de cuatro, hover y punto de zoom, foto ampliada realmente cargada, teclado/foco/Escape, ampliación, video WebM con avance de reproducción, cambio a foto, talla/carrito, enlace de consulta y muestra no comprable. Sin overflow; axe A/AA sin infracciones automáticas en las fichas y sus diálogos.
- El video sintético se generó en el navegador y se sirvió solo mediante interceptación de `media.example.test`. El catálogo, Auth y almacenamiento de estas pruebas usan un servidor loopback. No hubo ventas, videos de prueba, cambios de contraseña ni mensajes remotos.
- Revisión visual adicional de la muestra real en localhost en móvil, tablet y escritorio. Capturas y resultados permanecen en `artifacts/product-gallery/` y `artifacts/recovery-social/`, excluidos de Git/Vercel.

Para repetir las pruebas: iniciar `scripts/admin-ui-fixture.mjs` en 3100 y una copia local de la aplicación en 3001 con Supabase apuntando a ese fixture. El script se niega a usar un origen web externo. Puede indicarse `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para un navegador de pruebas instalado; no usa perfiles del usuario.
