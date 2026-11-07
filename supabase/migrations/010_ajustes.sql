-- Módulo de restaurante · 010 ajustes del dueño: costo de envío por sector y precios de la carta, editables desde el panel (solo admin).
-- Todas security definer con search_path vacío (§4.2) y permiso solo para authenticated (§4.3); cada una comprueba es_admin() por dentro.

-- Todos los sectores (también los apagados), para que el dueño los edite. carta() solo muestra los activos al público.
create function gorila_burgers.sectores_admin() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  return coalesce((select json_agg(json_build_object('nombre', s.nombre, 'costo_cent', s.costo_cent, 'activo', s.activo, 'orden', s.orden) order by s.orden, s.nombre)
    from gorila_burgers.sectores s), '[]'::json);
end $$;

-- Guarda varios sectores a la vez, todo o nada: [{"nombre": "FICOA", "costo_cent": 200, "activo": true}, …]. Si el sector no existe, lo crea (al final de la lista).
create function gorila_burgers.sectores_guardar_varios(p_items jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare r record; sig int;
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Lista de sectores no válida.'; end if;
  for r in select * from jsonb_to_recordset(p_items) as x (nombre text, costo_cent int, activo boolean) loop
    if r.nombre is null or length(trim(r.nombre)) < 2 or length(r.nombre) > 60 then raise exception 'Cada sector necesita un nombre.'; end if;
    if r.costo_cent is null or r.costo_cent < 0 or r.costo_cent > 2000 then raise exception 'El envío de % debe costar entre $0.00 y $20.00.', trim(r.nombre); end if;
    select coalesce(max(orden), 0) + 1 into sig from gorila_burgers.sectores;
    insert into gorila_burgers.sectores (nombre, costo_cent, activo, orden) values (trim(r.nombre), r.costo_cent, coalesce(r.activo, true), sig)
    on conflict (nombre) do update set costo_cent = excluded.costo_cent, activo = excluded.activo;
  end loop;
end $$;

-- Cambia solo el precio de varios productos, todo o nada: [{"clave": "texas", "precio_cent": 790}, …]. Solo afecta ventas nuevas: las ventas guardadas conservan su precio.
create function gorila_burgers.precios_guardar(p_items jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 80 then raise exception 'Lista de precios no válida.'; end if;
  for r in select * from jsonb_to_recordset(p_items) as x (clave text, precio_cent int) loop
    if r.precio_cent is null or r.precio_cent <= 0 or r.precio_cent > 100000 then raise exception 'Cada precio debe estar entre $0.01 y $1,000.00.'; end if;
    update gorila_burgers.productos set precio_cent = r.precio_cent where clave = r.clave;
    if not found then raise exception 'Uno de los productos no existe.'; end if;
  end loop;
end $$;

revoke all on function gorila_burgers.sectores_admin(), gorila_burgers.sectores_guardar_varios(jsonb), gorila_burgers.precios_guardar(jsonb) from public, anon, authenticated;
grant execute on function gorila_burgers.sectores_admin(), gorila_burgers.sectores_guardar_varios(jsonb), gorila_burgers.precios_guardar(jsonb) to authenticated;
