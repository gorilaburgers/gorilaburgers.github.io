# CONTEXTO-CLAUDE.md · Gorila Burgers

Mapa del proyecto, decisiones y estado. Lo lee Claude Code al empezar (junto con `CLAUDE.md`, que son las reglas de la agencia).

## Qué es
Sitio real de **Gorila Burgers (Ambato)** · plan **Premium** · publicado con GitHub Pages en `https://gorilaburgers.github.io/` (deploy = push a `main`). Base de datos: Supabase, schema `gorila_burgers`.

## Mapa
| Ruta | Qué es |
|---|---|
| `index.html` | Una sola página: vitrina de burgers arriba (la burger enorme, qué lleva, cuántas quedan hoy, categorías), «¿Qué Gorila eres hoy?», carta, pedido para llevar o a domicilio (se guarda en la base y termina en WhatsApp), dónde estamos y contador LED opcional |
| `personal.html` | Pantalla de ventas del equipo (`noindex`): vender, confirmar pedidos de la web, anular errores |
| `dashboard.html` | Dashboard del dueño en vivo (`noindex`): hamburguesas vendidas, stock del día, por hora y canal |
| `config.js` · `menu.js` | Datos del cliente (WhatsApp, horario) y carta. **Los números viven solo aquí** |
| `modulos/restaurante/` | Código de las pantallas y `restaurante-datos.js` (URL y clave **anon** de Supabase) |
| `supabase/migrations/` | `001`–`005` módulo de restaurante, `006` carta y sectores de Gorila. Se corren en orden |
| `assets/` | Imágenes optimizadas (nada > 200 KB) |
| `brief/brief.md` | Brief del cliente |

## De dónde sale el código
Las páginas **se generan** desde el repo de la agencia (`landing-base`: `clientes/gorila-burgers/cliente.json` + `python3 scripts/nuevo-cliente.py gorila-burgers --produccion`). Para cambios de texto, carta o precios: editar allá, regenerar y copiar aquí. Editar a mano solo para arreglos urgentes, y avisar para no perderlos al regenerar.

## Decisiones
- **Premium** $300 + $25/mes (precios vigentes desde el 4 oct 2026). Integración elegida: **Google Maps**; el segundo cupo se cambia por **un módulo adicional por definir**.
- Domicilio en **todo Ambato**; el costo de envío por sector lo confirma el cliente.
- Dashboard con **dos entradas**: el dueño pone el stock del día y el equipo registra lo vendido. El stock baja con cada venta; sin stock cargado se vende sin tope.
- Un pedido de la web nace **pendiente** y el local lo confirma (no descuenta stock hasta entonces).
- El contador público «hamburguesas vendidas en <año>» **viene apagado**; lo activa el dueño.
- Sin pasarela de pago: cobro por WhatsApp y transferencia.

## Estado (12 oct 2026)
Hecho: SQL probado (150 comprobaciones del módulo base), páginas, vitrina con estilo rockero, mini juego «Gorila arriba» (sin premio, solo pasar el rato), pantalla de ventas, dashboard, modo de producción, Lighthouse móvil en la landing: rendimiento 92–97, accesibilidad 100, SEO 100.
Supabase: proyecto **compartido** con Core Studio, Beer Club y Camelia (plan gratis). Migraciones 001–006 corridas, schema `gorila_burgers` expuesto, dueño creado, permisos comprobados (anon solo llama `carta`, `contador`, `pedido_crear`, `ping`; sin lectura directa de tablas; RLS en todas).
**Excepción a CLAUDE.md §4.10:** los registros públicos de Authentication siguen **encendidos** porque Core Studio los usa (las socias se registran solas). Gorila se protege por dentro: todo lo del personal y del dueño exige estar en `gorila_burgers.staff`. Si algún día Core Studio deja de usar el registro propio, apagarlo.
**Pendiente:**
- [ ] Prueba de humo contra la base real: `python3 scripts/probar-supabase.py gorila-burgers` (en landing-base) o a mano en el sitio publicado; incluir una cuenta registrada que no es del equipo (debe recibir «sin permiso»).
- [ ] **Cambiar la clave del dueño por una segura** (hoy es de prueba).
- [ ] Confirmar con el cliente y reemplazar los textos neutros: **horas por día** (hoy «horas por WhatsApp»), **costo de envío por sector** (hoy «se confirma por WhatsApp»), ingredientes de SuperGuesa y Hawayana (hoy «Receta de la casa»), salsa e inclusiones de la Jam Smash, y el precio de la Pig Floyd de temporada.
- [ ] Fotos del **food truck** y de eventos para la sección «Gorila también va a tu evento» (hoy solo lleva texto y el botón «Cotizar mi evento» a WhatsApp). Confirmar con el cliente qué tipos de evento atiende y si hay precios base.
- [ ] Fotos originales de estudio y logo como archivo. Decidir la foto «This is Gorila» (mural de marca ajena).
- [ ] Analítica activa y clics a WhatsApp como conversión (elegir herramienta).
- [ ] Definir con el cliente si el mini juego cuenta como el módulo adicional del Premium o se cotiza aparte; número real de WhatsApp en `config.js` (hoy 593987188071; verificar).
- [ ] Pausa del plan gratis de Supabase tras 7 días sin actividad: vigilar cuando el tráfico sea bajo.
