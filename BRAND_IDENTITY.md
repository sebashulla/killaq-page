# Killaq · Dirección visual

La identidad de Killaq se centra en blanco cálido, dorado y negro. El dorado firma la marca y las acciones; el blanco da espacio a las piezas; el negro destaca el brillo del oro. La frase central es «El brillo de lo que permanece».

## Sistema

- Blanco cálido: `#fdfcf9`. Negro: `#151515`. Dorado de marca y texto sobre blanco: `#94702d`. Dorado luminoso sobre negro: `#d7b96e`.
- Regla de campaña: joya dorada sobre negro; joya plateada sobre dorado. El panel permite usar fondo automático, negro, dorado o blanco. Los fondos se aplican detrás de imágenes transparentes; una fotografía con fondo propio conserva su fondo.
- Títulos y marca: Cormorant Garamond. Interfaz: Manrope. Next.js descarga y sirve las fuentes localmente.
- Firma: nombre KILLAQ con un pequeño destello; símbolo complementario de luna y luz. Es una propuesta gráfica, sin atribuir un significado lingüístico al nombre.
- Fotografía de campaña separada del catálogo: no se muestran imágenes generadas como productos comprables ni se inventan precios o existencias.
- Categorías sin fotografías: ilustraciones SVG de cada tipo de joya. Las imágenes cargadas en Supabase tienen prioridad.

## Movimiento

Motion para React: https://motion.dev/docs/react

Bienvenida de aproximadamente 3,6 segundos: marca dorada → anillo sobre negro → apertura de tienda blanca. Aparece una vez por pestaña/sesión, se puede omitir con el botón o Escape, y se puede repetir con «Ver bienvenida». Se desactiva con movimiento reducido.

La portada queda fija por defecto. Con varias campañas hay navegación manual, y el administrador puede activar rotación de 6 a 20 segundos. La rotación se detiene al recibir foco, durante hover y con la pestaña oculta. Las campañas del panel determinan la portada, sin anteponer una campaña fija de código. Si aún no se aplicó 004 o no hay campañas propias activas, se muestra la composición de marca como respaldo.

En atención personalizada, Motion anima un dibujo SVG propio del boceto, la forma del metal y el engaste, antes de revelar la imagen de campaña terminada. La secuencia dura unos 6,6 segundos más la transición final. Tiene pausa, selección de etapa y repetición. El administrador puede desactivarla, y con movimiento reducido se muestra la pieza terminada.

Administración: `/admin/carrusel` para campañas y fondos; `/admin/experiencia` para animaciones, rotación, texto y WhatsApp de atención personalizada. Requiere `src/sql/004_brand_and_storefront.sql`.

## Imagen generada

- Herramienta: imagegen integrada, con transparencia real.
- Archivo del proyecto: `public/images/killaq-ring-v2.png`.
- Uso: bienvenida y composición editorial; imagen ilustrativa de campaña.
- Se conservaron las dos imágenes originales del proyecto.

Prompt original utilizado para generar el PNG transparente (la composición web se cambió después a negro; el bitmap se conserva):

```text
Use case: product-mockup. Asset type: photorealistic jewelry campaign asset for Killaq, a Peruvian fine jewelry store, to be composited by code into a forest-green website hero and animated brand intro. Primary request: one exquisite polished yellow-gold solitaire ring with a round brilliant clear gemstone, floating at an elegant three-quarter angle. Scene/backdrop: completely transparent background with real alpha, no floor, no prop, no background shadow. Subject: physically plausible slim solid gold band, six delicate prongs, refined luxurious proportions, no inscriptions or brand marks. Composition: isolated ring centered, fills about 75% of a square frame, entire band and gemstone visible with generous clean transparent margins. Lighting: editorial studio macro photography, soft warm gold highlights and crisp gemstone facets, high realism, premium subdued luxury. Constraints: only ONE ring, no text, no watermark, no disembodied hands, no borders, no packaging. This is illustrative campaign imagery rather than an actual item for sale. Save the generated output as a local file and return its local path.
```
