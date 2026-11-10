-- Módulo de restaurante · 013 recepción libre: el local anota lo que LLEGÓ, sin comparar con ningún envío. Requiere 011 (y reemplaza lo de 012).
-- Qué resuelve: a veces al local llegan también papas u otras cosas de terceros, y el vendedor no necesita saber qué mandó la bodega.
--   · El vendedor solo escribe cuánto llegó de cada ingrediente: entra al inventario del local. No ve los envíos ni lo enviado.
--   · El dueño ve cada recepción (quién, cuándo, qué) y, en cada envío en camino, cuánto ha registrado el local desde que salió; con un toque marca el envío como recibido.
--   · Un error de digitación se corrige anulando la recepción (el vendedor la suya, dentro de 10 minutos; el dueño cualquiera): nada se borra (§4.9).
-- Reglas de CLAUDE.md §4: security definer con search_path vacío, permisos explícitos, tablas inmutables.
-- Esta migración REEMPLAZA envios_lista (ahora solo dueño) y elimina envio_recibir (el conteo a ciegas de 012).

alter table gorila_burgers.insumo_mov add column recepcion_id bigint;   -- de qué recepción vino el movimiento (se enlaza abajo)

create table gorila_burgers.recepciones (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  staff_id uuid references auth.users (id) on delete set null,
  nota text check (nota is null or length(nota) <= 200)
);
create table gorila_burgers.recepcion_items (
  recepcion_id bigint not null references gorila_burgers.recepciones (id),
  insumo text not null references gorila_burgers.insumos (clave),
  cantidad numeric(12, 2) not null check (cantidad > 0 and cantidad <= 1000000),
  primary key (recepcion_id, insumo)
);
create table gorila_burgers.recepcion_anulaciones (
  recepcion_id bigint primary key references gorila_burgers.recepciones (id),
  por uuid references auth.users (id) on delete set null,
  motivo text not null check (length(motivo) between 3 and 200),
  creado timestamptz not null default now()
);
alter table gorila_burgers.insumo_mov add constraint insumo_mov_recepcion_fk foreign key (recepcion_id) references gorila_burgers.recepciones (id);
create trigger recepciones_inmutable before update or delete on gorila_burgers.recepciones for each row execute function gorila_burgers._solo_insertar();
create trigger recepcion_items_inmutable before update or delete on gorila_burgers.recepcion_items for each row execute function gorila_burgers._solo_insertar();
create trigger recepcion_anulaciones_inmutable before update or delete on gorila_burgers.recepcion_anulaciones for each row execute function gorila_burgers._solo_insertar();
alter table gorila_burgers.recepciones enable row level security;
alter table gorila_burgers.recepcion_items enable row level security;
alter table gorila_burgers.recepcion_anulaciones enable row level security;
revoke all on gorila_burgers.recepciones, gorila_burgers.recepcion_items, gorila_burgers.recepcion_anulaciones from public, anon, authenticated;

create function gorila_burgers._recepcion_json(p_id bigint) returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('id', r.id, 'creado', r.creado, 'quien', s.nombre, 'nota', r.nota, 'staff_id', r.staff_id, 'anulada', a.recepcion_id is not null, 'anulada_motivo', a.motivo,
    'items', coalesce((select json_agg(json_build_object('insumo', i.clave, 'nombre', i.nombre, 'unidad', i.unidad, 'cantidad', t.cantidad) order by i.orden, i.nombre)
      from gorila_burgers.recepcion_items t join gorila_burgers.insumos i on i.clave = t.insumo where t.recepcion_id = r.id), '[]'::json))
  from gorila_burgers.recepciones r left join gorila_burgers.staff s on s.user_id = r.staff_id left join gorila_burgers.recepcion_anulaciones a on a.recepcion_id = r.id where r.id = p_id $$;

-- Registrar lo que llegó: p_items = [{"insumo": "carne", "cantidad": 38}, …]. Solo los que llegaron (cantidad mayor que cero).
create function gorila_burgers.recepcion_registrar(p_items jsonb, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
declare v_nota text := nullif(trim(coalesce(p_nota, '')), ''); id_r bigint;
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  if length(coalesce(v_nota, '')) > 200 then raise exception 'La nota es muy larga.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Escribe cuánto llegó de al menos un ingrediente.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where insumo is null or cantidad is null or cantidad <= 0 or cantidad > 1000000) then
    raise exception 'Cada ingrediente lleva una cantidad mayor que cero.';
  end if;
  if (select count(distinct x.insumo) from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric)) <> jsonb_array_length(p_items) then raise exception 'Un ingrediente está repetido.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where not exists (select 1 from gorila_burgers.insumos i where i.clave = x.insumo and i.activo)) then
    raise exception 'Uno de los ingredientes no existe.';
  end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  insert into gorila_burgers.recepciones (staff_id, nota) values (auth.uid(), v_nota) returning id into id_r;
  insert into gorila_burgers.recepcion_items (recepcion_id, insumo, cantidad) select id_r, x.insumo, x.cantidad from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric);
  insert into gorila_burgers.insumo_mov (insumo, delta, motivo, staff_id, nota, recepcion_id)
    select x.insumo, x.cantidad, 'compra', auth.uid(), 'Recibido en el local (recepción #' || id_r || ')', id_r from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric);
  return gorila_burgers._recepcion_json(id_r);
end $$;

-- Recepciones recientes. Dueño: todas de los últimos p_dias. Empleado: solo las suyas de las últimas 12 horas (para revisar o corregir).
create function gorila_burgers.recepciones_lista(p_dias int default 7) returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Elige entre 1 y 90 días.'; end if;
  return coalesce((select json_agg(gorila_burgers._recepcion_json(x.id) order by x.id desc)
    from (select id from gorila_burgers.recepciones where (gorila_burgers.es_admin() and creado > now() - make_interval(days => p_dias))
                                                    or (staff_id = auth.uid() and creado > now() - interval '12 hours') order by id desc limit 80) x), '[]'::json);
end $$;

-- Corregir una recepción mal anotada: queda anulada y lo que sumó se resta del inventario del local.
create function gorila_burgers.recepcion_anular(p_id bigint, p_motivo text) returns void language plpgsql security definer set search_path = '' as $$
declare r gorila_burgers.recepciones;
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 or length(p_motivo) > 200 then raise exception 'Escribe el motivo.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  select * into r from gorila_burgers.recepciones where id = p_id for update;
  if not found then raise exception 'No existe esa recepción.'; end if;
  if not gorila_burgers.es_admin() and (r.staff_id is distinct from auth.uid() or r.creado < now() - interval '10 minutes') then
    raise exception 'Solo el dueño puede anular esta recepción (el empleado puede anular la suya durante 10 minutos).';
  end if;
  if exists (select 1 from gorila_burgers.recepcion_anulaciones where recepcion_id = p_id) then raise exception 'Esa recepción ya está anulada.'; end if;
  insert into gorila_burgers.recepcion_anulaciones (recepcion_id, por, motivo) values (p_id, auth.uid(), trim(p_motivo));
  insert into gorila_burgers.insumo_mov (insumo, delta, motivo, staff_id, nota, recepcion_id)
    select t.insumo, -t.cantidad, 'merma', auth.uid(), 'Recepción #' || p_id || ' anulada', p_id from gorila_burgers.recepcion_items t where t.recepcion_id = p_id;
end $$;

-- El dueño da por recibido un envío en camino (no mueve inventario: lo que llegó ya lo anotó el local).
create function gorila_burgers.envio_cerrar(p_id bigint, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
declare e gorila_burgers.envios; v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if length(coalesce(v_nota, '')) > 200 then raise exception 'La nota es muy larga.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  select * into e from gorila_burgers.envios where id = p_id for update;
  if not found then raise exception 'No existe ese envío.'; end if;
  if e.estado <> 'enviado' then raise exception 'Ese envío ya fue %.', case e.estado when 'recibido' then 'recibido' else 'anulado' end; end if;
  update gorila_burgers.envios set estado = 'recibido', recibido_por = auth.uid(), recibido_en = now(), recepcion_nota = v_nota where id = p_id;
  return gorila_burgers._envio_json(p_id, true);
end $$;

-- Los envíos son cosa del dueño: el vendedor no los ve.
create or replace function gorila_burgers.envios_lista(p_dias int default 14) returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Elige entre 1 y 90 días.'; end if;
  return coalesce((select json_agg(gorila_burgers._envio_json(x.id, true) order by (x.estado = 'enviado') desc, x.id desc)
    from (select id, estado from gorila_burgers.envios where estado = 'enviado' or creado > now() - make_interval(days => p_dias) order by id desc limit 80) x), '[]'::json);
end $$;

drop function gorila_burgers.envio_recibir(bigint, jsonb, text);

-- ---------- permisos (§4.3) ----------
revoke all on function gorila_burgers._recepcion_json(bigint), gorila_burgers.recepcion_registrar(jsonb, text), gorila_burgers.recepciones_lista(int), gorila_burgers.recepcion_anular(bigint, text), gorila_burgers.envio_cerrar(bigint, text), gorila_burgers.envios_lista(int) from public, anon, authenticated;
grant execute on function gorila_burgers.recepcion_registrar(jsonb, text), gorila_burgers.recepciones_lista(int), gorila_burgers.recepcion_anular(bigint, text), gorila_burgers.envio_cerrar(bigint, text), gorila_burgers.envios_lista(int) to authenticated;
