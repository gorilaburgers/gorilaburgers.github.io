-- Módulo de restaurante · 007 mini juego con premio («Gorila arriba», módulo adicional).
-- El gorila sube por las plataformas esquivando hamburguesas y, si llega a la cerveza, gana un código. El premio vale dinero, así que TODO lo que
-- otorga valor se decide aquí y no en el navegador (§4.5). Qué hace la base y qué NO puede hacer:
--  * La partida nace en el servidor: token de un solo uso (solo se guarda su hash), con vencimiento. El navegador no inventa partidas (§4.7).
--  * Límites por teléfono y día, por hora en total y premios máximos por día (§4.8): aunque alguien falsifique el resultado, el costo diario queda acotado.
--  * Una victoria solo es válida si el tiempo medido POR EL SERVIDOR y los hitos por piso son físicamente posibles. La base no puede repetir la partida
--    (el juego corre en el navegador): por eso el tope de premios y el canje son la defensa de fondo, no el control del navegador.
--  * El premio es un código. Lo canjea el personal contra una venta real y confirmada de hoy (§3: «compra real previa del ganador y canje validado por el personal»);
--    cada venta sirve para un solo canje.
-- Va después de 006 (semilla del cliente). Se aplica con scripts/migraciones-modulo.py restaurante <cliente>.

create table gorila_burgers.juego_config (
  id int primary key default 1 check (id = 1),
  activo boolean not null default true,
  premio text not null default 'Cerveza de Gorila' check (length(trim(premio)) between 2 and 60),
  premios_dia_max int not null default 3 check (premios_dia_max between 0 and 100),          -- tope de premios entregables por día
  partidas_dia_tel int not null default 3 check (partidas_dia_tel between 1 and 20),         -- partidas por teléfono y día
  partidas_hora int not null default 200 check (partidas_hora between 10 and 5000),           -- partidas por hora en total
  dificultad numeric(3, 2) not null default 1.00 check (dificultad between 0.50 and 1.50),    -- 1.0 = pensada para que gane ~1 de cada 10; sube = más difícil
  vigencia_dias int not null default 7 check (vigencia_dias between 1 and 60),                 -- días para canjear el código
  compra_min_cent int not null default 500 check (compra_min_cent between 0 and 100000),     -- compra mínima del día para canjear
  min_seg_victoria int not null default 20 check (min_seg_victoria between 5 and 300)         -- una victoria en menos segundos que esto es imposible
);
insert into gorila_burgers.juego_config default values;

create table gorila_burgers.juego_partidas (
  id bigint generated always as identity primary key,
  token_hash text not null unique,                       -- sha256 del token (el token en claro solo lo tiene quien juega)
  dia date not null default ((now() at time zone 'America/Guayaquil')::date),
  telefono text not null check (telefono ~ '^593[0-9]{9}$'),
  nombre text not null check (length(trim(nombre)) between 2 and 60),
  creada timestamptz not null default now(),
  terminada timestamptz,
  resultado text check (resultado in ('perdio', 'gano', 'gano_sin_cupo', 'invalido')),
  segundos numeric(7, 2)
);
create index juego_partidas_tel_idx on gorila_burgers.juego_partidas (telefono, dia);
create index juego_partidas_hora_idx on gorila_burgers.juego_partidas (creada);

create table gorila_burgers.juego_premios (
  id bigint generated always as identity primary key,
  partida_id bigint not null unique references gorila_burgers.juego_partidas (id),
  dia date not null default ((now() at time zone 'America/Guayaquil')::date),
  telefono text not null check (telefono ~ '^593[0-9]{9}$'),
  nombre text not null,
  premio text not null,
  codigo text not null unique check (codigo ~ '^G[A-Z2-9]{5}$'),
  creado timestamptz not null default now(),
  vence timestamptz not null,
  canjeado_por uuid references auth.users (id) on delete set null,
  canjeado_en timestamptz,
  venta_id bigint unique references gorila_burgers.ventas (id)  -- la venta real que respalda el canje: una venta, un canje
);
create index juego_premios_dia_idx on gorila_burgers.juego_premios (dia);
create index juego_premios_tel_idx on gorila_burgers.juego_premios (telefono, dia);

-- Una partida solo se completa una vez; un premio solo pasa de «pendiente» a «canjeado» una vez. Nunca se borran (§4.9).
create function gorila_burgers._juego_inmutable() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Estos registros no se borran.'; end if;
  if tg_table_name = 'juego_partidas' then
    if old.terminada is not null or new.token_hash <> old.token_hash or new.telefono <> old.telefono or new.creada <> old.creada then
      raise exception 'La partida ya terminó.';
    end if;
  else
    if old.canjeado_en is not null or new.codigo <> old.codigo or new.telefono <> old.telefono or new.creado <> old.creado or new.vence <> old.vence then
      raise exception 'El premio ya fue canjeado o no se puede cambiar.';
    end if;
  end if;
  return new;
end $$;
create trigger juego_partidas_inmutable before update or delete on gorila_burgers.juego_partidas for each row execute function gorila_burgers._juego_inmutable();
create trigger juego_premios_inmutable before update or delete on gorila_burgers.juego_premios for each row execute function gorila_burgers._juego_inmutable();

alter table gorila_burgers.juego_config enable row level security;
alter table gorila_burgers.juego_partidas enable row level security;
alter table gorila_burgers.juego_premios enable row level security;

-- ---------- público (anon) ----------

-- Lo que la página necesita para mostrar el juego. Sin datos de nadie.
create function gorila_burgers.juego_estado() returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('activo', c.activo, 'premio', c.premio, 'dificultad', c.dificultad, 'vigencia_dias', c.vigencia_dias, 'compra_min_cent', c.compra_min_cent,
    'hay_cupo', (select count(*) from gorila_burgers.juego_premios where dia = gorila_burgers.hoy_ec()) < c.premios_dia_max)
  from gorila_burgers.juego_config c where c.id = 1 $$;

-- Abre una partida. Devuelve el token (único, solo aquí se ve en claro) y la semilla del tablero.
create function gorila_burgers.juego_iniciar(p_nombre text, p_telefono text) returns json language plpgsql security definer set search_path = '' as $$
declare c gorila_burgers.juego_config; t text := gorila_burgers.tel(p_telefono); tok text; hoy date := gorila_burgers.hoy_ec();
begin
  select * into c from gorila_burgers.juego_config where id = 1;
  if not c.activo then raise exception 'El juego no está disponible por ahora.'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 or length(p_nombre) > 60 then raise exception 'Escribe tu nombre.'; end if;
  if t = '' then raise exception 'Escribe un celular válido (09XXXXXXXX).'; end if;
  if exists (select 1 from gorila_burgers.juego_premios where telefono = t and dia = hoy) then
    raise exception 'Hoy ya ganaste tu premio. Canjéalo en el local y vuelve mañana.';
  end if;
  if (select count(*) from gorila_burgers.juego_partidas where telefono = t and dia = hoy) >= c.partidas_dia_tel then
    raise exception 'Hoy ya usaste tus % partidas. Vuelve mañana.', c.partidas_dia_tel;
  end if;
  if (select count(*) from gorila_burgers.juego_partidas where creada > now() - interval '1 hour') >= c.partidas_hora then
    raise exception 'Hay mucha gente jugando. Inténtalo en unos minutos.';
  end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into gorila_burgers.juego_partidas (token_hash, telefono, nombre) values (encode(sha256(convert_to(tok, 'UTF8')), 'hex'), t, trim(p_nombre));
  return json_build_object('token', tok, 'semilla', floor(random() * 2147483646)::int + 1, 'dificultad', c.dificultad,
    'partidas_restantes', c.partidas_dia_tel - (select count(*) from gorila_burgers.juego_partidas where telefono = t and dia = hoy)::int);
end $$;

-- Cierra la partida. p_hitos = segundos (desde que empezó a moverse) en que el gorila pisó cada piso y tocó la cerveza (5 números crecientes).
create function gorila_burgers.juego_terminar(p_token text, p_gano boolean, p_hitos jsonb default null) returns json language plpgsql security definer set search_path = '' as $$
declare
  c gorila_burgers.juego_config; p gorila_burgers.juego_partidas; seg numeric; ok boolean := true; ant numeric := 0; h numeric; i int;
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; cod text; n int := 0; res text; v timestamptz; hoy date := gorila_burgers.hoy_ec();
begin
  select * into c from gorila_burgers.juego_config where id = 1;
  select * into p from gorila_burgers.juego_partidas where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') for update;
  if not found or p.terminada is not null then raise exception 'Esta partida ya no es válida.'; end if;
  seg := round(extract(epoch from (now() - p.creada))::numeric, 2);
  if seg > 600 then
    update gorila_burgers.juego_partidas set terminada = now(), resultado = 'invalido', segundos = least(seg, 99999) where id = p.id;
    raise exception 'Esta partida venció.';
  end if;
  if not coalesce(p_gano, false) then
    update gorila_burgers.juego_partidas set terminada = now(), resultado = 'perdio', segundos = seg where id = p.id;
    return json_build_object('resultado', 'perdio');
  end if;
  -- Victoria: tiempo del servidor y hitos plausibles (no se puede subir un piso en menos de 2 s).
  if seg < c.min_seg_victoria or p_hitos is null or jsonb_typeof(p_hitos) <> 'array' or jsonb_array_length(p_hitos) <> 5 then ok := false;
  else
    for i in 0..4 loop
      begin h := (p_hitos ->> i)::numeric; exception when others then ok := false; exit; end;
      if h is null or h - ant < 2 then ok := false; exit; end if;
      ant := h;
    end loop;
    if ok and ant > seg + 3 then ok := false; end if;    -- no puede haber tardado más en el juego que en el reloj del servidor
  end if;
  if not ok then
    update gorila_burgers.juego_partidas set terminada = now(), resultado = 'invalido', segundos = seg where id = p.id;
    return json_build_object('resultado', 'invalido');
  end if;
  perform pg_advisory_xact_lock(hashtext('gorila_burgers.juego_premios'));      -- el tope diario no se rebasa con partidas simultáneas
  if (select count(*) from gorila_burgers.juego_premios where dia = hoy) >= c.premios_dia_max
     or exists (select 1 from gorila_burgers.juego_premios where telefono = p.telefono and dia = hoy) then
    update gorila_burgers.juego_partidas set terminada = now(), resultado = 'gano_sin_cupo', segundos = seg where id = p.id;
    return json_build_object('resultado', 'gano_sin_cupo');
  end if;
  loop
    cod := 'G'; for i in 1..5 loop cod := cod || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1); end loop;
    exit when not exists (select 1 from gorila_burgers.juego_premios where codigo = cod);
    n := n + 1; if n > 20 then raise exception 'No se pudo generar el código. Inténtalo otra vez.'; end if;
  end loop;
  v := now() + make_interval(days => c.vigencia_dias);
  update gorila_burgers.juego_partidas set terminada = now(), resultado = 'gano', segundos = seg where id = p.id;
  insert into gorila_burgers.juego_premios (partida_id, telefono, nombre, premio, codigo, vence) values (p.id, p.telefono, p.nombre, c.premio, cod, v);
  return json_build_object('resultado', 'gano', 'codigo', cod, 'premio', c.premio, 'vence', v);
end $$;

-- ---------- personal ----------

-- Canje: el empleado ingresa el código y el número de la venta de hoy que lo respalda (compra real, confirmada, del monto mínimo).
create function gorila_burgers.juego_canjear(p_codigo text, p_numero_venta int) returns json language plpgsql security definer set search_path = '' as $$
declare c gorila_burgers.juego_config; r gorila_burgers.juego_premios; v gorila_burgers.ventas; cod text := upper(trim(coalesce(p_codigo, '')));
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  select * into c from gorila_burgers.juego_config where id = 1;
  select * into r from gorila_burgers.juego_premios where codigo = cod for update;
  if not found then raise exception 'Ese código no existe.'; end if;
  if r.canjeado_en is not null then raise exception 'Ese código ya se canjeó.'; end if;
  if r.vence < now() then raise exception 'Ese código venció.'; end if;
  select * into v from gorila_burgers.ventas where dia = gorila_burgers.hoy_ec() and numero = p_numero_venta;
  if not found or v.estado <> 'confirmada' then raise exception 'La venta #% de hoy no existe o no está confirmada.', p_numero_venta; end if;
  if v.total_cent < c.compra_min_cent then raise exception 'La compra debe ser de al menos $%.', to_char(c.compra_min_cent / 100.0, 'FM990.00'); end if;
  if exists (select 1 from gorila_burgers.juego_premios where venta_id = v.id) then raise exception 'Esa venta ya respaldó otro canje.'; end if;
  update gorila_burgers.juego_premios set canjeado_por = auth.uid(), canjeado_en = now(), venta_id = v.id where id = r.id;
  return json_build_object('premio', r.premio, 'nombre', r.nombre, 'venta', v.numero);
end $$;

-- Consulta un código sin canjearlo (para que el empleado vea a quién y qué entrega).
create function gorila_burgers.juego_codigo(p_codigo text) returns json language plpgsql stable security definer set search_path = '' as $$
declare r gorila_burgers.juego_premios;
begin
  if not gorila_burgers.es_staff() then raise exception 'Solo el personal.'; end if;
  select * into r from gorila_burgers.juego_premios where codigo = upper(trim(coalesce(p_codigo, '')));
  if not found then raise exception 'Ese código no existe.'; end if;
  return json_build_object('premio', r.premio, 'nombre', r.nombre, 'telefono_fin', right(r.telefono, 4), 'creado', r.creado, 'vence', r.vence,
    'estado', case when r.canjeado_en is not null then 'canjeado' when r.vence < now() then 'vencido' else 'pendiente' end);
end $$;

-- ---------- dueño ----------

create function gorila_burgers.juego_resumen() returns json language plpgsql stable security definer set search_path = '' as $$
declare c gorila_burgers.juego_config; hoy date := gorila_burgers.hoy_ec();
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  select * into c from gorila_burgers.juego_config where id = 1;
  return json_build_object(
    'activo', c.activo, 'premio', c.premio, 'premios_dia_max', c.premios_dia_max, 'dificultad', c.dificultad,
    'hoy', json_build_object(
      'partidas', (select count(*) from gorila_burgers.juego_partidas where dia = hoy and terminada is not null),
      'ganadores', (select count(*) from gorila_burgers.juego_premios where dia = hoy),
      'canjeados', (select count(*) from gorila_burgers.juego_premios where dia = hoy and canjeado_en is not null)),
    'semana', json_build_object(
      'partidas', (select count(*) from gorila_burgers.juego_partidas where dia > hoy - 7 and terminada is not null),
      'ganadores', (select count(*) from gorila_burgers.juego_premios where dia > hoy - 7),
      'invalidas', (select count(*) from gorila_burgers.juego_partidas where dia > hoy - 7 and resultado = 'invalido')),
    'pendientes', coalesce((select json_agg(json_build_object('codigo', codigo, 'nombre', nombre, 'creado', creado, 'vence', vence) order by creado desc)
       from gorila_burgers.juego_premios where canjeado_en is null and vence > now()), '[]'::json));
end $$;

create function gorila_burgers.juego_config_guardar(p_activo boolean, p_premio text, p_premios_dia int, p_dificultad numeric) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not gorila_burgers.es_admin() then raise exception 'Solo el dueño.'; end if;
  update gorila_burgers.juego_config set activo = coalesce(p_activo, activo), premio = coalesce(nullif(trim(p_premio), ''), premio),
    premios_dia_max = coalesce(p_premios_dia, premios_dia_max), dificultad = coalesce(p_dificultad, dificultad) where id = 1;
end $$;

-- ---------- permisos (§4.3) ----------
revoke all on all functions in schema gorila_burgers from public, anon, authenticated;
grant execute on function gorila_burgers.juego_estado(), gorila_burgers.juego_iniciar(text, text), gorila_burgers.juego_terminar(text, boolean, jsonb) to anon, authenticated;
grant execute on function gorila_burgers.juego_canjear(text, int), gorila_burgers.juego_codigo(text), gorila_burgers.juego_resumen(),
  gorila_burgers.juego_config_guardar(boolean, text, int, numeric) to authenticated;
-- Este revoke deja la base como estaba en 005: vuelve a conceder lo anterior.
grant execute on function gorila_burgers.ping(), gorila_burgers.carta(), gorila_burgers.contador(),
  gorila_burgers.pedido_crear(text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
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
