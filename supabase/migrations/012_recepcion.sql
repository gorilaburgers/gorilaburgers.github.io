-- Módulo de restaurante · 012 recepción con conteo: el local cuenta y anota lo que llegó de cada envío (paso de seguridad). Requiere 011.
-- Qué resuelve: antes bastaba tocar «recibir». Ahora quien recibe CUENTA cada insumo y escribe cuánto llegó:
--   · Recepción a ciegas: el empleado no ve cuánto se envió (la base no se lo devuelve); solo el dueño ve enviado, recibido y diferencia.
--   · Si lo contado no coincide con lo enviado, la base NO lo acepta hasta que haya una nota explicando la diferencia (y le avisa que no coincide, sin decir cuánto).
--   · Al local entra lo que se CONTÓ (no lo que se envió); el envío queda marcado «con diferencias» y el dueño lo ve.
-- Reglas de CLAUDE.md §4: security definer con search_path vacío, permisos explícitos, inmutable (§4.9: la recepción se guarda en su propia tabla y no se modifica).
-- Esta migración REEMPLAZA (create or replace / drop + create) envio_recibir, envios_lista, envio_crear y _envio_json de 011.

alter table gorila_burgers.envios add column con_diferencias boolean not null default false;
alter table gorila_burgers.envios add column recepcion_nota text check (recepcion_nota is null or length(recepcion_nota) <= 200);

-- Lo que el local contó de cada insumo al recibir (inmutable).
create table gorila_burgers.envio_recepcion (
  envio_id bigint not null references gorila_burgers.envios (id),
  insumo text not null references gorila_burgers.insumos (clave),
  recibido numeric(12, 2) not null check (recibido >= 0 and recibido <= 1000000),
  primary key (envio_id, insumo)
);
create trigger envio_recepcion_inmutable before update or delete on gorila_burgers.envio_recepcion for each row execute function gorila_burgers._solo_insertar();
alter table gorila_burgers.envio_recepcion enable row level security;
revoke all on gorila_burgers.envio_recepcion from public, anon, authenticated;

-- Un envío como JSON. p_admin = true (dueño): enviado, recibido y diferencia. p_admin = false (empleado): a ciegas, sin cantidades enviadas;
-- de uno ya recibido solo ve lo que contó y si coincidió. Un envío recibido antes de 012 (sin conteo) se toma como recibido completo.
create function gorila_burgers._envio_json(p_id bigint, p_admin boolean) returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('id', e.id, 'numero', e.numero, 'estado', e.estado, 'nota', e.nota, 'creado', e.creado, 'quien', sc.nombre, 'recibido_en', e.recibido_en, 'recibido_por', sr.nombre,
    'anulado_en', e.anulado_en, 'anulado_motivo', e.anulado_motivo, 'con_diferencias', e.con_diferencias, 'recepcion_nota', e.recepcion_nota,
    'items', coalesce((select json_agg(json_build_object('insumo', i.clave, 'nombre', i.nombre, 'unidad', i.unidad,
        'cantidad', case when p_admin then t.cantidad end,
        'recibido', case when e.estado = 'recibido' then coalesce(r.recibido, t.cantidad) end,
        'diferencia', case when p_admin and e.estado = 'recibido' then coalesce(r.recibido, t.cantidad) - t.cantidad end,
        'coincide', case when e.estado = 'recibido' then coalesce(r.recibido, t.cantidad) = t.cantidad end) order by i.orden, i.nombre)
      from gorila_burgers.envio_items t join gorila_burgers.insumos i on i.clave = t.insumo left join gorila_burgers.envio_recepcion r on r.envio_id = t.envio_id and r.insumo = t.insumo where t.envio_id = e.id), '[]'::json))
  from gorila_burgers.envios e left join gorila_burgers.staff sc on sc.user_id = e.creado_por left join gorila_burgers.staff sr on sr.user_id = e.recibido_por where e.id = p_id $$;

create or replace function gorila_burgers.envios_lista(p_dias int default 14) returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Elige entre 1 y 90 días.'; end if;
  return coalesce((select json_agg(gorila_burgers._envio_json(x.id, gorila_burgers.es_admin()) order by (x.estado = 'enviado') desc, x.id desc)
    from (select id, estado from gorila_burgers.envios where estado = 'enviado' or creado > now() - make_interval(days => p_dias) order by id desc limit 80) x), '[]'::json);
end $$;

create or replace function gorila_burgers.envio_crear(p_items jsonb, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
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
  return gorila_burgers._envio_json(id_e, true);
end $$;

-- Recibir un envío CONTANDO: p_items = [{"insumo": "carne", "cantidad": 38}, …] con TODOS los insumos del envío (0 si no llegó). Una sola vez.
-- Si algo no coincide con lo enviado exige una nota; entra al inventario del local lo contado.
drop function gorila_burgers.envio_recibir(bigint);
create function gorila_burgers.envio_recibir(p_id bigint, p_items jsonb, p_nota text default null) returns json language plpgsql security definer set search_path = '' as $$
declare e gorila_burgers.envios; v_nota text := nullif(trim(coalesce(p_nota, '')), ''); dif boolean;
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  if length(coalesce(v_nota, '')) > 200 then raise exception 'La nota es muy larga.'; end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.insumos'));
  select * into e from gorila_burgers.envios where id = p_id for update;
  if not found then raise exception 'No existe ese envío.'; end if;
  if e.estado <> 'enviado' then raise exception 'Ese envío ya fue %.', case e.estado when 'recibido' then 'recibido' else 'anulado' end; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Cuenta lo que llegó de cada insumo.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where insumo is null or cantidad is null or cantidad < 0 or cantidad > 1000000) then
    raise exception 'Cada insumo lleva la cantidad que llegó (si no llegó, pon 0).';
  end if;
  if (select count(distinct x.insumo) from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric)) <> jsonb_array_length(p_items) then raise exception 'Un insumo está repetido.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where not exists (select 1 from gorila_burgers.envio_items t where t.envio_id = p_id and t.insumo = x.insumo)) then
    raise exception 'Uno de los insumos no pertenece a este envío.';
  end if;
  if exists (select 1 from gorila_burgers.envio_items t where t.envio_id = p_id and not exists (select 1 from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where x.insumo = t.insumo)) then
    raise exception 'Falta contar uno de los insumos del envío.';
  end if;
  dif := exists (select 1 from gorila_burgers.envio_items t join jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) on x.insumo = t.insumo where t.envio_id = p_id and x.cantidad <> t.cantidad);
  if dif and (v_nota is null or length(v_nota) < 3) then
    raise exception 'Lo que contaste no coincide con lo enviado. Cuenta de nuevo; si está bien, escribe una nota explicando la diferencia.';
  end if;
  update gorila_burgers.envios set estado = 'recibido', recibido_por = auth.uid(), recibido_en = now(), con_diferencias = dif, recepcion_nota = v_nota where id = p_id;
  insert into gorila_burgers.envio_recepcion (envio_id, insumo, recibido) select p_id, x.insumo, x.cantidad from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric);
  insert into gorila_burgers.insumo_mov (insumo, delta, motivo, staff_id, nota, envio_id)
    select x.insumo, x.cantidad, 'envio', auth.uid(), 'Recibido de bodega central (envío #' || e.numero || ')' || case when dif then ' con diferencias' else '' end, p_id
    from jsonb_to_recordset(p_items) as x (insumo text, cantidad numeric) where x.cantidad > 0;
  return gorila_burgers._envio_json(p_id, gorila_burgers.es_admin());
end $$;

drop function gorila_burgers._envio_json(bigint);

-- ---------- permisos (§4.3) ----------
revoke all on function gorila_burgers._envio_json(bigint, boolean), gorila_burgers.envios_lista(int), gorila_burgers.envio_crear(jsonb, text), gorila_burgers.envio_recibir(bigint, jsonb, text) from public, anon, authenticated;
grant execute on function gorila_burgers.envios_lista(int), gorila_burgers.envio_crear(jsonb, text), gorila_burgers.envio_recibir(bigint, jsonb, text) to authenticated;
