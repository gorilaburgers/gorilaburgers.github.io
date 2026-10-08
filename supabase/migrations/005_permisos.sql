-- Módulo de restaurante · 005 permisos (§4.3): primero se revoca TODO a public/anon/authenticated y luego se concede solo lo necesario.
-- Postgres concede EXECUTE a PUBLIC por defecto en cada función nueva; por eso el revoke va explícito.
revoke all on all functions in schema gorila_burgers from public, anon, authenticated;
alter default privileges in schema gorila_burgers revoke execute on functions from public, anon, authenticated;
grant usage on schema gorila_burgers to anon, authenticated;

-- El cliente final (sin sesión): solo la vitrina, el contador (si el dueño lo activó) y crear un pedido. Todo se valida dentro.
grant execute on function gorila_burgers.ping(), gorila_burgers.carta(), gorila_burgers.contador(),
  gorila_burgers.pedido_crear(text, text, text, text, text, text, text, timestamptz, jsonb)
to anon, authenticated;

-- El personal y el dueño (con sesión de Authentication): cada función comprueba es_staff() / es_admin() por dentro.
grant execute on function
  gorila_burgers.yo(), gorila_burgers.stock_hoy(), gorila_burgers.venta_registrar(jsonb, text, text), gorila_burgers.venta_anular(bigint, text),
  gorila_burgers.ventas_hoy(), gorila_burgers.pedidos_pendientes(), gorila_burgers.pedido_resolver(bigint, text),
  gorila_burgers.stock_fijar(text, int), gorila_burgers.stock_fijar_varios(jsonb),
  gorila_burgers.dashboard(), gorila_burgers.reporte_mes(date),
  gorila_burgers.productos_admin(),
  gorila_burgers.producto_guardar(text, text, text, int, text, text, text, boolean, boolean, boolean, int),
  gorila_burgers.sector_guardar(text, int, boolean, int),
  gorila_burgers.equipo_lista(), gorila_burgers.equipo_guardar(text, text, text, boolean),
  gorila_burgers.config_guardar(int, int, int, int, int), gorila_burgers.contador_publico_guardar(boolean)
to authenticated;
-- Ayudas internas (tel, hoy_ec, rol, es_*, stock_saldo, vendidas, _descontar_stock, _devolver_stock, _hay_stock, _crear_venta, _stock_fijar, triggers):
-- sin permiso para nadie. Las llaman las funciones de arriba (security definer).
