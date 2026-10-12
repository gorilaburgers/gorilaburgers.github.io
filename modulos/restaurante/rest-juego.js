/* Gorila arriba · pantalla del juego (módulo adicional con premio). Dibuja el tablero del núcleo (rest-juego-nucleo.js), maneja el teclado y los botones táctiles
   y habla con la base: juego_estado → juego_iniciar (token del servidor) → juego_terminar (la base valida y entrega el código). Nada que otorgue valor se decide aquí (§4.5).
   Textos: RESTDATA.juego_txt (del cliente.json). Se monta en #juego-raiz. */
(() => {
  const raiz = document.getElementById('juego-raiz'), N = window.GorilaNucleo;
  if (!raiz || !N || !window.REST) return;
  const T = Object.assign({
    jugar: 'Jugar', lleva: 'Llega hasta la cerveza', regla: 'Esquiva las hamburguesas que bajan de la plancha. Solo 1 de cada 10 lo logra.', empezar: 'Empezar', nombre: 'Tu nombre', celular: 'Tu celular',
    privacidad: 'Usamos tu celular solo para tu premio y para limitar las partidas.', ganaste: '¡Llegaste a la cerveza!', perdiste: 'Te alcanzó una hamburguesa', otra: 'Intentar otra vez', cerrar: 'Volver',
    canje: 'Muestra este código en el local con tu compra (mínimo {min}) y la cerveza es tuya. Vale {dias} días.', wa: 'Avisar por WhatsApp', sin_cupo: 'Hoy ya se entregaron todos los premios. ¡Vuelve mañana!',
    brindis: '¡Brindis! Llegaste a la cerveza', mejor: 'Tu mejor marca: piso {n} de 5', pide: 'Armar mi pedido', mientras: 'Mientras esperas tu pedido, sube hasta la cerveza.',
    invalida: 'No pudimos validar tu partida. Inténtalo otra vez.', apagado: 'El juego no está disponible por ahora.', quedan: 'Te quedan {n} partidas hoy.', sube: '¡Sube!'
  }, window.RESTDATA.juego_txt || {});
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lee = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const plata = c => '$' + (c / 100).toFixed(2).replace('.', ',');
  const demo = REST.modo === 'demo', PREMIO = !!window.RESTDATA.juego_premio;   // sin premio: solo para pasar el rato, no pide datos ni toca la base
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const C = { bg: col('--fx-bg') || '#F3EFD5', deep: col('--fx-deep') || '#12324A', deep2: col('--fx-deep-2') || '#0A2234', acc: col('--fx-accent') || '#D39B67', line: col('--fx-line-deep') || '#295573' };
  let estado = null, sesion = lee('gorila_jugador') || {}, facil = false;

  /* ---------- dibujo ---------- */
  function sprite(ctx, g, ahora) {
    const j = g.j, x = j.x, y = j.y, f = Math.floor(j.paso * 6) % 2, trepa = j.estado === 'escalera';
    ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3); if (j.dir < 0 && !trepa) ctx.scale(-1, 1);
    ctx.fillStyle = '#1b2026';
    if (j.estado === 'salto') { ctx.fillRect(-5, -5, 4, 5); ctx.fillRect(1, -5, 4, 5); }
    else { ctx.fillRect(-5, f ? -5 : -4, 4, f ? 5 : 4); ctx.fillRect(1, f ? -4 : -5, 4, f ? 4 : 5); }
    ctx.fillRect(-6, -14, 12, 10);                                   // torso
    ctx.fillStyle = '#39424c'; ctx.fillRect(-3, -12, 6, 6);          // pecho
    ctx.fillStyle = '#1b2026';
    if (trepa || j.estado === 'salto') { ctx.fillRect(-9, f ? -20 : -17, 3, 9); ctx.fillRect(6, f ? -17 : -20, 3, 9); }
    else { ctx.fillRect(-9, f ? -13 : -11, 3, 9); ctx.fillRect(6, f ? -11 : -13, 3, 9); }
    ctx.fillRect(-5, -19, 10, 7);                                    // cabeza
    ctx.fillStyle = C.bg; ctx.fillRect(-3, -17, 6, 4);               // cara
    ctx.fillStyle = '#1b2026'; ctx.fillRect(-2, -16, 1.4, 1.6); ctx.fillRect(1, -16, 1.4, 1.6);
    ctx.restore();
  }
  function hamburguesa(ctx, b) {
    ctx.save(); ctx.translate(b.x, b.y - 8); ctx.scale(1.15, 1.15);
    ctx.rotate((b.x * 0.18) % (Math.PI * 2));
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(-7, -0.5, 14, 2);
    ctx.fillStyle = '#4a2412'; ctx.fillRect(-7, 1.5, 14, 3);
    ctx.fillStyle = C.acc; ctx.fillRect(-6.5, 4.5, 13, 2.5);
    ctx.restore();
  }
  function dibujar(ctx, g, t) {
    ctx.clearRect(0, 0, g.W, g.H);
    const fondo = ctx.createLinearGradient(0, 0, 0, g.H); fondo.addColorStop(0, C.deep); fondo.addColorStop(1, C.deep2); ctx.fillStyle = fondo; ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = C.line; for (let i = 0; i < 22; i++) ctx.fillRect((i * 97) % g.W, (i * 53) % g.H, 1.5, 1.5);
    for (const e of g.ESCALERAS) {   // escaleras
      const y0 = g.PISOS[e.a].y, y1 = g.PISOS[e.de].y; ctx.fillStyle = C.bg; ctx.fillRect(e.x - 8, y0, 2, y1 - y0); ctx.fillRect(e.x + 6, y0, 2, y1 - y0);
      for (let y = y0 + 6; y < y1; y += 9) ctx.fillRect(e.x - 8, y, 16, 2);
    }
    g.PISOS.forEach((p, i) => {      // pisos
      ctx.fillStyle = C.acc; ctx.fillRect(p.x0, p.y, p.x1 - p.x0, 6); ctx.fillStyle = '#7a4a1f'; ctx.fillRect(p.x0, p.y + 6, p.x1 - p.x0, 3);
      if (i === 4) { ctx.fillStyle = '#2a2f36'; ctx.fillRect(0, p.y - 20, 32, 20); ctx.fillStyle = '#e4572e'; ctx.fillRect(4, p.y - 24, 6, 4 + (Math.floor(t * 6) % 2)); ctx.fillRect(14, p.y - 22, 6, 3); }
    });
    const cv = g.CERVEZA;            // cerveza
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(cv.x - 7, cv.y - 20, 14, 20); ctx.fillStyle = '#fff6d8'; ctx.fillRect(cv.x - 8, cv.y - 24, 16, 5); ctx.fillRect(cv.x + 7, cv.y - 17, 5, 10);
    ctx.clearRect(cv.x + 9, cv.y - 14, 1.5, 4);
    ctx.fillStyle = C.bg; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', cv.x, cv.y - 28 + Math.sin(t * 4) * 1.5);
    g.burgers.forEach(b => hamburguesa(ctx, b));
    sprite(ctx, g, t);
    ctx.fillStyle = C.bg; ctx.font = '800 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.floor(g.t / 60) + ':' + String(Math.floor(g.t % 60)).padStart(2, '0'), 8, 18);
    ctx.textAlign = 'right'; ctx.fillText('Piso ' + (g.j.max + 1) + '/5', g.W - 8, 18);
  }
  function lienzo(contenedor) {
    const cv = document.createElement('canvas'); cv.width = N.W * 2; cv.height = N.H * 2; cv.className = 'jg-lienzo';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Tablero del juego: un gorila sube por cinco pisos esquivando hamburguesas hasta llegar a la cerveza.');
    contenedor.appendChild(cv); const ctx = cv.getContext('2d'); ctx.scale(2, 2); return { cv, ctx };
  }

  /* ---------- pantallas ---------- */
  function portada() {
    document.body.classList.remove('jg-jugando');
    raiz.innerHTML = `<div class="jg-tarjeta"><div class="jg-vista"></div><div class="jg-texto">
      <h3>${esc(T.lleva)}</h3><p>${esc(T.regla)}</p>
      ${PREMIO ? `<ul class="jg-lista"><li>${esc(estado ? estado.premio : '')}</li></ul>` : (lee('gorila_mejor') ? `<p class="jg-nota">${esc(T.mejor.replace('{n}', lee('gorila_mejor')))}</p>` : '')}
      <button type="button" class="btn jg-ir" id="jg-jugar">${esc(T.jugar)}</button>
      ${demo ? '<label class="jg-facil"><input type="checkbox" id="jg-facil"> Modo fácil (solo en la demo, para ver cómo se gana)</label>' : ''}</div></div>`;
    const { ctx } = lienzo(raiz.querySelector('.jg-vista')), g = N.crear({ semilla: 5 }); for (let i = 0; i < 60 * 5; i++) g.paso(1 / 60); dibujar(ctx, g, 0.4);
    raiz.querySelector('#jg-jugar').onclick = PREMIO ? registro : () => jugar({ semilla: Math.floor(Math.random() * 2147483646) + 1, dificultad: 1, token: null });
    const fa = raiz.querySelector('#jg-facil'); if (fa) fa.onchange = () => { facil = fa.checked; };
    if (estado && !estado.activo) { raiz.querySelector('#jg-jugar').disabled = true; raiz.querySelector('.jg-texto p').textContent = T.apagado; }
  }
  function registro(msg) {
    raiz.innerHTML = `<form class="jg-tarjeta jg-form" novalidate><div class="jg-texto"><h3>${esc(T.lleva)}</h3>
      <label class="pd-campo"><span>${esc(T.nombre)}</span><input name="nombre" autocomplete="given-name" maxlength="60" value="${esc(sesion.nombre || '')}" required></label>
      <label class="pd-campo"><span>${esc(T.celular)}</span><input name="celular" inputmode="tel" autocomplete="tel" maxlength="14" placeholder="09XXXXXXXX" value="${esc(sesion.celular || '')}" required></label>
      <p class="jg-nota">${esc(T.privacidad)}</p><p class="jg-error" role="alert">${typeof msg === 'string' ? esc(msg) : ''}</p>
      <button class="btn jg-ir" type="submit">${esc(T.empezar)}</button> <button class="enlace" type="button" id="jg-atras">${esc(T.cerrar)}</button></div></form>`;
    const f = raiz.querySelector('form'); raiz.querySelector('#jg-atras').onclick = portada;
    f.onsubmit = async e => {
      e.preventDefault(); const nombre = f.nombre.value.trim(), celular = f.celular.value.trim(), err = f.querySelector('.jg-error'), b = f.querySelector('.jg-ir');
      err.textContent = ''; b.disabled = true;
      try { const p = await REST.rpc('juego_iniciar', { p_nombre: nombre, p_telefono: celular }); sesion = { nombre, celular }; guarda('gorila_jugador', sesion); jugar(p); }
      catch (x) { err.textContent = x.message; b.disabled = false; }
    };
    f.nombre.focus({ preventScroll: true });
  }
  function jugar(p) {
    raiz.innerHTML = `<div class="jg-juego"><div class="jg-vista"></div><div class="jg-cuenta" aria-live="assertive"></div>
      <div class="jg-mando" aria-label="Controles"><div class="jg-dir"><button type="button" data-k="izq" aria-label="Izquierda">◀</button><button type="button" data-k="der" aria-label="Derecha">▶</button></div>
      <div class="jg-acc"><button type="button" data-k="arriba" aria-label="Subir escalera">▲</button><button type="button" data-k="abajo" aria-label="Bajar escalera">▼</button><button type="button" class="jg-salto" data-k="salto">Saltar</button></div></div>
      <p class="jg-nota">Teclado: flechas o A D W S para moverte y espacio para saltar.</p></div>`;
    const { ctx } = lienzo(raiz.querySelector('.jg-vista')), cuenta = raiz.querySelector('.jg-cuenta');
    const g = N.crear({ semilla: p.semilla, dificultad: p.dificultad, parametros: demo && facil ? { vel: 40, intervalo: 3.4, pEscalera: 0 } : null });
    const teclas = { ArrowLeft: 'izq', a: 'izq', A: 'izq', ArrowRight: 'der', d: 'der', D: 'der', ArrowUp: 'arriba', w: 'arriba', W: 'arriba', ArrowDown: 'abajo', s: 'abajo', S: 'abajo' };
    const poner = (k, v) => { if (k === 'salto') { if (v) g.saltar(); } else g.entrada[k] = v; };
    let activo = true, previo = performance.now(), acum = 0, t0 = previo, fin = false;
    const kd = e => { const k = teclas[e.key]; if (k) { poner(k, true); e.preventDefault(); } else if (e.key === ' ' || e.key === 'Enter') { poner('salto', true); e.preventDefault(); } };
    const ku = e => { const k = teclas[e.key]; if (k) poner(k, false); };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    raiz.querySelectorAll('.jg-mando button').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } poner(b.dataset.k, true); b.classList.add('on'); });
      const suelta = () => { poner(b.dataset.k, false); b.classList.remove('on'); };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, suelta));
    });
    raiz.scrollIntoView({ block: 'center', behavior: 'smooth' });
    document.body.classList.add('jg-jugando');
    const salir = () => { activo = false; document.body.classList.remove('jg-jugando'); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
    const cierra = async () => {
      if (fin) return; fin = true; salir();
      await new Promise(r => setTimeout(r, 650));
      if (!PREMIO) {   // solo para pasar el rato: se guarda la mejor marca en este celular y se muestra el resultado
        const piso = g.j.max + 1; const mejor = lee('gorila_mejor') || 0; if (piso > mejor) guarda('gorila_mejor', piso);
        resultado({ resultado: g.resultado === 'gano' ? 'brindis' : 'perdio', piso }, p); return;
      }
      try { resultado(await REST.rpc('juego_terminar', { p_token: p.token, p_gano: g.resultado === 'gano', p_hitos: g.resultado === 'gano' ? g.hitos : null }), p); }
      catch (x) { resultado({ resultado: 'error', mensaje: x.message }, p); }
    };
    function ciclo(ahora) {
      if (!activo) return;
      const seg = (ahora - t0) / 1000;
      if (seg < 3) { cuenta.textContent = String(3 - Math.floor(seg)); previo = ahora; dibujar(ctx, g, ahora / 1000); requestAnimationFrame(ciclo); return; }
      if (seg < 3.7) cuenta.textContent = T.sube; else cuenta.textContent = '';
      acum += Math.min(0.1, (ahora - previo) / 1000); previo = ahora;
      while (acum >= 1 / 60 && !g.resultado) { g.paso(1 / 60); acum -= 1 / 60; }
      dibujar(ctx, g, ahora / 1000);
      if (g.resultado) { raiz.querySelector('.jg-vista').classList.add(g.resultado === 'gano' ? 'jg-gana' : 'jg-pierde'); cierra(); return; }
      requestAnimationFrame(ciclo);
    }
    requestAnimationFrame(ciclo);
  }
  function resultado(r, p) {
    const quedan = Math.max(0, (p.partidas_restantes || 0));
    let cuerpo;
    if (r.resultado === 'brindis') cuerpo = `<h3>${esc(T.brindis)}</h3><p>${esc(T.mientras)}</p><a class="btn jg-ir" href="#carta">${esc(T.pide)}</a>`;
    else if (!PREMIO && r.resultado === 'perdio') cuerpo = `<h3>${esc(T.perdiste)}</h3><p>Llegaste al piso ${r.piso} de 5.</p>`;
    else if (r.resultado === 'gano') {
      const num = window.DEMO && window.DEMO.waCliente, min = plata(estado && estado.compra_min_cent != null ? estado.compra_min_cent : 500);
      const txt = encodeURIComponent(`Hola Gorila, gané la ${r.premio} jugando en la web. Mi código es ${r.codigo} (${sesion.nombre || ''}).`);
      cuerpo = `<h3>${esc(T.ganaste)}</h3><p class="jg-premio">${esc(r.premio)}</p><p class="jg-codigo" aria-label="Tu código">${esc(r.codigo)}</p>
        <p>${esc(T.canje.replace('{min}', min).replace('{dias}', (estado && estado.vigencia_dias) || 7))}</p>
        ${num ? `<a class="btn jg-ir" href="https://wa.me/${esc(num)}?text=${txt}" target="_blank" rel="noopener">${esc(T.wa)}</a>` : ''}`;
    } else if (r.resultado === 'gano_sin_cupo') cuerpo = `<h3>${esc(T.ganaste)}</h3><p>${esc(T.sin_cupo)}</p>`;
    else if (r.resultado === 'invalido') cuerpo = `<h3>${esc(T.perdiste)}</h3><p>${esc(T.invalida)}</p>`;
    else if (r.resultado === 'error') cuerpo = `<h3>${esc(T.perdiste)}</h3><p>${esc(r.mensaje)}</p>`;
    else cuerpo = `<h3>${esc(T.perdiste)}</h3><p>${quedan ? esc(T.quedan.replace('{n}', quedan)) : ''}</p>`;
    const otra = !PREMIO ? `<button type="button" class="btn jg-ir" id="jg-otra">${esc(T.otra)}</button>` : r.resultado === 'gano' || (r.resultado !== 'gano_sin_cupo' && quedan === 0 && r.resultado !== 'error') ? '' : `<button type="button" class="btn jg-ir" id="jg-otra">${esc(T.otra)}</button>`;
    raiz.innerHTML = `<div class="jg-tarjeta jg-fin"><div class="jg-texto" role="status">${cuerpo}${otra}<button type="button" class="enlace" id="jg-volver">${esc(T.cerrar)}</button></div></div>`;
    const o = raiz.querySelector('#jg-otra'); if (o) o.onclick = () => PREMIO ? registro() : portada();
    raiz.querySelector('#jg-volver').onclick = portada;
  }

  if (PREMIO) REST.rpc('juego_estado').then(e => { estado = e; portada(); }).catch(() => { estado = { activo: false, premio: '' }; portada(); });
  else { estado = { activo: true, premio: '' }; portada(); }
})();
