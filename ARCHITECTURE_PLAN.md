# Arquitectura Killaq Joyería Fina

## Objetivo

La aplicación queda organizada como una tienda virtual administrable:

- Tienda pública: home, catálogo filtrable, detalle de producto, carrito y página institucional.
- Panel admin: acceso validado por Supabase Auth + `profiles.role = 'admin'`.
- Base de datos: esquema principal existente más una migración complementaria idempotente.

## Capas principales

- `src/app`: rutas de Next App Router.
- `src/components`: piezas visuales reutilizables de tienda.
- `src/context/CartContext.tsx`: carrito local persistido en `localStorage`.
- `src/data/catalog.ts`: datos fallback y normalizadores de filas Supabase.
- `src/types/catalog.ts`: contrato compartido de productos, categorías, materiales y carrito.
- `src/utils`: cliente Supabase y utilidades de formato.
- `src/sql/killaq_architecture_additions.sql`: mejoras SQL para ejecutar después del esquema base.

## Flujo de datos

1. Las páginas públicas consultan Supabase con la anon key.
2. Si Supabase no responde o no hay datos, se muestra un catálogo demo consistente.
3. El admin crea, edita y elimina productos usando las políticas RLS existentes.
4. Las imágenes principales se guardan en `product_images` con `sort_order = 0`.
5. El carrito funciona localmente y puede coordinar el pedido por WhatsApp.

## Seguridad

- El panel admin valida sesión y rol antes de renderizar.
- La protección fuerte depende de RLS en Supabase, no solo del frontend.
- El archivo SQL complementario agrega auditoría, movimientos de inventario, leads y settings con políticas admin.

## Siguientes mejoras recomendadas

- Conectar subida directa a Cloudinary o Supabase Storage desde el admin.
- Implementar checkout real con Culqi, Mercado Pago o pedidos registrados en `orders`.
- Agregar edición de categorías/materiales desde admin.
- Registrar auditoría desde el frontend al guardar productos o slides.
- Crear pruebas e2e para login admin, CRUD producto y carrito.
