# KILLAQ — implementación legal y atención al consumidor

Revisión: **9 de octubre de 2026**. Implementación local sobre Next.js, TypeScript y Supabase. Este informe distingue código probado, datos aportados por el propietario, obligaciones normativas y habilitación pendiente. No constituye dictamen jurídico ni certificación integral de cumplimiento.

## Resultado y situación real

Se implementaron las tres páginas legales propuestas, un layout editorial reutilizable, accesos contextuales y la mejora del **Libro existente**, conservando `complaints_book`. Se añadió `/admin/reclamaciones` con expedientes, filtros, respuestas, evidencias y exportación. La portada, pasarela, fotografías, campañas, tipografías y paleta no se rediseñaron.

**No se publicaron políticas definitivas ni se desplegó esta iteración. No se ejecutó SQL remoto.** En desarrollo, los documentos completos se muestran claramente como borradores. En producción, si falta aprobación/configuración, solo aparece información de preparación, sin las cláusulas incompletas. Las rutas sin aprobación llevan `noindex`. El formulario no recoge datos mientras no se habiliten identidad, información legal, backend y correo.

El sistema funciona en las pruebas con PostgreSQL local aislado y datos ficticios. **El Libro remoto todavía no es operativo:** la comprobación pública de solo lectura sigue sin encontrar `complaints_book`; no hay clave secreta de servidor ni servicio de correo configurados. No se enviaron reclamaciones de prueba, correos reales ni escrituras a Supabase de producción.

## Investigación oficial y decisiones jurídicas

Se investigó antes de redactar documentos y modificar la implementación legal. Se contrastaron textos normativos, anexos y orientación oficial, incluyendo la versión del Código publicada por INDECOPI en julio de 2026. Las referencias siguientes permiten revisar el fundamento; se debe volver a comprobar cambios posteriores antes de activar la operación.

| Norma / fuente oficial | Artículos o puntos relevantes | Aplicación en esta entrega |
|---|---|---|
| [Ley 29571, Código actualizado por INDECOPI](https://www.gob.pe/institucion/indecopi/normas-legales/3462038-ley-29571) — [PDF consolidado de julio de 2026](https://cdn.www.gob.pe/uploads/document/file/3620866/3462038-ley-29571.pdf?v=1784568399) | Arts. 2–4, 6–7; 18–21; 24; 45–51; 56.1.h; 58–60; 97; 150–152 | Información veraz, precio total, idoneidad, garantías, contratos equilibrados, atención y Libro. El art. 97 incluye remedios por incumplimiento y menor pureza del metal ofrecido. |
| [Ley 32495, El Peruano](https://busquedas.elperuano.pe/dispositivo/NL/2457203-1), publicada 11/11/2025 | Modifica arts. 150 y 151; disposición de adecuación reglamentaria | Incluye plataformas de comercio electrónico y exige acceso permanente, visible y fácil. La adecuación del reglamento no se utilizó como excusa para esperar ni deshabilitar esta obligación. |
| [DL 1729, El Peruano](https://busquedas.elperuano.pe/dispositivo/NL/2486266-3), publicado 12/02/2026 | Nuevos arts. 24.4 y 24.5; modifica 56.1.h | Canales digitales accesibles y operativos, sin cargas injustificadas; prohibición de manipulación de decisiones mediante interfaces. La regla especial de proveedor no domiciliado no sustituye el Libro de KILLAQ. |
| [DS 011-2011-PCM, Presidencia](https://www.gob.pe/institucion/presidencia/normas-legales/541080-011-2011-pcm) | Reglamento del Libro, leído con modificatorias | Se conservó su estructura reglamentaria; no se copió el plazo antiguo de 30 días. |
| [DS 006-2014-PCM, texto oficial](https://busquedas.elperuano.pe/api/visor_html/1041477-1) | Arts. 4-B, 5, 12 y 16 del reglamento modificado | Libro virtual, copia imprimible, constancia por correo, fecha/hora, datos mínimos, conservación mínima de dos años y supuesto SIREC de 3000 UIT. |
| [DS 058-2017-PCM, PDF oficial](https://portal.indeci.gob.pe/wp-content/uploads/2019/01/201711211118351.pdf) | Incorpora art. 6-A | Una propuesta o respuesta no equivale a aceptación de acuerdo por el consumidor. Deben conservarse actuaciones y evidencia. |
| [Ley 31435, publicación oficial del Congreso](https://www.leyes.congreso.gob.pe/Documentos/2021_2026/Boletin_de_Normas_Legales/2022/NL20220322.pdf) | Modifica arts. 24.1 y 152 | Respuesta general a reclamos y quejas: 15 días hábiles improrrogables. No se exige pago o cuenta para presentar. |
| [DS 101-2022-PCM, PCM](https://www.gob.pe/institucion/pcm/normas-legales/3346742-101-2022-pcm) — [texto oficial](https://consumidor.gob.pe/wp-content/uploads/2020/07/DS_Reg_LR_011_2022.pdf) | Arts. 3.4, 6, 6-A.2.b, 9 y Anexo I | Actualización del reglamento y avisos de la hoja. Se revisó el tratamiento específico de propuestas de acuerdo. |
| [Anexo I vigente, PCM](https://cdn.www.gob.pe/uploads/document/file/3510113/Anexo%20I%20DS%20N%20101-2022-PCM_.pdf.pdf?v=1660688658) | Cuatro secciones de Hoja; identificación de proveedor, correlativo, fecha, representante, bien, monto, hechos, pedido, acciones y comunicación de respuesta | Formulario, constancia y exportación adaptados. La firma manuscrita no se trasladó como barrera al formulario virtual. |
| [INDECOPI: Libro de Reclamaciones](https://consumidor.gob.pe/libro-de-reclamaciones/) — [preguntas oficiales, 12/11/2025](https://consumidor.gob.pe/wp-content/uploads/2020/07/Preguntas_Respuestas_LR_12.11.2025.pdf) | Orientación sobre acceso, respuesta, respaldo y conservación | El Libro no sustituye a INDECOPI ni obliga a agotar negociaciones. Contingencia real y supervisión operativa pendientes. |
| [Ley 29733, Congreso](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733) — [texto consolidado en entidad pública](https://www.muniate.gob.pe/wp-content/uploads/2026/04/LEY-N%C2%B0-29733.pdf) | Arts. 14.5 y 14.10, 15–18, 19–24, 28 y 34 | Tratamientos necesarios para contrato u obligación legal diferenciados del consentimiento opcional; información, seguridad, derechos y registro de bancos. |
| [DL 1353, publicación oficial del Congreso](https://www.leyes.congreso.gob.pe/Documentos/2016_2021/Boletin_de_Normas_Legales/NL20170107.pdf) | Modificaciones de protección de datos | Se contrastó el texto actualizado; no se trató la ley original como inalterada. |
| [DS 016-2024-JUS, texto oficial del Congreso](https://www3.congreso.gob.pe/Docs/DGP/DIDP/files/ds_016-2024-jus.pdf) | Arts. 6–7, 18–21, 34, 37, 42–46, 63–71 y disposiciones de vigencia | Reglamento vigente desde 31/03/2025, con reemplazo del anterior conforme a sus disposiciones. Información, flujos internacionales, bancos, seguridad, derechos e incidentes. Revisar ODP y régimen transitorio según el caso. |
| [Ley 32323, registro oficial](https://www.gob.pe/institucion/mtc/normas-legales/6752419-32323) — [orientación de INDECOPI](https://www.gob.pe/institucion/indecopi/noticias/1168482-indecopi-exhorta-a-las-empresas-a-cumplir-con-nueva-ley-que-prohibe-llamadas-spam-y-anuncia-drasticas-acciones-por-incumplimiento) | Comunicaciones comerciales y consentimiento | No se activa publicidad por pedir información, comprar o reclamar; no se añadió suscripción automática. |
| [SUNAT: ventas por internet](https://emprender.sunat.gob.pe/principales-impuestos/otros/obligaciones-si-vendo-o-presto-servicios-por-internet) — [RUC](https://centrovirtual.sunat.gob.pe/tramites/inscribete-ruc) | Identificación, comprobantes y obligaciones según régimen; RUC de 11 dígitos | No se inventó boleta/factura habilitada, tratamiento tributario o titular de cobros. El RUC recibido pasó validación de formato/verificador, no consulta registral SUNAT. |
| [Calendario oficial de feriados](https://www.gob.pe/feriados) | DL 713 art. 6 y modificatorias; feriados nacionales | Calendario versionado 2026/2027, fines de semana y Semana Santa. No confundir feriados con días no laborables compensables de aplicación distinta. |

**Vigencia frente a proyectos.** Se encontró la [RM 244-2026-PCM, texto oficial](https://busquedas.elperuano.pe/api/visor_html/2536260-1), de julio de 2026, que dispone publicar un **proyecto** de modificación del reglamento. No se aplicó ese proyecto como norma vigente. En la búsqueda oficial de esta revisión no se localizó un decreto posterior que lo apruebe ni una modificación posterior que cambie las obligaciones aquí descritas. Esto requiere una comprobación actualizada al publicar; no es una afirmación de exhaustividad absoluta.

**Devoluciones.** No se creó un derecho universal de arrepentimiento de 15 días. El art. 59 del Código regula restitución en supuestos específicos de prácticas agresivas o engañosas, con su propio plazo; no debe confundirse con cambios por preferencia. Los beneficios voluntarios, garantías comerciales y tiempos bancarios siguen pendientes de aprobación.

**Acuerdos de atención.** El art. 6-A.2.b, modificado en 2022, contempla un tratamiento específico del cómputo al comunicar una propuesta de acuerdo, con un máximo de cinco días hábiles. El sistema mantiene el vencimiento general original y **no aplica suspensiones automáticas**. Corresponde al abogado revisar un procedimiento trazable para ese supuesto; una nota o propuesta no acredita aceptación, no cierra el caso y no permite prórrogas silenciosas.

## Datos comerciales: confirmados y pendientes

- Confirmados **por el propietario**: marca KILLAQ, RUC corregido **10714330573**, operación como persona natural con negocio, ausencia de tienda física abierta y de dominio propio/correo empresarial confirmado.
- El nombre personal se reservó al archivo local privado solicitado. No se incluyó en código, SQL, informe público ni documentos publicados. El formato oficial exige identificar al proveedor: esta decisión sigue pendiente de solución jurídica antes de habilitar las políticas y el Libro.
- El dígito verificador del RUC es válido; no acredita por sí mismo titular, estado activo/habido, domicilio o régimen. Falta ficha SUNAT.
- El teléfono/WhatsApp y «Lima» son datos existentes en código, sin confirmación comercial en esta revisión. No se trataron como domicilio legal o correo de privacidad.
- Faltan domicilio para comunicaciones, contacto operativo, pagos, comprobantes, destinos/logística, condiciones de taller, cambios voluntarios, reembolsos, conservación por finalidad, proveedores/países/contratos y bancos de datos.

La lista completa y los datos personales se encuentran en **`private-legal/REVISION_PRIVADA.md`**, excluido de Git y Vercel. **`private-legal/BORRADORES.md`** contiene los tres textos propuestos completos para revisión. **`private-legal/configuracion-ejemplo.json`** conserva vacíos los datos no confirmados y las banderas de aprobación desactivadas.

Propuesta de correo después de adquirir y verificar un dominio: `atencion@killaq.pe`, `reclamaciones@killaq.pe` y `privacidad@killaq.pe`. Son propuestas, no buzones existentes; adaptar al dominio que realmente se compre. El correo antiguo del footer permanece identificado como pendiente de habilitación.

## Páginas y contenido propuesto

| Ruta | Contenido | Estado |
|---|---|---|
| `/terminos-y-condiciones` | 20 secciones: proveedor, alcance, uso, piezas, precios, stock, compra por WhatsApp, pago, comprobantes, entrega, personalización, garantías, cambios, promociones, datos, contenido, responsabilidad, atención, Libro y vigencia | Borrador local; publicación definitiva bloqueada |
| `/cambios-y-devoluciones` | Incumplimiento frente a preferencia; personalizados/aretes/promociones; solicitud/evaluación/logística; reembolsos y disconformidad | Borrador local; no plazos de cortesía inventados |
| `/politica-de-privacidad` | Responsable, datos, finalidades/fundamento, destinatarios, transferencias, conservación, seguridad, derechos, almacenamiento del navegador y actualizaciones | Borrador local; faltan datos reales del responsable y proveedores |
| `/libro-reclamaciones` | Identificación, definiciones/avisos, formulario y constancia | Implementado; registro real bloqueado hasta habilitación |
| `/admin/reclamaciones` | Lista, filtros, expedientes, actuaciones y evidencias | Implementado; necesita administrador real, SQL y credenciales de servidor |

`LegalLayout` conserva Navbar y Footer, composición editorial, introducción, fecha, índice con anclas, secciones y documentos relacionados. Blanco cálido, negro y dorado; tipografía y medidas cómodas en móvil/tablet. Los accesos contextuales usan enlaces, sin checkboxes comerciales innecesarios.

El Footer conserva sus enlaces anteriores, añade «Información legal» y un acceso directo al Libro visible aunque los grupos móviles estén cerrados. Carrito y producto enlazan términos/cambios/privacidad; atención personalizada, login, registro y perfil incluyen la información pertinente. No se modificó la portada.

## Auditoría de operaciones reales y transparencia

El carrito consulta precio/stock de productos publicados, guarda selección en el navegador y prepara una conversación por WhatsApp. **No hay pasarela automática, cobro, reserva ni aceptación automática del pedido.** El acuerdo comercial debe dejar evidencia de pieza, precio total, costos, pago y entrega. No se inventó un proveedor de pago ni un flujo transaccional distinto.

La consulta pública de Supabase realizada el 09/10/2026 devolvió cero productos e imágenes de producto visibles, cuatro categorías, trece subcategorías, cinco materiales, dos campañas y ninguna colección visible. No encontrar perfiles/pedidos con clave pública **no prueba** ausencia de registros privados. Faltan tablas de videos y del Libro en el schema cache; 004 y 005 aún no aparecen habilitadas.

Las campañas y categorías ya identifican sus imágenes como campaña/referencia. No se crearon fichas de venta de las joyas generadas. «Oro 18k» o «Plata 925» son opciones de catálogo, no prueba de composición de cada futura pieza. La publicación comercial exige respaldo del propietario.

Las piezas nuevas del panel se guardan ocultas por defecto. Antes de publicar se requiere descripción, material, fotografía y precio válido; se incorporó orientación breve para confirmar pureza, piedras, medidas, stock y condiciones reales. Este control de interfaz no certifica autenticidad ni reemplaza revisión documental o controles de base de datos; no se alteraron productos existentes ni se crearon productos ficticios remotos.

Los videos externos ahora muestran información y un control de activación antes de cargar al proveedor. También pueden cerrarse. No se carga Instagram/TikTok automáticamente ni se interpreta reproducir un video como consentimiento a publicidad. La política describe estas tecnologías de terceros y aclara que cerrar el contenido no elimina cookies que ellos ya hayan creado.

Se revisó `RESPONSIVE_AUDIT.md`; sus resultados anteriores se mantienen diferenciados de estas pruebas nuevas. No se reescribió el diseño de escritorio.

## Libro: seguridad, persistencia y constancia

- Registro mediante `POST /api/reclamaciones`, sin sesión, cuenta, compra o pago. Validación de tipos, tamaños y campos; cuerpo limitado a 24 KB, verificación de origen y campo trampa contra automatismos. Teléfono, pedido, importe y pedido concreto pueden omitirse; no son barreras adicionales al mínimo legal de admisión. El domicilio o correo permite responder por el canal elegido.
- Datos del consumidor/representante, producto/servicio, monto, reclamo/queja, hechos y pedido. Identidad y domicilio del proveedor, correlativo y recepción asignados en servidor, nunca por el cliente.
- Una transacción registra hoja, evento inicial y cola de constancias/aviso. El número se basa en secuencia de PostgreSQL y año de Lima; admite huecos por intentos fallidos, sin reutilizar ni truncar correlativos. Reintentos con UUID y mismo contenido recuperan la hoja; contenido diferente con el mismo UUID da conflicto.
- RLS/grants y políticas restrictivas: no hay lectura pública ni escritura directa desde el navegador; acceso de consulta administrativo y RPC reservadas al backend. Autorización API con `auth.getUser` y rol de perfil consultado en servidor. Clave secreta solo en servidor.
- Huellas HMAC de documento/origen, sin guardar IP cruda en la tabla de control. Límites persistentes de 30 nuevas hojas/origen/hora y 10/documento/hora. Datos de control caducan con limpieza de siete días; supervisar ajustes para no impedir atención legítima y disponer de asistencia real.
- Solicitud original y actuaciones inmutables; cambios de estado no sustituyen hechos/pedido. Las respuestas y referencias de evidencia se agregan al historial. Una carta requiere referencia y fecha real de comunicación, validada para no ser futura.
- Constancia confirmada solo tras persistencia: número, recepción y vencimiento; HTML descargable y vista imprimible/guardable como PDF desde el navegador. No se entrega un archivo HTML disfrazado de PDF.
- Cola de correo con reintentos, arrendamiento temporal, exclusión de trabajos en proceso y clave de idempotencia al proveedor. Constancia adjunta al consumidor cuando facilitó correo; aviso al equipo con información mínima. Con fallo de correo la hoja queda registrada y el estado de envío pendiente se muestra de forma expresa.
- «Aceptado por el servicio de correo» no significa entregado ni leído. Se guarda referencia del proveedor y eventos de fallo/aceptación; evidencia adicional se incorpora por el administrador. No se prometió entrega certificada ni exactamente un único correo ante todos los fallos externos.

El panel permite filtrar estado/tipo/fechas, paginar listas de 200, abrir detalle, revisar, anotar, encolar respuesta, documentar carta/recepción, cerrar tras respuesta y exportar HTML con historial o JSON privado. La hoja exportada incluye respuesta y fecha de comunicación/aceptación disponible, aclarando la diferencia de evidencia. Los archivos físicos de evidencia deben custodiarse en un repositorio privado del negocio; no se añadió subida a buckets públicos.

## Plazos, conservación y alertas

El vencimiento general se calcula en servidor y se conserva con versión de calendario. Se cuentan 15 días de lunes a viernes desde el día siguiente de recepción en Lima, excluyendo feriados nacionales. Incluye Semana Santa y cambio de año. Los días no laborables compensables del sector público no se excluyen automáticamente. Revisar el criterio con abogado y actualizar nuevos feriados/reglas territoriales antes de producción.

Calendario preparado: **2026 y 2027**. Fechas fuera de cobertura bloquean el registro en vez de inventar vencimientos. No se programan ampliaciones por revisión o propuesta de acuerdo. Hojas antiguas sin identidad/vencimiento se conservan y se marcan para revisión manual urgente, sin inventar historia.

Conservación mínima registrada: dos años desde presentación. Las hojas, eventos, respuestas y evidencias deben respaldarse. No hay borrado de expedientes desde el panel. La política de retención/supresión posterior, obligaciones de comprobantes, investigaciones y prueba de restauración de backups sigue pendiente de aprobación/operación; **no se afirma que backups remotos estén configurados**.

`vercel.json` prepara un cron diario a las **08:00 de Lima**. Con `CRON_SECRET`, procesa la cola y avisos desde siete días calendario antes del vencimiento, también para casos vencidos/sin plazo antiguo. Lotes de cinco correos en paralelo, arrendamiento de diez minutos y reintento progresivo. También procesa tras registro/respuesta y por acción autorizada del admin.

**El cron no está desplegado ni probado en Vercel.** Deben confirmarse compatibilidad del plan, ejecuciones, monitor externo de errores, volumen de cola, entrega de avisos y responsables/sustitutos. Aumentar frecuencia/capacidad si el volumen lo exige. Las alertas preparadas por correo evitan depender solo de la pantalla, pero no garantizan que una persona atienda a tiempo.

## SQL pendiente y configuración

**Nuevo archivo manual: `src/sql/006_secure_complaints.sql`.** Se notificó durante el trabajo y se probó dos veces en una base aislada. Conserva la tabla y hojas antiguas; agrega columnas, eventos, cola, controles, calendario, funciones y permisos. No se ejecutó ni alteró directamente la base remota.

Verificar primero el estado real y respaldar. Si siguen pendientes, copiar 001 → 002 → 003 → 004 → 005 → **006** completos en Supabase. No volver a aplicar el esquema base. No reejecutar 003 después de 006: restablece grants/políticas antiguas; 006 incorpora políticas restrictivas para evitar reabrir envíos y debe reaplicarse para restaurar los grants previstos si sucede.

Variables privadas documentadas en `.env.example`:

| Variable | Uso / estado actual |
|---|---|
| `SUPABASE_SECRET_KEY` | Clave secreta del proyecto solo en servidor; pendiente. Se admite `SUPABASE_SERVICE_ROLE_KEY` legado como alternativa. Nunca `NEXT_PUBLIC_*`. |
| `COMPLAINTS_HASH_SECRET` | Secreto aleatorio de al menos 32 caracteres para huellas; pendiente. |
| `COMPLAINTS_TEAM_EMAIL` | Destinatario autorizado real de avisos; pendiente. |
| `COMPLAINTS_FROM_EMAIL` + `RESEND_API_KEY` | Adaptador Resend preparado; falta contratar/configurar, verificar dominio remitente y probar. No se afirma correo operativo. |
| `CRON_SECRET` | Secreto aleatorio de al menos 32 caracteres para scheduler; pendiente. |
| `KILLAQ_LEGAL_CONFIG` | JSON privado con identidad y condiciones aprobadas; por defecto incompleto y bloqueado. |

La comprobación de configuración no acredita por sí sola dominio verificado, migración aplicada o entrega. Las fallas reales se devuelven y se registran sin fingir éxito. Identificar Resend en privacidad/contratos/transferencias solo si finalmente se contrata; el adaptador puede sustituirse por el servicio aprobado.

Referencias técnicas primarias: [claves Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [verificación getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [API de correo Resend](https://resend.com/docs/api-reference/emails/send-email), [gestión de cron Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Pruebas y resultados

- `npm run lint`: pasa.
- TypeScript (`npx tsc --noEmit` y comprobación del build): pasa.
- `npm run build`: pasa; las cuatro rutas y las API/admin están incluidas.
- `npm test`: 11 pruebas de carrito/storefront, ocho comprobaciones previas de SQL y **25 suites nuevas de legal/backend/SQL**. Las migraciones 003/006 también se aplicaron dos veces; se conserva una hoja antigua ficticia.
- `node scripts/test-legal-ui.mjs`: 20 vistas, cuatro rutas × 320/390/768/1024/1440 px, sin desbordamiento ni infracciones detectadas con axe en los criterios WCAG A/AA analizados; registro invitado, validación, error de base, fallo de correo, constancia, descarga, impresión y gestión administrativa en fixtures aislados.
- La comprobación Supabase fue solo lectura; no se crearon casos ni se enviaron correos de prueba en producción.
- `node scripts/test-legal-release.mjs`: pasa contra Next en modo producción **local**. Comprueba que documentos sin aprobación no expongan borradores, que no haya constancia falsa al faltar configuración y que las API reales de admin/cron rechacen acceso no autorizado.

| Requisito solicitado | Evidencia local |
|---|---|
| Registro válido y acceso sin sesión | Registro real en PGlite a través del mismo DAL; queja desde navegador sin cuenta |
| Campos obligatorios ausentes | Validación servidor y validación nativa del formulario |
| Reclamo y queja | Casos de ambos tipos y selección de queja en navegador |
| Envíos simultáneos | 12 solicitudes HTTP concurrentes con correlativos distintos; SQL con secuencia y bloqueo de idempotencia |
| Error de base | No éxito, no hoja inventada, recuento sin cambios y mensaje de reintento |
| Error de correo | Falta de configuración bloquea habilitación; fallo del adaptador conserva hoja y encola reintento |
| Constancia, descarga e impresión | Contenido escapado, monto cero conservado, archivo HTML descargado y llamada de impresión comprobada |
| Privacidad y permisos | Anon sin lectura/RPC, cliente sin casos ajenos/escritura, token inválido y no admin rechazados |
| Gestión administrativa | Lista/filtros, detalle, revisión, nota, respuesta, evidencia, cierre y exportación preparados |
| Original al responder | Trigger contra modificación y borrado; texto original/solicitud/respuesta antigua conservados |
| Footer y teclado | Libro visible con grupos cerrados y enfocable; índices y enlaces verificados |
| Vencimientos/feriados | Acuerdo TS–SQL e importes de fecha esperados independientes: recepción 07/10/2026 → 29/10/2026; 23/12/2026 → 15/01/2027; 25/03/2026 → 17/04/2026 |
| Abuso, avisos y trabajadores | Límites de origen/documento, avisos diarios deduplicados, arrendamientos distintos y aceptación obsoleta rechazada |
| Migración antigua por error | Políticas restrictivas impiden que 003 reabra inserciones o actualizaciones desde navegador |

Las capturas y resultados ficticios están en `artifacts/legal-ui/` (local, excluido del repositorio). El preview de pruebas es una copia ignorada, con una ruta ficticia que **no pertenece al sitio ni al build principal**. Las intercepciones de navegador conectan al DAL y base local; no son evidencia de llamadas a producción. PGlite usa una conexión local y serializa ejecuciones internas: falta validar concurrencia en un staging PostgreSQL multiusuario una vez configurado.

Limitaciones: no se probaron celulares físicos, Safari/Firefox, lectores de pantalla, entrega real del proveedor de correo, usuarios administrativos remotos, backups restaurados ni scheduler publicado. La revisión automática de accesibilidad no es una certificación completa. Una validación técnica no acredita cumplimiento jurídico integral.

## Revisión necesaria antes de activar

El responsable y un abogado peruano deben aprobar identidad/domicilio, datos SUNAT, documentos finales, garantías y composición respaldada, tratamiento de personalizados, beneficios voluntarios/logística, comprobantes/pagos y reembolsos. Revisar art. 6-A, calendario, contingencia del Libro, SIREC si corresponde, bancos de datos, transferencias, conservación, derechos, incidentes y ODP según el caso.

Después: migraciones manuales, credenciales privadas, correo real probado, backups y monitoreo, staging y comprobación con cuenta autorizada. Solo entonces activar las banderas de aprobación y publicar documentos definitivos. La implementación actual entrega una base técnica probada y borradores concretos sin inventar lo que falta.
