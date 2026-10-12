# Gorila Burgers · sitio web

Sitio de **Gorila Burgers (Ambato)**, plan Premium. HTML/CSS/JS sin build; se publica con GitHub Pages: **push a `main` = publicado** en `https://gorilaburgers.github.io/`.

## Qué incluye
Página con vitrina de burgers, carta y pedido (llevar o domicilio en todo Ambato) · pantalla de ventas del equipo · dashboard del dueño en vivo · base de datos en Supabase.

| Ruta | Qué es |
|---|---|
| `index.html` | Una sola página: vitrina de burgers arriba, «¿Qué Gorila eres hoy?», carta y pedido (se guarda en la base y termina en WhatsApp) |
| `personal.html` | Pantalla de ventas del equipo (no aparece en Google) |
| `dashboard.html` | Dashboard del dueño (no aparece en Google) |
| `config.js` · `menu.js` | Datos del negocio (WhatsApp, horario) y carta |
| `modulos/restaurante/` | Código de las pantallas y `restaurante-datos.js` (URL y clave **anon** de Supabase) |
| `supabase/migrations/` | Base de datos: se corren en orden |
| `assets/` | Imágenes optimizadas |

## Cómo publicar
1. Los cambios entran en una rama o PR y se revisan.
2. Al hacer merge/push a `main`, GitHub Pages publica solo (Settings › Pages › *Deploy from a branch* › `main` / root).
3. No se publica si queda algún `[MARCADOR]` o `[CONFIRMAR]` visible (la agencia lo verifica antes de entregar).

## Base de datos (Supabase)
1. Crear el proyecto. Authentication › **desactivar «Allow new users to sign up»**. Settings › API › **Exposed schemas**: agregar `gorila_burgers`.
2. Correr `supabase/migrations/001` a `007` **en orden** (SQL Editor). La 007 es el mini juego «Gorila arriba».
3. Poner la URL y la clave **anon** del proyecto en `modulos/restaurante/restaurante-datos.js` (o en la configuración de producción de la agencia y regenerar). **Nunca la clave `service_role`.**

## Dar de alta al personal
1. En Supabase › Authentication › **Add user** (correo y clave) para el dueño y para cada empleado.
2. El primer dueño recibe el rol con la línea comentada al final de `supabase/migrations/006_semilla.sql`.
3. Después el dueño da de alta a cada empleado desde su sesión: `select gorila_burgers.equipo_guardar('correo@ejemplo.com', 'Nombre', 'vendedor');` (rol `vendedor` = empleado, `admin` = dueño).
4. Empleados entran en `personal.html`; el dueño, en `dashboard.html`. Cada día el dueño carga el stock en el dashboard («Cargar stock de hoy»).

## Mini juego «Gorila arriba»
Está en la sección «Juega y espera» de la página. Es solo para pasar el rato mientras llega el pedido: no pide datos, no tiene premio y no usa la base de datos.

## Contador público (opcional)
Para mostrar «hamburguesas vendidas en <año>» en la vitrina: el dueño corre `select gorila_burgers.contador_publico_guardar(true);`. Viene apagado.
