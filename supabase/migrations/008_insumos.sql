-- Módulo de restaurante · 008 recetas, insumos y consumo por venta (módulo adicional: solo entra si el cliente tiene `restaurante.insumos` en su cliente.json).
-- Qué resuelve: cada vez que se vende (o se confirma un pedido de la web) la base descuenta de la bodega TODO lo que lleva el producto
-- (carne, queso, pan, tocino, salsas, papas…) según su receta, y el dueño ve qué salió en cada venta, cuánto queda de cada insumo y cuánto durará.
-- Reglas de CLAUDE.md §4: RLS sin políticas, todo por funciones security definer con search_path vacío, permisos explícitos al final, movimientos inmutables (§4.9):
-- el consumo se guarda como una «foto» de la receta del momento de la venta; si la receta cambia después, las ventas viejas no se tocan.
-- Esta migración REEMPLAZA (create or replace) _descontar_stock y _devolver_stock de 002: hacen lo mismo de antes y además consumen o devuelven insumos.

-- ---------- tablas ----------
create table gorila_burgers.insumos (
  clave text primary key check (clave ~ '^[a-z0-9-]{2,30}$'),
  nombre text not null check (length(trim(nombre)) >= 2),
  unidad text not null check (unidad in ('uni', 'gr')),                       -- uni = piezas (carne, pan, lámina de queso…) · gr = gramos
  empaque_cant numeric(12, 2) check (empaque_cant is null or empaque_cant > 0), -- cuánto trae un empaque (ej.: la funda de papas, 2500 gr)
  empaque_nombre text check (empaque_nombre is null or length(trim(empaque_nombre)) between 2 and 30),
  minimo numeric(12, 2) not null default 0 check (minimo >= 0),               -- aviso de «queda poco»
  activo boolean not null default true,
  orden int not null default 0
);

-- Receta = cuánto de cada insumo lleva UNA unidad de un producto. producto no tiene llave foránea a propósito: la receta puede cargarse antes de que el producto
-- exista en la carta (ej.: una burger de temporada) y empieza a consumir apenas se vende.
create table gorila_burgers.recetas (
  producto text not null check (producto ~ '^[a-z0-9-]{2,30}$'),
  insumo text not null references gorila_burgers.insumos (clave),
  cantidad numeric(12, 2) not null check (cantidad > 0 and cantidad <= 100000),
  primary key (producto, insumo)
);

-- Libro de movimientos de la bodega (inmutable). Saldo de un insumo = suma de sus movimientos.
create table gorila_burgers.insumo_mov (
  id bigint generated always as identity primary key,
  dia date not null default ((now() at time zone 'America/Guayaquil')::date),
  insumo text not null references gorila_burgers.insumos (clave),
  delta numeric(12, 2) not null check (delta <> 0),
  motivo text not null check (motivo in ('compra', 'conteo', 'merma', 'venta', 'anulacion')),
  venta_id bigint references gorila_burgers.ventas (id),
  producto text,                                                              -- de qué producto salió (solo en venta y anulación)
  staff_id uuid references auth.users (id) on delete set null,
  nota text check (nota is null or length(nota) <= 200),
  creado timestamptz not null default now(),
  check ((motivo in ('venta', 'anulacion')) = (venta_id is not null))
);
create index insumo_mov_idx on gorila_burgers.insumo_mov (insumo, dia);
create index insumo_mov_venta_idx on gorila_burgers.insumo_mov (venta_id) where venta_id is not null;
create trigger insumo_mov_inmutable before update or delete on gorila_burgers.insumo_mov for each row execute function gorila_burgers._solo_insertar();

alter table gorila_burgers.insumos enable row level security;
alter table gorila_burgers.recetas enable row level security;
alter table gorila_burgers.insumo_mov enable row level security;
revoke all on gorila_burgers.insumos, gorila_burgers.recetas, gorila_burgers.insumo_mov from public, anon, authenticated;

-- ---------- consumo automático (ayudas internas) ----------
-- Foto de la receta al vender: una fila por (producto, insumo) de cada línea. Nunca bloquea la venta: si falta insumo, el saldo queda en negativo y el dashboard avisa.
create function gorila_burgers._consumir_insumos(p_venta bigint, p_staff uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v gorila_burgers.ventas;
begin
  select * into v from gorila_burgers.ventas where id = p_venta;
  insert into gorila_burgers.insumo_mov (dia, insumo, delta, motivo, venta_id, producto, staff_id)
    select v.dia, r.insumo, -(l.cantidad * r.cantidad), 'venta', p_venta, l.producto, p_staff
    from gorila_burgers.venta_lineas l join gorila_burgers.recetas r on r.producto = l.producto
    where l.venta_id = p_venta and l.cantidad * r.cantidad > 0;
end $$;

create function gorila_burgers._devolver_insumos(p_venta bigint, p_staff uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into gorila_burgers.insumo_mov (dia, insumo, delta, motivo, venta_id, producto, staff_id, nota)
    select m.dia, m.insumo, -m.delta, 'anulacion', p_venta, m.producto, p_staff, 'Venta anulada'
    from gorila_burgers.insumo_mov m
    where m.venta_id = p_venta and m.motivo = 'venta'
      and not exists (select 1 from gorila_burgers.insumo_mov a where a.venta_id = p_venta and a.motivo = 'anulacion');
end $$;

-- Reemplazo numerado de 002: lo mismo de antes + consumo de insumos (para TODAS las líneas, también extras y papas, aunque no controlen stock del día).
create or replace function gorila_burgers._descontar_stock(p_venta bigint, p_staff uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v gorila_burgers.ventas; r record;
begin
  select * into v from gorila_burgers.ventas where id = p_venta;
  for r in select l.producto, l.cantidad from gorila_burgers.venta_lineas l join gorila_burgers.productos p on p.clave = l.producto
           where l.venta_id = p_venta and p.controla_stock loop
    if gorila_burgers.stock_saldo(r.producto, v.dia) is not null then
      insert into gorila_burgers.stock_mov (dia, producto, delta, motivo, venta_id, staff_id) values (v.dia, r.producto, -r.cantidad, 'venta', p_venta, p_staff);
    end if;
  end loop;
  perform gorila_burgers._consumir_insumos(p_venta, p_staff);
end $$;

create or replace function gorila_burgers._devolver_stock(p_venta bigint, p_staff uuid) returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  for m in select dia, producto, -delta as cant from gorila_burgers.stock_mov where venta_id = p_venta and motivo = 'venta' loop
    insert into gorila_burgers.stock_mov (dia, producto, delta, motivo, venta_id, staff_id) values (m.dia, m.producto, m.cant, 'anulacion', p_venta, p_staff);
  end loop;
  perform gorila_burgers._devolver_insumos(p_venta, p_staff);
end $$;

-- Desglose de una venta (lo usan venta_desglose y desglose_pendientes). Si la venta ya consumió, sale la foto guardada; si aún es un pedido pendiente, la receta vigente (previsto = true).
create function gorila_burgers._desglose(p_venta bigint) returns json language plpgsql stable security definer set search_path = '' as $$
declare previsto boolean := not exists (select 1 from gorila_burgers.insumo_mov where venta_id = p_venta and motivo = 'venta');
begin
  return json_build_object('previsto', previsto,
    'lineas', coalesce((select json_agg(json_build_object('producto', l.producto, 'nombre', l.nombre, 'cantidad', l.cantidad, 'insumos', coalesce((
        select json_agg(json_build_object('insumo', i.clave, 'nombre', i.nombre, 'unidad', i.unidad, 'cantidad', x.cant) order by i.orden, i.nombre)
        from (select r.insumo, l.cantidad * r.cantidad as cant from gorila_burgers.recetas r where previsto and r.producto = l.producto
              union all
              select m.insumo, -sum(m.delta) from gorila_burgers.insumo_mov m where not previsto and m.venta_id = p_venta and m.motivo = 'venta' and m.producto = l.producto group by m.insumo) x
        join gorila_burgers.insumos i on i.clave = x.insumo), '[]'::json)) order by l.id)
      from gorila_burgers.venta_lineas l where l.venta_id = p_venta), '[]'::json),
    'total', coalesce((select json_agg(json_build_object('insumo', i.clave, 'nombre', i.nombre, 'unidad', i.unidad, 'cantidad', t.cant) order by i.orden, i.nombre)
      from (select x.insumo, sum(x.cant) cant from (
              select r.insumo, l.cantidad * r.cantidad as cant from gorila_burgers.venta_lineas l join gorila_burgers.recetas r on r.producto = l.producto where previsto and l.venta_id = p_venta
              union all
              select m.insumo, -m.delta from gorila_burgers.insumo_mov m where not previsto and m.venta_id = p_venta and m.motivo = 'venta') x group by x.insumo) t
      join gorila_burgers.insumos i on i.clave = t.insumo), '[]'::json));
end $$;

-- ---------- consultas (personal y dueño) ----------
-- Qué salió de bodega en una venta. El empleado ve el desglose de sus ventas; el dueño, el de cualquiera.
create function gorila_burgers.venta_desglose(p_id bigint) returns json language plpgsql stable security definer set search_path = '' as $$
declare v gorila_burgers.ventas;
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  select * into v from gorila_burgers.ventas where id = p_id;
  if not found or (not gorila_burgers.es_admin() and v.staff_id is distinct from auth.uid()) then raise exception 'No existe esa venta.'; end if;
  return json_build_object('id', v.id, 'numero', v.numero, 'estado', v.estado, 'desglose', gorila_burgers._desglose(p_id));
end $$;

-- Ticket de cocina de los pedidos de la web que esperan: qué lleva cada uno según la receta vigente.
create function gorila_burgers.desglose_pendientes() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  return coalesce((select json_agg(json_build_object('id', v.id, 'numero', v.numero, 'desglose', gorila_burgers._desglose(v.id)) order by v.id)
    from (select id, numero from gorila_burgers.ventas where estado = 'pendiente' order by id limit 60) v), '[]'::json);
end $$;

-- La bodega hoy: saldo de cada insumo, lo que salió hoy, lo que se usa por día (promedio de 7 días) y para cuántos días alcanza.
-- estado: sin_cargar (nadie contó ni compró todavía) · agotado · bajo · ok.
create function gorila_burgers.insumos_estado() returns json language plpgsql stable security definer set search_path = '' as $$
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
            exists (select 1 from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.motivo in ('compra', 'conteo')) as cargado,
            coalesce((select -sum(delta) from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.dia = d and m.motivo in ('venta', 'anulacion')), 0) as hoy,
            coalesce((select -sum(delta) / 7 from gorila_burgers.insumo_mov m where m.insumo = i.clave and m.dia between d - 7 and d - 1 and m.motivo in ('venta', 'anulacion')), 0) as prom
          from gorila_burgers.insumos i where i.activo) x), '[]'::json);
end $$;

-- Entradas y correcciones de la bodega (dueño). compra = entró mercadería · conteo = «lo que hay de verdad es esto» (ajusta la diferencia) · merma = se dañó o se perdió.
-- La cantidad va en la unidad del insumo (gr o uni): la pantalla convierte fundas a gramos.
create function gorila_burgers.insumo_mover(p_insumo text, p_tipo text, p_cantidad numeric, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
declare i gorila_burgers.insumos; saldo numeric; delta numeric; nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_tipo not in ('compra', 'conteo', 'merma') then raise exception 'Tipo de movimiento no válido.'; end if;
  if length(coalesce(nota, '')) > 200 then raise exception 'La nota es muy larga.'; end if;
  select * into i from gorila_burgers.insumos where clave = p_insumo and activo;
  if not found then raise exception 'No existe ese insumo.'; end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad > 1000000 then raise exception 'La cantidad debe estar entre 0 y 1.000.000.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  saldo := coalesce((select sum(m.delta) from gorila_burgers.insumo_mov m where m.insumo = p_insumo), 0);
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
  insert into gorila_burgers.insumo_mov (insumo, delta, motivo, staff_id, nota) values (p_insumo, delta, p_tipo, auth.uid(), nota);
  return json_build_object('insumo', p_insumo, 'saldo', saldo + delta, 'sin_cambio', false);
end $$;

-- Cuánto salió de cada insumo en un período (máx. 93 días) y de qué producto: «salieron 24 tocinos: 8 en Texas, 6 en Tocino BBQ…». Lo ya anulado se resta.
create function gorila_burgers.consumo_periodo(p_desde date, p_hasta date) returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 92 then raise exception 'Elige un período de hasta 93 días.'; end if;
  return json_build_object('desde', p_desde, 'hasta', p_hasta,
    'por_insumo', coalesce((select json_agg(json_build_object('insumo', i.clave, 'nombre', i.nombre, 'unidad', i.unidad, 'empaque_cant', i.empaque_cant, 'empaque_nombre', i.empaque_nombre,
        'consumido', t.cant) order by t.cant desc, i.nombre)
      from (select insumo, -sum(delta) cant from gorila_burgers.insumo_mov where dia between p_desde and p_hasta and motivo in ('venta', 'anulacion') group by insumo) t
      join gorila_burgers.insumos i on i.clave = t.insumo where t.cant <> 0), '[]'::json),
    'por_producto', coalesce((select json_agg(json_build_object('insumo', g.insumo, 'producto', g.producto, 'nombre', coalesce(p.nombre, g.producto), 'cantidad', g.cant) order by g.insumo, g.cant desc)
      from (select insumo, producto, -sum(delta) cant from gorila_burgers.insumo_mov where dia between p_desde and p_hasta and motivo in ('venta', 'anulacion') group by insumo, producto) g
      left join gorila_burgers.productos p on p.clave = g.producto where g.cant <> 0), '[]'::json));
end $$;

-- ---------- administración de insumos y recetas (dueño) ----------
create function gorila_burgers.recetas_admin() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  return json_build_object(
    'insumos', coalesce((select json_agg(row_to_json(i) order by i.orden, i.nombre) from gorila_burgers.insumos i), '[]'::json),
    'recetas', coalesce((select json_agg(json_build_object('producto', r.producto, 'insumo', r.insumo, 'cantidad', r.cantidad) order by r.producto, r.insumo) from gorila_burgers.recetas r), '[]'::json));
end $$;

-- Reemplaza la receta completa de un producto: [{"insumo": "carne", "cantidad": 2}, …]. Una lista vacía deja el producto sin receta. Solo afecta ventas futuras.
create function gorila_burgers.receta_guardar(p_producto text, p_items jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_producto is null or p_producto !~ '^[a-z0-9-]{2,30}$' then raise exception 'Producto no válido.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'Receta no válida.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where insumo is null or cantidad is null or cantidad <= 0 or cantidad > 100000) then
    raise exception 'Cada insumo lleva una cantidad mayor que cero.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where not exists (select 1 from gorila_burgers.insumos i where i.clave = x.insumo)) then
    raise exception 'Uno de los insumos no existe.';
  end if;
  delete from gorila_burgers.recetas where producto = p_producto;
  insert into gorila_burgers.recetas (producto, insumo, cantidad)
    select p_producto, x.insumo, sum(x.cantidad) from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) group by x.insumo;
end $$;

create function gorila_burgers.insumo_guardar(p_clave text, p_nombre text, p_unidad text, p_empaque_cant numeric, p_empaque_nombre text, p_minimo numeric, p_activo boolean default true, p_orden int default 0)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  if p_clave !~ '^[a-z0-9-]{2,30}$' then raise exception 'La clave son letras minúsculas, números y guiones.'; end if;
  if p_unidad not in ('uni', 'gr') then raise exception 'La unidad es uni o gr.'; end if;
  insert into gorila_burgers.insumos (clave, nombre, unidad, empaque_cant, empaque_nombre, minimo, activo, orden)
  values (p_clave, trim(p_nombre), p_unidad, p_empaque_cant, nullif(trim(coalesce(p_empaque_nombre, '')), ''), coalesce(p_minimo, 0), coalesce(p_activo, true), coalesce(p_orden, 0))
  on conflict (clave) do update set nombre = excluded.nombre, unidad = excluded.unidad, empaque_cant = excluded.empaque_cant, empaque_nombre = excluded.empaque_nombre,
    minimo = excluded.minimo, activo = excluded.activo, orden = excluded.orden;
end $$;

-- ---------- permisos (§4.3): ninguna función nueva queda abierta; las ayudas internas no se conceden a nadie ----------
revoke all on function
  gorila_burgers._consumir_insumos(bigint, uuid), gorila_burgers._devolver_insumos(bigint, uuid), gorila_burgers._desglose(bigint),
  gorila_burgers.venta_desglose(bigint), gorila_burgers.desglose_pendientes(), gorila_burgers.insumos_estado(), gorila_burgers.insumo_mover(text, text, numeric, text),
  gorila_burgers.consumo_periodo(date, date), gorila_burgers.recetas_admin(), gorila_burgers.receta_guardar(text, jsonb),
  gorila_burgers.insumo_guardar(text, text, text, numeric, text, numeric, boolean, int)
from public, anon, authenticated;
grant execute on function
  gorila_burgers.venta_desglose(bigint), gorila_burgers.desglose_pendientes(), gorila_burgers.insumos_estado(), gorila_burgers.insumo_mover(text, text, numeric, text),
  gorila_burgers.consumo_periodo(date, date), gorila_burgers.recetas_admin(), gorila_burgers.receta_guardar(text, jsonb),
  gorila_burgers.insumo_guardar(text, text, text, numeric, text, numeric, boolean, int)
to authenticated;
