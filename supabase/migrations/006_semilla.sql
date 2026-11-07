-- Módulo de restaurante · 006 datos de Gorila Burgers (generado por scripts/migraciones-modulo.py desde clientes/gorila-burgers/cliente.json).
-- Se puede volver a correr: actualiza nombre y precio sin duplicar. Los precios están en centavos.

insert into gorila_burgers.productos (clave, nombre, categoria, precio_cent, lema, ingredientes, foto, cuenta_burger, controla_stock, activo, orden) values
  ('texas', 'Gorila Texas + papas', 'vip', 790, 'La campeona que domina', '2 carnes, 2 quesos cheddar, tocino, cebollas empanizadas, salsa BBQ y salsa Kong', null, true, true, true, 0),
  ('superguesa', 'SuperGuesa + papas', 'vip', 790, 'Nivel bestia activado', '3 carnes, 2 quesos cheddar, tocino, cebolla, lechuga, tomate, mayonesa y salsa Kong', null, true, true, true, 1),
  ('jam', 'Jam Smash', 'vip', 499, 'La que cambia el juego', '2 carnes smash, 2 quesos cheddar, cebollas caramelizadas y salsa Jam', null, true, true, true, 2),
  ('molotov', 'Molotov + papas', 'vip', 1000, null, '2 carnes, 2 quesos holandés, carne mechada, jalapeño con tocino y mayonesa', null, true, true, true, 3),
  ('beast', 'The Beast + papas', 'vip', 1000, null, '4 carnes, 2 quesos cheddar, 2 tocinos, huevo, cebolla, lechuga, tomate, mayonesa y salsa Kong', null, true, true, true, 4),
  ('pigfloyd', 'Pig Floyd + papas', 'vip', 1000, 'Hamburguesa de temporada', '2 carnes, 2 quesos cheddar, pulled pork, 2 tocinos, chicharrón, mayonesa y salsa Kong', null, true, true, true, 5),
  ('hawayana', 'Hawayana + papas', 'especiales', 590, 'Dulce, atrevida y peligrosa', 'Carne, queso cheddar, piña a la plancha, cebolla, lechuga, tomate, mayonesa y salsa Kong', null, true, true, true, 6),
  ('tocino', 'Tocino BBQ + papas', 'especiales', 590, 'Puro fuego en cada mordida', 'Carne, queso cheddar, tocino, salsa BBQ, salsa Kong y vegetales', null, true, true, true, 7),
  ('cheese', 'Cheese Burger + papas', 'peques', 550, 'El clásico que nunca falla', 'Carne, queso cheddar, salsa Kong y vegetales', null, true, true, true, 8),
  ('mini', 'Mini Gorila + papas', 'peques', 490, 'Pequeña pero con carácter', 'Carne, salsa Kong y vegetales', null, true, true, true, 9),
  ('cbfries', 'Cheese Bacon Fries', 'papas', 450, null, null, null, false, false, true, 10),
  ('papas', 'Papas', 'papas', 150, null, null, null, false, false, true, 11),
  ('lemonsun', 'Lemon Sun', 'bebidas', 190, null, null, null, false, false, true, 12),
  ('redlemon', 'Red Lemon', 'bebidas', 190, null, null, null, false, false, true, 13),
  ('cerveza', 'Cerveza de Gorila', 'bebidas', 450, null, null, null, false, false, true, 14),
  ('x-carne', 'Carne', 'extras', 200, null, null, null, false, false, true, 15),
  ('x-queso', 'Queso', 'extras', 100, null, null, null, false, false, true, 16),
  ('x-tocino', 'Tocino', 'extras', 150, null, null, null, false, false, true, 17),
  ('x-crunch', 'Tocino crunch', 'extras', 150, null, null, null, false, false, true, 18),
  ('x-pina', 'Piña', 'extras', 150, null, null, null, false, false, true, 19),
  ('x-kong', 'Salsa Kong', 'extras', 100, null, null, null, false, false, true, 20),
  ('x-caram', 'Cebollas caramelizadas', 'extras', 100, null, null, null, false, false, true, 21),
  ('x-empan', 'Cebollas empanizadas', 'extras', 100, null, null, null, false, false, true, 22)
on conflict (clave) do update set nombre = excluded.nombre, categoria = excluded.categoria, precio_cent = excluded.precio_cent, lema = excluded.lema,
  ingredientes = excluded.ingredientes, foto = excluded.foto, cuenta_burger = excluded.cuenta_burger, controla_stock = excluded.controla_stock, orden = excluded.orden;

insert into gorila_burgers.sectores (nombre, costo_cent, orden) values
  ('FICOA', 200, 0),
  ('Atocha', 200, 1),
  ('Miraflores', 200, 2),
  ('Centro', 200, 3),
  ('Huachi', 200, 4),
  ('Izamba', 200, 5)
on conflict (nombre) do update set costo_cent = excluded.costo_cent, orden = excluded.orden;

-- Primer dueño: crea el usuario en Supabase › Authentication › Add user (con «Allow new users to sign up» DESACTIVADO, §4.10) y luego corre, con su correo:
--   insert into gorila_burgers.staff (user_id, nombre, rol) select id, 'Dueño', 'admin' from auth.users where lower(email) = lower('CORREO_DEL_DUEÑO');
-- Después el dueño da de alta a sus empleados desde la función equipo_guardar(correo, nombre, 'vendedor').
