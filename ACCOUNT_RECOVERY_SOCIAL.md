# KILLAQ · Recuperación, redes y muestra digital

Revisión del 13 de octubre de 2026. Se conserva la tienda existente y se integra con Admin 2.0. La publicación incluye también los módulos legales y de estadísticas preparados anteriormente, conservando sus controles: políticas definitivas y seguimiento requieren configuración y aprobación.

## Recuperación y comprobación real

`/login` incorpora «¿Olvidaste tu contraseña?». `/recuperar-contrasena` usa `supabase.auth.resetPasswordForEmail`, con respuesta que no revela si una cuenta existe, intervalo de reenvío y errores reales. `/actualizar-contrasena` verifica mediante Supabase una sesión propia válida, pide contraseña y confirmación, valida longitud/coincidencia, actualiza mediante `updateUser` y solicita cierre global de sesiones. No cambia roles ni restablece contraseñas ajenas. Las rutas de autenticación no se indexan ni envían Referer y están fuera de analítica. Un evento de recuperación recibido en la portada conduce al formulario correcto después de verificar la sesión.

Se solicitó el correo para la cuenta indicada por el titular. Supabase aceptó la solicitud; el titular confirmó el cambio. Después se comprobó el acceso con la nueva contraseña, por Auth y desde la interfaz de login. Supabase confirmó rol `admin`. La contraseña no se guardó en código, informes o archivos. Fuentes: [recuperación oficial](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [contraseñas y prevención de enumeración](https://supabase.com/docs/guides/auth/passwords), [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).

### Correo gratuito

El [SMTP incluido de Supabase](https://supabase.com/docs/guides/auth/auth-smtp) es de prueba: miembros autorizados de la organización, dos mensajes/hora documentados y sin garantía de entrega. La prueba de una cuenta no verifica entrega a todos los clientes. No se pudieron inspeccionar los ajustes privados de SMTP usando la clave pública.

- **Gmail SMTP, inicio sin dominio propio:** cuenta de negocio bajo control de KILLAQ, verificación en dos pasos y [contraseña de aplicación](https://support.google.com/accounts/answer/185833), si está disponible. Configurar en Supabase `smtp.gmail.com`, `465`/SSL o `587`/TLS según el ajuste admitido, usuario y remitente de esa cuenta. El secreto se introduce únicamente en Supabase. Revisar [límites y bloqueos de Google](https://support.google.com/mail/answer/22839). No se garantiza una cuota efectiva de entrega ni se debe usar la contraseña de KILLAQ para Gmail.
- **Resend Free, cuando exista dominio:** [precios consultados](https://resend.com/pricing): 3000 correos/mes, hasta 100/día. [Supabase SMTP con Resend](https://resend.com/docs/send-with-supabase-smtp) requiere API key y dominio verificado; el dominio tiene costo independiente. No se contrató ni configuró un proveedor.

Revisar Supabase → Authentication → URL Configuration, conservando accesos anteriores necesarios:

```text
Site URL: https://killaq-page.vercel.app
Redirect URLs:
https://killaq-page.vercel.app/actualizar-contrasena
http://localhost:3000/actualizar-contrasena
```

No autorizar un comodín global. Conservar el enlace oficial de confirmación en la plantilla de correo; un enlace fijo al formulario no sustituye verificar el token. Comprobar SMTP con una cuenta externa al equipo y revisar límites/antiabuso antes de abrirlo a todos los consumidores. La clave pública de la app no permite modificar estos ajustes del proyecto.

## Tres publicaciones por red

Inicio incorpora «Detalles que merecen compartirse», con tres piezas por red y accesos a los perfiles reales. Los seis enlaces del titular se guardaron con su cuenta mediante la API administrativa autenticada, eliminando parámetros de seguimiento:

| Canal | Selección |
| --- | --- |
| TikTok | [01](https://www.tiktok.com/@killaq_joyas/video/7687753618568629522), [02](https://www.tiktok.com/@killaq_joyas/video/7676353850478988562), [03](https://www.tiktok.com/@killaq_joyas/video/7675058385762536712) |
| Instagram | [01](https://www.instagram.com/p/DXN94fWjQKx/), [02](https://www.instagram.com/p/DXN8l_IDBq9/), [03](https://www.instagram.com/reel/DR8PrY6je-7/) |

Admin → **Redes y videos** conserva la gestión existente. Tres activos por canal según su orden (0, 1, 2); los restantes se conservan. Reemplazar/reordenar al publicar novedades. Los títulos iniciales identifican canal y posición; se pueden cambiar por títulos reales. La selección manual no se presenta como actualización automática.

La portada carga automáticamente los embeds de Instagram y TikTok mediante iframes con carga diferida y `no-referrer`, sin botón de activación ni reproducción automática. El resto de usos de `VideoFrame` conserva la activación manual por defecto. El aviso junto a las publicaciones explica el procesamiento externo y enlaza privacidad; no se presenta como consentimiento del visitante ni como garantía de ausencia de cookies. La política interna se actualizó para su revisión.

Se sustituyó `/embed/v2/` por el [reproductor oficial de TikTok](https://developers.tiktok.com/docs/en/embed-player), `/player/v1/`, con `autoplay=0`. Los tres enlaces proporcionados mostraron contenido y emitieron eventos de reproducción con avance real del tiempo en navegador. Los errores oficiales del reproductor muestran un enlace directo; los mensajes se aceptan únicamente desde el origen de TikTok y el iframe propio. Si no llega `onPlayerReady` en 25 segundos desde que la pieza se acerca a pantalla, se muestra la alternativa. Un fallo interno de Instagram no siempre puede detectarse por la restricción entre orígenes: su enlace directo permanece visible. Los perfiles oficiales aparecen también debajo del teléfono del footer.

`/api/redes` prepara conexión automática opcional en servidor, enlaces/cuenta validados, deduplicación, máximo de tres, caché breve y respaldo manual. Tokens privados en `.env.example`: `TIKTOK_DISPLAY_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `INSTAGRAM_API_VERSION`. Sin ellos usa `social_videos` activo, bajo RLS; no crea tablas.

TikTok exige autorización del titular/productos/permisos de [Display API](https://developers.tiktok.com/docs/en/display-api-get-started); [List Videos](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list) ordena por creación descendente. Instagram necesita cuenta profesional/app/token correspondientes: [Instagram Login de Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [colección oficial de Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api). Las páginas de Meta devolvieron 429; se consultó su colección. El adaptador de Instagram ordena las fechas de la página devuelta y se rotula «reciente», sin afirmar que enumeró toda la cuenta. No se conectaron API reales ni se automatizó renovación de tokens; los adaptadores se probaron con respuestas aisladas.

## Muestra solicitada

**Anillo Aurora · muestra digital** se creó desde el formulario de Productos de la cuenta admin y el RPC existente de guardado atómico. Pieza e imagen persistidas; stock cero. Imagen IA `/images/demo/anillo-aurora-digital.webp`: 1200 px, aproximadamente 58 KB, color dorado sobre negro. Se añadió con permisos normales una clasificación **Muestra digital · sin material físico**, evitando atribuir oro/plata/piedras no confirmados.

SKU reservado `KILLAQ-DEMO-AURORA`: etiqueta digital, sin precio de venta ni compra. El valor interno `1`, requerido por la columna, no se muestra como oferta. La validación exige stock cero y ausencia de promoción para `KILLAQ-DEMO-*`. No participa en pieza exclusiva ni se indexa como ficha comercial. Su descripción aclara que no existe joya física, autenticidad, pureza, garantía o disponibilidad confirmadas. No se creó venta/pedido/cobro. Convertirla en pieza comercial requiere SKU normal e información y fotos reales.

Se oculta mientras se despliega la imagen y se habilita después de comprobar la versión publicada. Esta muestra es la excepción expresamente solicitada por el titular a la regla anterior de no publicar productos ficticios. El resto de las pruebas usa datos aislados.

Mejoras para piezas reales: fotos propias de varios ángulos y sobre mano para escala, medidas/peso/tallas y composición confirmadas, detalle en video, disponibilidad y precio reales. Para la muestra puede explorarse un segundo encuadre; no debe anunciarse como autenticidad o certificación.

## Pruebas y entrega

Lint, TypeScript, build y suite existente de carrito, SQL/RLS, Libro, Admin 2.0 y analítica. Ocho grupos verifican destino, contraseñas, URL/cuenta, limpieza de parámetros, deduplicación, adaptadores/token privado/caché, reproductores oficiales y respaldo ante fallo. Veinticuatro estados de navegador cubren recuperación/actualización/errores, responsive, carga automática de seis publicaciones, mensajes de error auténticos/simulados, rechazo de mensajes falsificados y fallback por timeout con reloj virtual. Auth y redes se interceptan con datos ficticios, sin mensajes o cambios de contraseña de prueba remotos. En una comprobación separada con contenido real, los tres TikTok reprodujeron y las tres publicaciones de Instagram cargaron automáticamente.

Se entregó por separado un PDF privado de ocho páginas para propietarios: campos faltantes, respaldo, responsables, estado de habilitación y fuentes oficiales. Está fuera del repositorio y del despliegue. Las vistas públicas de las cuatro rutas legales respondieron 200; las políticas conservan su aviso de preparación y el Libro su bloqueo de registro. Solo se consultaron nombres de variables de producción; no se modificó esa configuración ni se ejecutó SQL remoto.

Anchos: 320/393/768/820/1440 px. La muestra se revisó en 393/820/1440, sin overflow y con compra deshabilitada. Capturas excluidas de Git/Vercel: [móvil](artifacts/recovery-social/demo-product-393.png), [escritorio](artifacts/recovery-social/demo-product-1440.png), [recuperación](artifacts/recovery-social/recovery-393.png), [redes](artifacts/recovery-social/social-wall-1440.png). Resultados: `artifacts/account-tests/results.json` y `artifacts/recovery-social/ui-results.json`. Las capturas de Auth contienen datos ficticios; las de la muestra/redes muestran contenido autorizado.

**SQL:** ninguna migración nueva ni DDL remoto. El RPC existente `admin_save_product` funcionó con la publicación autorizada; eso no certifica la habilitación de todos los módulos legales/correo/cron. Sus pendientes siguen documentados; PostHog permanece apagado.

GitHub/Vercel están autorizados por el titular. El resultado del despliegue y verificación de las URL se comunican al cerrar la tarea. La configuración privada de URL/SMTP de Supabase necesita confirmación del responsable.
