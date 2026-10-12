-- Módulo de restaurante · 006 datos de Gorila Burgers (generado por scripts/migraciones-modulo.py desde clientes/gorila-burgers/cliente.json).
-- Se puede volver a correr: actualiza nombre y precio sin duplicar. Los precios están en centavos.
-- Envío por confirmar: los sectores quedan en $0 y el costo se acuerda por WhatsApp. Cuando el cliente lo defina, el dueño los edita con sector_guardar().
insert into gorila_burgers.productos (clave, nombre, categoria, precio_cent, lema, ingredientes, foto, cuenta_burger, controla_stock, activo, orden) values
  ('texas', 'Gorila Texas + papas', 'vip', 790, 'La campeona que domina', '2 carnes, 2 quesos cheddar, tocino, cebollas empanizadas, salsa BBQ y salsa Kong', null, true, true, true, 0),
  ('superguesa', 'SuperGuesa + papas', 'vip', 790, 'Nivel bestia activado', null, null, true, true, true, 1),
  ('jam', 'Jam Smash', 'vip', 499, 'La que cambia el juego', '2 carnes smash, 2 quesos cheddar, cebollas caramelizadas y salsa smash', null, true, true, true, 2),
  ('hawayana', 'Hawayana + papas', 'especiales', 590, 'Dulce, atrevida y peligrosa', null, null, true, true, true, 3),
  ('tocino', 'Tocino BBQ + papas', 'especiales', 590, 'Puro fuego en cada mordida', 'Carne, queso cheddar, tocino, salsa BBQ, salsa Kong y vegetales', null, true, true, true, 4),
  ('cheese', 'Cheese Burger + papas', 'peques', 550, 'El clásico que nunca falla', 'Carne, queso cheddar, salsa Kong y vegetales', null, true, true, true, 5),
  ('mini', 'Mini Gorila + papas', 'peques', 490, 'Pequeña pero con carácter', 'Carne, salsa Kong y vegetales', null, true, true, true, 6),
  ('cbfries', 'Cheese Bacon Fries', 'papas', 450, null, null, null, false, false, true, 7),
  ('papas', 'Papas', 'papas', 150, null, null, null, false, false, true, 8),
  ('lemonsun', 'Lemon Sun', 'bebidas', 190, null, null, null, false, false, true, 9),
  ('redlemon', 'Red Lemon', 'bebidas', 190, null, null, null, false, false, true, 10),
  ('cerveza', 'Cerveza de Gorila', 'bebidas', 450, null, null, null, false, false, true, 11),
  ('x-carne', 'Carne', 'extras', 200, null, null, null, false, false, true, 12),
  ('x-queso', 'Queso', 'extras', 100, null, null, null, false, false, true, 13),
  ('x-tocino', 'Tocino', 'extras', 150, null, null, null, false, false, true, 14),
  ('x-crunch', 'Tocino crunch', 'extras', 150, null, null, null, false, false, true, 15),
  ('x-pina', 'Piña', 'extras', 150, null, null, null, false, false, true, 16),
  ('x-kong', 'Salsa Kong', 'extras', 100, null, null, null, false, false, true, 17),
  ('x-caram', 'Cebollas caramelizadas', 'extras', 100, null, null, null, false, false, true, 18),
  ('x-empan', 'Cebollas empanizadas', 'extras', 100, null, null, null, false, false, true, 19)
on conflict (clave) do update set nombre = excluded.nombre, categoria = excluded.categoria, precio_cent = excluded.precio_cent, lema = excluded.lema,
  ingredientes = excluded.ingredientes, foto = excluded.foto, cuenta_burger = excluded.cuenta_burger, controla_stock = excluded.controla_stock, orden = excluded.orden;

insert into gorila_burgers.sectores (nombre, costo_cent, orden) values
  ('FICOA', 0, 0),
  ('Atocha', 0, 1),
  ('Miraflores', 0, 2),
  ('Centro', 0, 3),
  ('Huachi', 0, 4),
  ('Izamba', 0, 5)
on conflict (nombre) do update set costo_cent = excluded.costo_cent, orden = excluded.orden;

-- Primer dueño: crea el usuario en Supabase › Authentication › Add user (con «Allow new users to sign up» DESACTIVADO, §4.10) y luego corre, con su correo:
--   insert into gorila_burgers.staff (user_id, nombre, rol) select id, 'Dueño', 'admin' from auth.users where lower(email) = lower('CORREO_DEL_DUEÑO');
-- Después el dueño da de alta a sus empleados desde la función equipo_guardar(correo, nombre, 'vendedor').
