/* Service worker mínimo de la pantalla de ventas (caja): hace que el navegador permita instalarla como app. No guarda nada en caché a propósito:
   los precios, el stock y las ventas siempre salen de la base, y así nunca se ve una versión vieja de la pantalla. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
