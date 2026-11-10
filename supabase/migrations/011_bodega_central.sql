-- Módulo de restaurante · 011 bodega central y envíos al local (módulo adicional: solo entra si el cliente tiene `restaurante.bodega_central` en su cliente.json; requiere 008).
-- Qué resuelve: hay DOS inventarios. La bodega central guarda la mercadería y envía al local; el inventario del local es lo que ya recibió y lo que descuentan las ventas.
--   · El dueño ve cuánto hay en la central, cuánto está en camino, cuánto le queda al local y para cuántos días alcanza, y recibe una sugerencia de qué enviar.
--   · Un envío descuenta de la central al crearlo (queda «en camino») y suma al inventario del local solo cuando alguien del local lo RECIBE (así no hay stock fantasma).
--   · Cada venta del local sigue descontando del inventario del local (008): nunca de la central.
-- Reglas de CLAUDE.md §4: RLS sin políticas, security definer con search_path vacío, permisos explícitos, movimientos inmutables (se corrigen con anulaciones, §4.9).
-- Esta migración REEMPLAZA (create or replace) insumos_estado de 008: igual que antes, pero un insumo recibido por envío cuenta como «cargado».

-- ---------- el libro del local acepta los envíos recibidos ----------
alter table gorila_burgers.insumo_mov drop constraint if exists insumo_mov_motivo_check;
alter table gorila_burgers.insumo_mov add constraint insumo_mov_motivo_check check (motivo in ('compra', 'conteo', 'merma', 'venta', 'anulacion', 'envio'));

-- ---------- tablas ----------
create table gorila_burgers.envios (
  id bigint generated always as identity primary key,
  numero int not null unique,                                              -- consecutivo global (envío #1, #2…)
  estado text not null default 'enviado' check (estado in ('enviado', 'recibido', 'anulado')),
  nota text check (nota is null or length(nota) <= 200),
  creado_por uuid references auth.users (id) on delete set null,
  creado timestamptz not null default now(),
  recibido_por uuid references auth.users (id) on delete set null,
  recibido_en timestamptz,
  anulado_por uuid references auth.users (id) on delete set null,
  anulado_en timestamptz,
  anulado_motivo text check (anulado_motivo is null or length(anulado_motivo) <= 200)
);
create table gorila_burgers.envio_items (
  envio_id bigint not null references gorila_burgers.envios (id),
  insumo text not null references gorila_burgers.insumos (clave),
  cantidad numeric(12, 2) not null check (cantidad > 0 and cantidad <= 1000000),
  primary key (envio_id, insumo)
);
-- Libro de la bodega central (inmutable). Saldo = suma de sus movimientos.
create table gorila_burgers.bodega_mov (
  id bigint generated always as identity primary key,
  dia date not null default ((now() at time zone 'America/Guayaquil')::date),
  insumo text not null references gorila_burgers.insumos (clave),
  delta numeric(12, 2) not null check (delta <> 0),
  motivo text not null check (motivo in ('compra', 'conteo', 'merma', 'envio', 'anulacion')),
  envio_id bigint references gorila_burgers.envios (id),
  staff_id uuid references auth.users (id) on delete set null,
  nota text check (nota is null or length(nota) <= 200),
  creado timestamptz not null default now(),
  check ((motivo in ('envio', 'anulacion')) = (envio_id is not null))
);
create index bodega_mov_idx on gorila_burgers.bodega_mov (insumo, dia);
alter table gorila_burgers.insumo_mov add column envio_id bigint references gorila_burgers.envios (id);   -- de qué envío vino lo que recibió el local
create index envios_estado_idx on gorila_burgers.envios (estado, creado);

create trigger envio_items_inmutable before update or delete on gorila_burgers.envio_items for each row execute function gorila_burgers._solo_insertar();
create trigger bodega_mov_inmutable before update or delete on gorila_burgers.bodega_mov for each row execute function gorila_burgers._solo_insertar();
-- Un envío solo cambia de estado: enviado → recibido o enviado → anulado. Nada más y nunca se borra.
create function gorila_burgers._envio_estado() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Los envíos no se borran: se anulan.'; end if;
  if old.estado = 'enviado' and new.estado in ('recibido', 'anulado') and (old.id, old.numero, old.nota, old.creado_por, old.creado) is not distinct from (new.id, new.numero, new.nota, new.creado_por, new.creado) then
    return new;
  end if;
  raise exception 'Un envío solo cambia de estado (enviado → recibido o anulado).';
end $$;
create trigger envios_estado before update or delete on gorila_burgers.envios for each row execute function gorila_burgers._envio_estado();

alter table gorila_burgers.envios enable row level security;
alter table gorila_burgers.envio_items enable row level security;
alter table gorila_burgers.bodega_mov enable row level security;
revoke all on gorila_burgers.envios, gorila_burgers.envio_items, gorila_burgers.bodega_mov from public, anon, authenticated;

-- ---------- reemplazo numerado de 008: lo recibido por envío cuenta como «cargado» ----------
create or replace function gorila_burgers.insumos_estado() returns json language plpgsql stable security definer set search_path = '' as $$
declare d date := gorila_burgers.hoy_ec();
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  return coalesce((select json_agg(json_build_object(
      'clave', x.clave, 'nombre', x.nombre, 'unidad', x.unidad, 'empaque_cant', x.empaque_cant, 'empaque_nombre', x.empaque_nombre, 'minimo', x.minimo,
      'saldo', x.saldo, 'hoy', x.hoy, 'promedio_dia', x.prom,
      'alcanza_dias', case when x.cargado and x.prom > 0 and x.saldo > 0 then round(x.saldo / x.prom, 1) end,
      'estado', case when not x.cargado then 'sin_cargar' when x.saldo <= 0 then 'agotado' when x.saldo <= x.minimo then 'bajo' else 'ok' end) order by x.orden, x.nombre)
    from (select i.*,
            coalesce((select sum(delta) from gorila_burgers.insumo_mov m where m.insumo = i.clave), 0) as saldo,
            exists (select 1 from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.motivo in ('compra', 'conteo', 'envio')) as cargado,
            coalesce((select -sum(delta) from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.dia = d and m.motivo in ('venta', 'anulacion')), 0) as hoy,
            coalesce((select -sum(delta) / 7 from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.dia between d - 7 and d - 1 and m.motivo in ('venta', 'anulacion')), 0) as prom
          from gorila_burgers.insumos i where i.activo) x), '[]'::json);
end $$;

-- ---------- ayuda interna: saldo y carga de cada insumo en el local (lo que usan inventario_local y central_estado) ----------
create function gorila_burgers._local_saldos() returns table (clave text, nombre text, unidad text, empaque_cant numeric, empaque_nombre text, minimo numeric, orden int, saldo numeric, cargado boolean, hoy numeric, prom numeric)
language sql stable security definer set search_path = '' as $$
  select i.clave, i.nombre, i.unidad, i.empaque_cant, i.empaque_nombre, i.minimo, i.orden,
    coalesce((select sum(delta) from gorila_burgers.insumo_mov m where m.insumo = i.clave), 0),
    exists (select 1 from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.motivo in ('compra', 'conteo', 'envio')),
    coalesce((select -sum(delta) from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.dia = gorila_burgers.hoy_ec() and m.motivo in ('venta', 'anulacion')), 0),
    coalesce((select -sum(delta) / 7 from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.dia between gorila_burgers.hoy_ec() - 7 and gorila_burgers.hoy_ec() - 1 and m.motivo in ('venta', 'anulacion')), 0)
  from gorila_burgers.insumos i where i.activo $$;

-- ---------- el local (empleado y dueño): qué hay y cuántas alcanzan ----------
-- Inventario del local en vivo: lo que descuentan las ventas. «alcanzan» = cuántas unidades de cada producto se pueden hacer con lo que hay (manda el ingrediente que se acaba primero).
create function gorila_burgers.inventario_local() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  return json_build_object(
    'insumos', coalesce((select json_agg(json_build_object('clave', s.clave, 'nombre', s.nombre, 'unidad', s.unidad, 'empaque_cant', s.empaque_cant, 'empaque_nombre', s.empaque_nombre, 'saldo', s.saldo, 'hoy', s.hoy,
        'alcanza_dias', case when s.cargado and s.prom > 0 and s.saldo > 0 then round(s.saldo / s.prom, 1) end,
        'estado', case when not s.cargado then 'sin_cargar' when s.saldo <= 0 then 'agotado' when s.saldo <= s.minimo then 'bajo' else 'ok' end) order by s.orden, s.nombre)
      from gorila_burgers._local_saldos() s), '[]'::json),
    'productos', coalesce((select json_agg(json_build_object('producto', p.clave, 'nombre', p.nombre,
        'alcanzan', a.n, 'limita', a.limita, 'faltan_datos', a.faltan) order by p.orden, p.nombre)
      from gorila_burgers.productos p
      cross join lateral (
        select min(floor(greatest(s.saldo, 0) / r.cantidad)) filter (where s.cargado) as n,
               (array_agg(s.nombre order by floor(greatest(s.saldo, 0) / r.cantidad), s.nombre) filter (where s.cargado))[1] as limita,
               bool_or(not s.cargado) as faltan
        from gorila_burgers.recetas r join gorila_burgers._local_saldos() s on s.clave = r.insumo where r.producto = p.clave) a
      where p.activo and p.categoria <> 'extras' and (a.n is not null or a.faltan)), '[]'::json));
end $$;

-- ---------- envíos ----------
create function gorila_burgers._envio_json(p_id bigint) returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('id', e.id, 'numero', e.numero, 'estado', e.estado, 'nota', e.nota, 'creado', e.creado, 'quien', sc.nombre, 'recibido_en', e.recibido_en, 'recibido_por', sr.nombre,
    'anulado_en', e.anulado_en, 'anulado_motivo', e.anulado_motivo,
    'items', coalesce((select json_agg(json_build_object('insumo', i.clave, 'nombre', i.nombre, 'unidad', i.unidad, 'cantidad', t.cantidad) order by i.orden, i.nombre)
      from gorila_burgers.envio_items t join gorila_burgers.insumos i on i.clave = t.insumo where t.envio_id = e.id), '[]'::json))
  from gorila_burgers.envios e left join gorila_burgers.staff sc on sc.user_id = e.creado_por left join gorila_burgers.staff sr on sr.user_id = e.recibido_por where e.id = p_id $$;

-- Envíos recientes (los en camino salen primero). El empleado los ve para poder recibirlos.
create function gorila_burgers.envios_lista(p_dias int default 14) returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Elige entre 1 y 90 días.'; end if;
  return coalesce((select json_agg(gorila_burgers._envio_json(x.id) order by (x.estado = 'enviado') desc, x.id desc)
    from (select id, estado from gorila_burgers.envios where estado = 'enviado' or creado > now() - make_interval(days => p_dias) order by id desc limit 80) x), '[]'::json);
end $$;

-- Recibir un envío: lo que trae pasa al inventario del local (movimiento «envio»). Una sola vez.
create function gorila_burgers.envio_recibir(p_id bigint) returns json language plpgsql security definer set search_path = '' as $$
declare e gorila_burgers.envios;
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  select * into e from gorila_burgers.envios where id = p_id for update;
  if not found then raise exception 'No existe ese envío.'; end if;
  if e.estado <> 'enviado' then raise exception 'Ese envío ya fue %.', case e.estado when 'recibido' then 'recibido' else 'anulado' end; end if;
  update gorila_burgers.envios set estado = 'recibido', recibido_por = auth.uid(), recibido_en = now() where id = p_id;
  insert into gorila_burgers.insumo_mov (insumo, delta, motivo, staff_id, nota, envio_id)
    select t.insumo, t.cantidad, 'envio', auth.uid(), 'Recibido de bodega central (envío #' || e.numero || ')', p_id from gorila_burgers.envio_items t where t.envio_id = p_id;
  return gorila_burgers._envio_json(p_id);
end $$;

-- ---------- bodega central (dueño) ----------
-- Qué hay en la central, qué viene en camino, cómo está el local y cuánto conviene enviar para cubrir p_dias días de venta (promedio de 7 días).
-- estado: enviar (el local necesita y la central tiene) · central_bajo (hace falta enviar más de lo que hay en la central) · ok · sin_cargar (la central aún no se contó).
create function gorila_burgers.central_estado(p_dias int default 3) returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 30 then raise exception 'Los días a cubrir van de 1 a 30.'; end if;
  return coalesce((select json_agg(json_build_object(
      'clave', y.clave, 'nombre', y.nombre, 'unidad', y.unidad, 'empaque_cant', y.empaque_cant, 'empaque_nombre', y.empaque_nombre, 'minimo', y.minimo,
      'central', y.central, 'central_cargado', y.central_cargado, 'local', y.saldo, 'local_cargado', y.cargado, 'en_camino', y.en_camino, 'hoy', y.hoy, 'promedio_dia', y.prom,
      'alcanza_dias', case when y.cargado and y.prom > 0 and y.saldo > 0 then round(y.saldo / y.prom, 1) end,
      'sugerido', y.sugerido,
      'estado', case when not y.central_cargado then 'sin_cargar' when y.sugerido > 0 and y.central < y.sugerido then 'central_bajo' when y.sugerido > 0 then 'enviar' else 'ok' end) order by y.orden, y.nombre)
    from (select x.*,
            case when not x.cargado then greatest(x.minimo * 2 - x.en_camino, 0)
                 when x.prom > 0 then greatest(ceil((x.prom * p_dias - greatest(x.saldo, 0) - x.en_camino) / x.paso) * x.paso, 0)
                 else greatest(ceil((x.minimo * 2 - greatest(x.saldo, 0) - x.en_camino) / x.paso) * x.paso, 0) end as sugerido
          from (select s.*, case s.unidad when 'gr' then 50 else 1 end as paso,
                  coalesce((select sum(b.delta) from gorila_burgers.bodega_mov b where b.insumo = s.clave), 0) as central,
                  exists (select 1 from gorila_burgers.bodega_mov b where b.insumo = s.clave and b.motivo in ('compra', 'conteo')) as central_cargado,
                  coalesce((select sum(t.cantidad) from gorila_burgers.envio_items t join gorila_burgers.envios e on e.id = t.envio_id where t.insumo = s.clave and e.estado = 'enviado'), 0) as en_camino
                from gorila_burgers._local_saldos() s) x) y), '[]'::json);
end $$;

-- Entradas y correcciones de la bodega central: compra (entró mercadería) · conteo («hay esto») · merma (se dañó). Cantidad en gr o uni.
create function gorila_burgers.central_mover(p_insumo text, p_tipo text, p_cantidad numeric, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
declare i gorila_burgers.insumos; saldo numeric; delta numeric; nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_tipo not in ('compra', 'conteo', 'merma') then raise exception 'Tipo de movimiento no válido.'; end if;
  if length(coalesce(nota, '')) > 200 then raise exception 'La nota es muy larga.'; end if;
  select * into i from gorila_burgers.insumos where clave = p_insumo and activo;
  if not found then raise exception 'No existe ese insumo.'; end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad > 1000000 then raise exception 'La cantidad debe estar entre 0 y 1.000.000.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  saldo := coalesce((select sum(b.delta) from gorila_burgers.bodega_mov b where b.insumo = p_insumo), 0);
  if p_tipo = 'compra' then
    if p_cantidad = 0 then raise exception 'Escribe cuánto entró.'; end if;
    delta := p_cantidad;
  elsif p_tipo = 'merma' then
    if p_cantidad = 0 then raise exception 'Escribe cuánto se perdió.'; end if;
    if nota is null then raise exception 'Escribe el motivo de la merma.'; end if;
    delta := -p_cantidad;
  else
    delta := p_cantidad - saldo;
    if delta = 0 then return json_build_object('insumo', p_insumo, 'saldo', saldo, 'sin_cambio', true); end if;
  end if;
  insert into gorila_burgers.bodega_mov (insumo, delta, motivo, staff_id, nota) values (p_insumo, delta, p_tipo, auth.uid(), nota);
  return json_build_object('insumo', p_insumo, 'saldo', saldo + delta, 'sin_cambio', false);
end $$;

-- Crear un envío al local: [{"insumo": "carne", "cantidad": 50}, …]. Descuenta de la central al instante (queda «en camino») y no deja enviar más de lo que hay.
create function gorila_burgers.envio_crear(p_items jsonb, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
declare r record; id_e bigint; num int; nota text := nullif(trim(coalesce(p_nota, '')), ''); saldo numeric;
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if length(coalesce(nota, '')) > 200 then raise exception 'La nota es muy larga.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'Elige al menos un insumo para enviar.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where insumo is null or cantidad is null or cantidad <= 0 or cantidad > 1000000) then
    raise exception 'Cada insumo lleva una cantidad mayor que cero.';
  end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  select coalesce(max(numero), 0) + 1 into num from gorila_burgers.envios;
  insert into gorila_burgers.envios (numero, nota, creado_por) values (num, nota, auth.uid()) returning id into id_e;
  for r in select x.insumo, sum(x.cantidad) as cantidad from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) group by x.insumo loop
    if not exists (select 1 from gorila_burgers.insumos i where i.clave = r.insumo and i.activo) then raise exception 'Uno de los insumos no existe.'; end if;
    saldo := coalesce((select sum(b.delta) from gorila_burgers.bodega_mov b where b.insumo = r.insumo), 0);
    if saldo < r.cantidad then
      raise exception 'En la bodega central de % quedan % y quieres enviar %.', (select nombre from gorila_burgers.insumos where clave = r.insumo), saldo, r.cantidad;
    end if;
    insert into gorila_burgers.envio_items (envio_id, insumo, cantidad) values (id_e, r.insumo, r.cantidad);
    insert into gorila_burgers.bodega_mov (insumo, delta, motivo, envio_id, staff_id, nota) values (r.insumo, -r.cantidad, 'envio', id_e, auth.uid(), 'Envío #' || num);
  end loop;
  return gorila_burgers._envio_json(id_e);
end $$;

-- Anular un envío que aún no se recibió: la mercadería vuelve a la central. Uno recibido no se anula (se corrige con conteo o merma).
create function gorila_burgers.envio_anular(p_id bigint, p_motivo text) returns void language plpgsql security definer set search_path = '' as $$
declare e gorila_burgers.envios;
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 or length(p_motivo) > 200 then raise exception 'Escribe el motivo de la anulación.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  select * into e from gorila_burgers.envios where id = p_id for update;
  if not found then raise exception 'No existe ese envío.'; end if;
  if e.estado <> 'enviado' then raise exception 'Ese envío ya no se puede anular.'; end if;
  update gorila_burgers.envios set estado = 'anulado', anulado_por = auth.uid(), anulado_en = now(), anulado_motivo = trim(p_motivo) where id = p_id;
  insert into gorila_burgers.bodega_mov (insumo, delta, motivo, envio_id, staff_id, nota)
    select t.insumo, t.cantidad, 'anulacion', p_id, auth.uid(), 'Envío #' || e.numero || ' anulado' from gorila_burgers.envio_items t where t.envio_id = p_id;
end $$;

-- ---------- permisos (§4.3) ----------
revoke all on function gorila_burgers._envio_estado(), gorila_burgers._local_saldos(), gorila_burgers._envio_json(bigint), gorila_burgers.inventario_local(), gorila_burgers.envios_lista(int), gorila_burgers.envio_recibir(bigint),
  gorila_burgers.central_estado(int), gorila_burgers.central_mover(text, text, numeric, text), gorila_burgers.envio_crear(jsonb, text), gorila_burgers.envio_anular(bigint, text), gorila_burgers.insumos_estado() from public, anon, authenticated;
grant execute on function gorila_burgers.inventario_local(), gorila_burgers.envios_lista(int), gorila_burgers.envio_recibir(bigint), gorila_burgers.central_estado(int), gorila_burgers.central_mover(text, text, numeric, text),
  gorila_burgers.envio_crear(jsonb, text), gorila_burgers.envio_anular(bigint, text), gorila_burgers.insumos_estado() to authenticated;
