/* Gorila al volante · mini juego en primera persona (módulo adicional, sin premio ni base de datos). Corre en #juego-raiz y reutiliza los estilos .jg-* de rest-juego.css.
   Un gorila maneja un jeep clásico; la ciudad es de caricatura: los peatones salen volando con un «¡PUM!» (sin sangre) y cada uno suma puntos, con combo.
   Solo lo que se ve: carretera en falsa perspectiva, peatones dibujados por código, capó y volante del jeep. ~40 s por partida; la mejor marca queda en el celular. */
(() => {
  const raiz = document.getElementById('juego-raiz');
  if (!raiz) return;
  const T = Object.assign({ jugar: 'Manejar', lleva: 'Maneja el jeep del Gorila', regla: 'Cada peatón de caricatura que choques suma puntos, y los combos los multiplican. Tienes 40 segundos.',
    fin: '¡Se acabó el tiempo!', puntos: 'Puntos', mejor: 'Tu mejor marca', otra: 'Manejar otra vez', pide: 'Armar mi pedido', nuevo: '¡Nuevo récord!', mando: 'Desliza la barra (o el dedo sobre el juego) para girar. En computador: flechas o A y D.' }, window.RESTDATA && window.RESTDATA.juego_txt || {});
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lee = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const C = { bg: col('--fx-bg') || '#F3EFD5', deep: col('--fx-deep') || '#12324A', acc: col('--fx-accent') || '#D39B67' };
  const W = 360, H = 480, HOR = 170, DURACION = 40;
  const TIPOS = [{ n: 'Turista', pts: 10, ropa: '#e4572e', alto: 1 }, { n: 'Rockero', pts: 25, ropa: '#2a2f36', alto: 1.05 }, { n: 'Ciclista', pts: 40, ropa: '#2fb36b', alto: 0.9 }, { n: 'Chef', pts: 60, ropa: '#f4f1e8', alto: 1.1 }];
  const CARRITO = { n: 'Carrito', pts: 100, alto: 1 };
  let fin = () => {};
  const logo = new Image(); logo.src = 'assets/logo.webp';   // el logo de Gorila va en el capó

  function portada() {
    const mejor = lee('gorila_jeep_mejor');
    raiz.innerHTML = `<div class="jg-tarjeta"><div class="jg-vista"></div><div class="jg-texto"><h3>${esc(T.lleva)}</h3><p>${esc(T.regla)}</p>
      ${mejor ? `<p class="jg-nota">${esc(T.mejor)}: ${mejor}</p>` : ''}<button type="button" class="btn jg-ir" id="jg-jugar">${esc(T.jugar)}</button></div></div>`;
    const cv = lienzo(raiz.querySelector('.jg-vista')); dibujar(cv.ctx, estadoInicial(), 0);
    raiz.querySelector('#jg-jugar').onclick = () => intro(() => partida());
  }
  function lienzo(cont) {
    const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 2)), cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr; cv.className = 'jg-lienzo';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Juego: un gorila maneja un jeep clásico y se lleva por delante a peatones de caricatura para sumar puntos.');
    cont.appendChild(cv); const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; return { cv, ctx };
  }
  const estadoInicial = () => ({ t: 0, x: 0, giro: 0, dist: 0, vel: 1, puntos: 0, combo: 1, comboT: 0, gente: [], popups: [], parts: [], sacude: 0, sig: 0.9, fade: 1, final: null, rem: 0, beb: null, proxBeb: 3.2, salud: false, props: [], sigP: 0, nP: 0, mostrado: 0, flash: 0, rings: [] });

  /* ---------- dibujo ---------- */
  const yDe = p => HOR + (H - HOR) * Math.pow(p, 1.7);                       // p: 0 horizonte … 1 frente al jeep
  const mitadCalle = y => 26 + (y - HOR) * 0.66;
  const curva = s => Math.sin(s.dist * 0.55) * 0.7 + Math.sin(s.dist * 0.23 + 1) * 0.5;               // la calle ondula: así se siente que el jeep gira
  const desvio = (s, p) => curva(s) * 150 * Math.pow(1 - p, 2);                // cuánto se corre la calle según qué tan lejos está
  const px = (s, mundoX, y, p) => W / 2 + (mundoX - s.x) * mitadCalle(y) + desvio(s, p);
  const lin = (c, y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  function dibujar(c, s, ahora) {
    c.save(); c.translate(W / 2, H); c.rotate(-s.giro * 0.018); c.translate(-W / 2, -H);       // el mundo se inclina al girar
    const par = -s.x * 26 - curva(s) * 70 - s.giro * 10;
    c.fillStyle = lin(c, 0, HOR, '#0e2b44', '#e9a678'); c.fillRect(-30, -30, W + 60, HOR + 30);
    const sol = c.createRadialGradient(W * 0.72 + par * 0.3, HOR - 6, 2, W * 0.72 + par * 0.3, HOR - 6, 70); sol.addColorStop(0, 'rgba(255,236,190,.95)'); sol.addColorStop(1, 'rgba(255,200,140,0)'); c.fillStyle = sol; c.fillRect(0, 70, W, HOR - 70);
    for (let i = 0; i < 26; i++) { const sx = (i * 97 + par * 0.05) % W, sy = (i * 53) % 86, tw = 0.35 + 0.35 * Math.sin(ahora * 2 + i); c.fillStyle = `rgba(255,244,214,${tw})`; c.fillRect((sx + W) % W, sy, 1.4, 1.4); }
    for (let i = 0; i < 4; i++) { const nx = (((i * 140 - s.dist * 6 + par * 0.15) % 560) + 560) % 560 - 100, ny = 38 + i * 21; c.fillStyle = 'rgba(255,210,170,.14)'; c.beginPath(); c.ellipse(nx, ny, 70, 9, 0, 0, 7); c.ellipse(nx + 30, ny - 6, 38, 8, 0, 0, 7); c.fill(); }
    for (let capa = 0; capa < 2; capa++) {                                                  // dos filas de edificios con ventanas encendidas
      const k = capa ? 1 : 0.5, base = HOR + 2;
      for (let i = -1; i < 10; i++) {
        const bx = i * (capa ? 44 : 52) + ((par * k) % 520), bh = (capa ? 30 : 46) + ((i * 53 + capa * 17) % 36), bw = capa ? 40 : 48;
        c.fillStyle = capa ? '#0a2234' : '#18405e'; c.fillRect(bx, base - bh, bw, bh);
        c.fillStyle = capa ? 'rgba(255,205,120,.55)' : 'rgba(255,205,120,.28)';
        for (let wy = base - bh + 6; wy < base - 5; wy += 9) for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) if (((wx * 7 + wy * 13 + capa) | 0) % 5 < 2) c.fillRect(wx, wy, 3.2, 4.2);
      }
    }
    const neblina = lin(c, HOR - 18, HOR + 24, 'rgba(233,166,120,0)', 'rgba(233,166,120,.55)'); c.fillStyle = neblina; c.fillRect(0, HOR - 18, W, 42);
    for (let y = HOR; y < H; y += 1.5) {                                                    // calle, cordones y banquetas con franjas que corren
      const p = (y - HOR) / (H - HOR), z = 1 / Math.max(p, 0.02), franja = Math.floor(z * 0.9 + s.dist * 4) % 2 === 0, m = mitadCalle(y), cx = px(s, 0, y, p), h = 1.5;
      const luz = 0.55 + p * 0.45;
      c.fillStyle = franja ? `rgb(${52 * luz | 0},${62 * luz | 0},${72 * luz | 0})` : `rgb(${44 * luz | 0},${54 * luz | 0},${64 * luz | 0})`; c.fillRect(cx - m, y, m * 2, h);
      c.fillStyle = franja ? '#c9c2b0' : '#9d9786'; c.fillRect(cx - m - 7 * (0.4 + p), y, 7 * (0.4 + p), h); c.fillRect(cx + m, y, 7 * (0.4 + p), h);       // cordón rayado
      c.fillStyle = franja ? '#7d7466' : '#8a8172'; c.fillRect(-40, y, cx - m - 7 * (0.4 + p) + 40, h); c.fillRect(cx + m + 7 * (0.4 + p), y, W + 40 - (cx + m + 7 * (0.4 + p)), h);
      if (franja) { c.fillStyle = '#f3efd5'; c.fillRect(cx - 1.4 - p * 2.2, y, 2.8 + p * 4.4, h); }
    }
    s.gente.map(g => ({ z: g.z, d: () => persona(c, s, g, ahora) })).concat(s.props.map(o => ({ z: o.z, d: () => utileria(c, s, o, ahora) }))).sort((a, b) => b.z - a.z).forEach(o => o.d());
    c.restore();
    c.globalCompositeOperation = 'lighter'; for (const lx of [90, 270]) { const hz = W / 2 + (lx - W / 2) * 0.3, g = c.createLinearGradient(0, 372, 0, HOR + 30); g.addColorStop(0, 'rgba(255,238,190,.2)'); g.addColorStop(1, 'rgba(255,238,190,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(lx - 12, 376); c.lineTo(lx + 12, 376); c.lineTo(hz + 26, HOR + 30); c.lineTo(hz - 26, HOR + 30); c.closePath(); c.fill(); } c.globalCompositeOperation = 'source-over';
    jeep(c, s, ahora);
    s.popups.forEach(q => {
      const k = q.t / 0.9, sc = 1 + Math.max(0, 0.45 - q.t * 2.4), yy = q.y - q.t * 50; c.save(); c.translate(q.x, yy); c.rotate(-0.1); c.scale(sc, sc); c.globalAlpha = Math.max(0, 1 - Math.pow(k, 2.2));
      c.fillStyle = '#ffb020'; c.strokeStyle = '#3a0f08'; c.lineWidth = 3; c.beginPath(); for (let n = 0; n < 16; n++) { const an = n * Math.PI / 8, rad = n % 2 ? 40 : 56; c.lineTo(Math.cos(an) * rad * 1.15, Math.sin(an) * rad * 0.62); } c.closePath(); c.fill(); c.stroke();
      c.font = '900 25px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.lineJoin = 'round'; c.strokeStyle = '#3a0f08'; c.strokeText(q.txt, 0, 1); c.fillStyle = '#fff6c8'; c.fillText(q.txt, 0, 1); c.restore();
    });
    s.parts.forEach(q => { c.save(); c.globalAlpha = Math.max(0, 1 - q.t); c.translate(q.x, q.y); c.rotate(q.r); if (q.k === 0) { c.fillStyle = '#ffd36a'; c.fillRect(-2, -8, 4, 16); } else if (q.k === 1) { c.fillStyle = '#b0432a'; c.beginPath(); c.roundRect ? c.roundRect(-9, -3.5, 18, 7, 3.5) : c.rect(-9, -3.5, 18, 7); c.fill(); } else { c.fillStyle = '#fff3b0'; c.font = '900 16px sans-serif'; c.textAlign = 'center'; c.fillText('★', 0, 5); } c.restore(); });
    s.rings.forEach(r => { const k = r.t / 0.45; c.save(); c.globalAlpha = Math.max(0, 1 - k); c.strokeStyle = '#fff3b0'; c.lineWidth = 5 * (1 - k) + 1; c.beginPath(); c.ellipse(r.x, r.y, 12 + k * 120, 6 + k * 60, 0, 0, 7); c.stroke(); c.restore(); });
    c.globalCompositeOperation = 'soft-light'; const gr = lin(c, 0, H, 'rgba(40,110,170,.5)', 'rgba(255,150,70,.5)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    const vi = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75); vi.addColorStop(0, 'rgba(0,0,0,0)'); vi.addColorStop(1, 'rgba(8,16,28,.5)'); c.fillStyle = vi; c.fillRect(0, 0, W, H);
    if (s.vel > 1.15) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.25, (s.vel - 1.15) * 0.4)})`; c.lineWidth = 1.2; for (let i = 0; i < 10; i++) { const a = ((i * 37 + s.dist * 160) % 120) / 120, ang = i % 2 ? 1 : -1; c.beginPath(); c.moveTo(W / 2 + ang * (40 + a * 150), HOR + a * 80); c.lineTo(W / 2 + ang * (60 + a * 230), HOR + 30 + a * 150); c.stroke(); } }
    if (s.flash > 0) { c.fillStyle = `rgba(255,246,214,${s.flash * 0.5})`; c.fillRect(0, 0, W, H); }
    c.save(); c.fillStyle = 'rgba(8,20,32,.72)'; c.strokeStyle = C.acc; c.lineWidth = 1.6; rr(c, 10, 9, 132, 36, 18); c.fill(); c.stroke();
    if (logo.complete && logo.naturalWidth) c.drawImage(logo, 14, 12, 30, 30);
    c.fillStyle = C.bg; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = '900 21px sans-serif'; c.fillText(String(Math.round(s.mostrado)), 52, 34); c.font = '700 9px sans-serif'; c.fillStyle = C.acc; c.fillText(T.puntos.toUpperCase(), 52, 17);
    const resto = Math.max(0, DURACION - s.t), rx = W - 36, ry = 27;
    c.fillStyle = 'rgba(8,20,32,.72)'; c.beginPath(); c.arc(rx, ry, 21, 0, 7); c.fill(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(rx, ry, 17, 0, 7); c.stroke();
    c.strokeStyle = resto < 8 ? '#ff5a3c' : C.acc; c.lineCap = 'round'; c.beginPath(); c.arc(rx, ry, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (resto / DURACION)); c.stroke();
    c.fillStyle = C.bg; c.font = '900 13px sans-serif'; c.textAlign = 'center'; c.fillText(Math.ceil(resto), rx, ry + 5);
    if (s.combo > 1) { const pop = 1 + Math.max(0, s.comboT - 1.7) * 1.2; c.translate(W / 2 + 6, 26); c.scale(pop, pop); c.fillStyle = C.acc; rr(c, -48, -15, 96, 30, 15); c.fill(); c.fillStyle = '#12324A'; c.font = '900 15px sans-serif'; c.fillText(`COMBO x${s.combo}`, 0, 5); c.fillStyle = '#fff'; c.fillRect(-40, 11, 80 * Math.max(0, Math.min(1, s.comboT / 2)), 3); }
    c.restore();
    if (s.final != null) final(c, s);
    if (s.fade > 0) { c.fillStyle = `rgba(0,0,0,${s.fade})`; c.fillRect(0, 0, W, H); }
  }
  /* ---------- sello y cierre ---------- */
  function sello(c, cx, cy, r, alfa, rot) {                                               // sello de goma: aros, texto en círculo y el logo de Gorila al centro
    c.save(); c.translate(cx, cy); c.rotate(rot); c.globalAlpha = alfa;
    c.fillStyle = 'rgba(14,38,58,.88)'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.strokeStyle = C.bg; c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, 0, r * 0.96, 0, 7); c.stroke(); c.lineWidth = r * 0.02; c.beginPath(); c.arc(0, 0, r * 0.66, 0, 7); c.stroke();
    const txt = 'TERRITORIO CONQUISTADO ★ GORILA BURGERS ★ ', n = txt.length; c.fillStyle = C.acc; c.font = `900 ${r * 0.15}px sans-serif`; c.textAlign = 'center';
    for (let i = 0; i < n; i++) { c.save(); c.rotate((i / n) * Math.PI * 2 - Math.PI / 2); c.translate(0, -r * 0.8); c.fillText(txt[i], 0, 0); c.restore(); }
    if (logo.complete && logo.naturalWidth) c.drawImage(logo, -r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
    c.restore();
  }
  function final(c, s) {                                                                  // «Territorio conquistado» + el sello cae con un golpe
    const f = s.final, osc = Math.min(0.55, f * 1.2); c.fillStyle = `rgba(6,14,26,${osc})`; c.fillRect(0, 0, W, H);
    const a = Math.min(1, f / 0.4); c.globalAlpha = a; c.textAlign = 'center'; c.font = '900 30px sans-serif'; c.lineWidth = 6; c.strokeStyle = '#12324A'; c.strokeText('TERRITORIO', W / 2, 150 - (1 - a) * 20); c.fillStyle = C.bg; c.fillText('TERRITORIO', W / 2, 150 - (1 - a) * 20);
    c.font = '900 38px sans-serif'; c.strokeText('CONQUISTADO', W / 2, 192 - (1 - a) * 20); c.fillStyle = C.acc; c.fillText('CONQUISTADO', W / 2, 192 - (1 - a) * 20); c.globalAlpha = 1;
    if (f > 0.7) { const k = Math.min(1, (f - 0.7) / 0.28), e = 1 - Math.pow(1 - k, 3); sello(c, W / 2, 330, 92 * (2.2 - 1.2 * e), Math.min(1, k * 1.6), -0.22 + (1 - e) * 0.5); if (f > 0.97 && f < 1.1) c.fillStyle = `rgba(255,255,255,${(1.1 - f) * 2})`, c.fillRect(0, 0, W, H); }
  }
  /* ---------- introducción: la tele, la misión y la carrera hasta el jeep ---------- */
  function gorilaCuerpo(c, x, y, k, t, corre) {                                           // gorila de cuerpo entero, de lado, para la introducción
    c.save(); c.translate(x, y); c.scale(k, k); const sw = corre ? Math.sin(t * 14) : 0;
    c.fillStyle = '#14141a'; c.save(); c.rotate(sw * 0.7); c.beginPath(); c.roundRect ? c.roundRect(-9, 0, 15, 42, 7) : c.rect(-9, 0, 15, 42); c.fill(); c.restore();
    c.save(); c.rotate(-sw * 0.7); c.beginPath(); c.roundRect ? c.roundRect(-3, 0, 15, 42, 7) : c.rect(-3, 0, 15, 42); c.fill(); c.restore();
    const cu = c.createRadialGradient(-6, -20, 6, 0, -14, 52); cu.addColorStop(0, '#3a3a44'); cu.addColorStop(1, '#101015'); c.fillStyle = cu; c.beginPath(); c.ellipse(2, -16, 30, 38, corre ? 0.25 : 0, 0, 7); c.fill();
    c.fillStyle = '#4a4650'; c.beginPath(); c.ellipse(12, -14, 15, 22, 0.2, 0, 7); c.fill();                                       // pecho
    c.save(); c.rotate(corre ? -sw * 1.0 + 0.5 : 0.4); c.fillStyle = '#16161b'; c.beginPath(); c.roundRect ? c.roundRect(-8, -40, 17, 62, 8) : c.rect(-8, -40, 17, 62); c.fill(); c.fillStyle = '#3e3a43'; c.beginPath(); c.arc(0, 24, 10, 0, 7); c.fill(); c.restore();   // brazo largo
    cara(c, 16, -52, 19); c.restore();
  }
  function intro(alTerminar) {
    raiz.innerHTML = `<div class="jg-juego"><div class="jg-vista"></div><button type="button" class="btn btn-linea jg-saltar" id="jg-saltar">Saltar</button></div>`;
    const { ctx: c } = lienzo(raiz.querySelector('.jg-vista')); let t0 = performance.now(), vivo = true;
    const salir = () => { if (!vivo) return; vivo = false; alTerminar(); };
    raiz.querySelector('#jg-saltar').onclick = salir; raiz.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const SALA = 3.6, CALLE = 2.8;
    function sala(t) {
      c.fillStyle = lin(c, 0, H, '#1c2144', '#2a2f55'); c.fillRect(0, 0, W, H);
      c.fillStyle = '#2b1f1a'; c.fillRect(0, 392, W, H - 392); c.fillStyle = '#7a2f2f'; c.fillRect(30, 404, 300, 44);
      c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(318, 90, 14, 0, 7); c.fill(); c.fillStyle = 'rgba(255,211,106,.15)'; c.beginPath(); c.arc(318, 90, 40, 0, 7); c.fill();         // lámpara
      c.fillStyle = '#5a4a3a'; c.fillRect(10, 300, 170, 92); c.fillStyle = '#6d5a47'; c.fillRect(10, 264, 36, 128); c.fillRect(144, 264, 36, 128);                              // sillón
      gorilaSentado(c, t);
      c.fillStyle = '#1a1a1f'; c.fillRect(214, 168, 124, 100); c.fillStyle = '#2b2b33'; c.fillRect(222, 176, 108, 82); c.fillRect(262, 268, 28, 28); c.fillRect(246, 292, 60, 8);       // tele
      const pa = Math.min(1, t / 0.6), flick = 0.82 + Math.sin(t * 40) * 0.05; c.fillStyle = `rgba(${t < 1 ? '200,220,255' : '255,70,60'},${0.9 * flick})`; c.fillRect(222, 176, 108, 82);
      if (t < 1.2) { for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${(i * 53) % 255},${(i * 91) % 255},255,.35)`; c.fillRect(222 + ((i * 37 + t * 300) % 100), 176 + ((i * 17) % 76), 8, 5); } }
      else { c.fillStyle = '#fff'; c.font = '900 13px sans-serif'; c.textAlign = 'center'; c.fillText('ÚLTIMA HORA', 276, 208); c.font = '800 11px sans-serif'; c.fillText('¿QUÉ PASA EN', 276, 228); c.fillText('LA CIUDAD?', 276, 244); }
      c.fillStyle = `rgba(255,70,60,${0.1 + pa * 0.12 * flick})`; c.beginPath(); c.moveTo(214, 268); c.lineTo(120, 420); c.lineTo(350, 420); c.closePath(); c.fill();   // luz de la tele sobre la sala
      if (t > 1.5) { const k = Math.min(1, (t - 1.5) / 0.35), pop = 1 + (1 - k) * 0.25; c.save(); c.translate(W / 2, 110); c.scale(pop, pop); c.globalAlpha = k;
        c.fillStyle = 'rgba(8,20,32,.92)'; c.beginPath(); c.roundRect ? c.roundRect(-150, -48, 300, 96, 14) : c.rect(-150, -48, 300, 96); c.fill(); c.strokeStyle = C.acc; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#ffd36a'; c.font = '800 12px sans-serif'; c.textAlign = 'center'; c.fillText('★ MISIÓN ★', 0, -26); c.fillStyle = C.bg; c.font = '900 22px sans-serif'; c.fillText('NUEVO TERRITORIO', 0, 2); c.fillText('POR CONQUISTAR', 0, 28); c.restore(); }
    }
    function gorilaSentado(c, t) {
      c.save(); c.translate(96, 330); const sw = Math.sin(t * 2) * 1.5;
      c.fillStyle = '#14141a'; c.beginPath(); c.roundRect ? c.roundRect(10, 8, 66, 22, 10) : c.rect(10, 8, 66, 22); c.fill();                                                    // piernas hacia la tele
      const cu = c.createRadialGradient(-6, -26, 6, 0, -14, 60); cu.addColorStop(0, '#3a3a44'); cu.addColorStop(1, '#101015'); c.fillStyle = cu; c.beginPath(); c.ellipse(0, -8, 38, 44, 0.15, 0, 7); c.fill();
      c.fillStyle = '#4a4650'; c.beginPath(); c.ellipse(10, -4, 18, 26, 0.2, 0, 7); c.fill();
      c.fillStyle = '#16161b'; c.beginPath(); c.roundRect ? c.roundRect(14, -22 + sw, 52, 16, 8) : c.rect(14, -22, 52, 16); c.fill();                                                // brazo hacia la hamburguesa
      c.fillStyle = '#d99a4a'; c.beginPath(); c.arc(70, -16 + sw, 11, Math.PI, 0); c.fill(); c.fillStyle = '#4a2412'; c.fillRect(59, -16 + sw, 22, 5); c.fillStyle = '#d99a4a'; c.fillRect(60, -11 + sw, 20, 4);   // hamburguesa
      cara(c, 14, -62, 24); c.restore();
    }
    function calle(t) {
      c.fillStyle = lin(c, 0, 360, '#0e2b44', '#e9a678'); c.fillRect(0, 0, W, 360);
      c.fillStyle = '#0a2234'; for (let i = 0; i < 9; i++) { const bh = 90 + (i * 41) % 90; c.fillRect(i * 44 - t * 20, 360 - bh, 40, bh); }
      c.fillStyle = '#35404a'; c.fillRect(0, 360, W, H - 360); c.fillStyle = '#f3efd5'; for (let i = 0; i < 6; i++) c.fillRect(((i * 70 - t * 40) % 420 + 420) % 420 - 30, 440, 40, 4);
      const salto = Math.max(0, t - 1.5), jx = 150, jy = 392, rueda = (x, y) => { c.fillStyle = '#16181c'; c.beginPath(); c.arc(x, y, 24, 0, 7); c.fill(); c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); };
      const salida = t > 2.2 ? (t - 2.2) * 160 : 0; c.save(); c.translate(salida, 0);                                                                                                // el jeep arranca
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(jx + 20, jy + 30, 150, 10, 0, 0, 7); c.fill();
      remolque(c, jx - 92, jy + 24, 96, Math.sin(t * 9) * 0.01);                                                                                                               // el food truck va enganchado atrás
      c.fillStyle = '#4d5f2a'; c.beginPath(); c.roundRect ? c.roundRect(jx - 30, jy - 62, 190, 62, 10) : c.rect(jx - 30, jy - 62, 190, 62); c.fill();
      c.fillStyle = '#5d7035'; c.fillRect(jx + 74, jy - 62, 86, 18); c.fillStyle = '#17191d'; c.fillRect(jx + 56, jy - 106, 6, 46); c.fillRect(jx + 56, jy - 108, 60, 6);
      c.fillStyle = 'rgba(140,190,220,.35)'; c.beginPath(); c.moveTo(jx + 62, jy - 102); c.lineTo(jx + 112, jy - 102); c.lineTo(jx + 122, jy - 62); c.lineTo(jx + 62, jy - 62); c.closePath(); c.fill();
      c.fillStyle = '#e6d9a0'; c.beginPath(); c.arc(jx + 154, jy - 34, 10, 0, 7); c.fill();
      if (logo.complete && logo.naturalWidth) c.drawImage(logo, jx + 4, jy - 52, 40, 40);
      rueda(jx + 10, jy); rueda(jx + 130, jy);
      if (salto > 0.5) { gorilaCuerpo(c, jx + 66, jy - 62, 0.7, t, false); c.fillStyle = '#17191d'; c.fillRect(jx + 56, jy - 64, 60, 10); }                                          // ya sentado al volante
      c.restore();
      if (t > 2) { c.fillStyle = 'rgba(210,210,210,.45)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(jx - 34 - i * 14 + salida, jy - 8 - i * 4, 8 + i * 3, 0, 7); c.fill(); } }
      if (salto <= 0.5) { const gx = -50 + Math.min(1, t / 1.5) * (jx + 30), hop = salto > 0 ? Math.sin(salto / 0.5 * Math.PI) * 60 : 0; gorilaCuerpo(c, gx, jy - 20 - hop, 0.8, t, salto <= 0); }
    }
    function ciclo(ahora) {
      if (!vivo) return; const t = (ahora - t0) / 1000;
      if (t < SALA) sala(t); else if (t < SALA + CALLE) calle(t - SALA); else { salir(); return; }
      const fin = SALA + CALLE; if (t > fin - 0.5) { c.fillStyle = `rgba(0,0,0,${Math.min(1, (t - (fin - 0.5)) / 0.5)})`; c.fillRect(0, 0, W, H); }
      if (t < 0.4) { c.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`; c.fillRect(0, 0, W, H); }
      requestAnimationFrame(ciclo);
    }
    requestAnimationFrame(ciclo);
  }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  function utileria(c, s, o, ahora) {                                                      // lo que bordea la calle: farolas, palmas de la selva y carteles de Gorila
    const p = 1 - o.z, y = yDe(p), e = 0.12 + 0.88 * Math.pow(p, 1.3), cx = px(s, o.x, y, p), a = 112 * e;
    c.save(); c.translate(cx, y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, a * 0.28, a * 0.05, 0, 0, 7); c.fill();
    if (o.k === 'farola') {
      c.fillStyle = '#1b2733'; c.fillRect(-a * 0.025, -a * 1.55, a * 0.05, a * 1.55); c.fillRect(-a * 0.025, -a * 1.55, a * 0.3 * Math.sign(-o.x), a * 0.04); c.fillRect(-a * 0.07, -a * 0.07, a * 0.14, a * 0.07);
      const lx = a * 0.3 * Math.sign(-o.x); c.fillStyle = '#ffe2a0'; rr(c, lx - a * 0.07, -a * 1.54, a * 0.14, a * 0.06, a * 0.03); c.fill();
      c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(lx, -a * 1.5, 1, lx, -a * 1.5, a * 0.8); g.addColorStop(0, 'rgba(255,205,120,.6)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(lx - a, -a * 2.4, a * 2, a * 1.8);
      const pool = c.createRadialGradient(lx, 0, 1, lx, 0, a * 0.7); pool.addColorStop(0, 'rgba(255,200,120,.22)'); pool.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = pool; c.beginPath(); c.ellipse(lx, 0, a * 0.7, a * 0.16, 0, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
    } else if (o.k === 'palma') {
      const sway = Math.sin(ahora * 1.4 + o.fase) * a * 0.03; c.strokeStyle = '#5a3a22'; c.lineCap = 'round'; c.lineWidth = a * 0.09; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(a * 0.1, -a * 0.7, a * 0.04 + sway, -a * 1.3); c.stroke();
      c.strokeStyle = '#7a5230'; c.lineWidth = a * 0.025; c.beginPath(); c.moveTo(-a * 0.02, -a * 0.05); c.quadraticCurveTo(a * 0.07, -a * 0.7, a * 0.02 + sway, -a * 1.3); c.stroke();
      for (let i = 0; i < 7; i++) { const ang = -Math.PI / 2 + (i - 3) * 0.5 + sway / a; c.save(); c.translate(a * 0.04 + sway, -a * 1.3); c.rotate(ang); c.fillStyle = i % 2 ? '#2f7a4a' : '#1f5c3a'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(a * 0.2, -a * 0.14, a * 0.55, a * 0.1); c.quadraticCurveTo(a * 0.22, -a * 0.02, 0, a * 0.03); c.fill(); c.restore(); }
    } else {
      c.fillStyle = '#17191d'; c.fillRect(-a * 0.5, -a * 1.0, a * 0.05, a * 1.0); c.fillRect(a * 0.45, -a * 1.0, a * 0.05, a * 1.0);
      c.fillStyle = '#1b1714'; rr(c, -a * 0.62, -a * 1.58, a * 1.24, a * 0.66, a * 0.04); c.fill(); c.strokeStyle = '#d9692a'; c.lineWidth = Math.max(1, a * 0.03); c.stroke();
      if (logo.complete && logo.naturalWidth) c.drawImage(logo, -a * 0.54, -a * 1.5, a * 0.5, a * 0.5);
      c.textAlign = 'left'; c.fillStyle = '#e7d8b8'; c.font = `900 ${a * 0.15}px sans-serif`; c.fillText('GORILA', -a * 0.0, -a * 1.28); c.fillStyle = '#d9692a'; c.fillText('BURGERS', -a * 0.0, -a * 1.12);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,190,110,.13)'; rr(c, -a * 0.62, -a * 1.58, a * 1.24, a * 0.66, a * 0.04); c.fill(); c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }
  function medidor(c, x, y, r, v) {                                                          // reloj del tablero con aguja
    c.fillStyle = '#08090b'; c.beginPath(); c.arc(x, y, r + 3, 0, 7); c.fill(); const cr = c.createLinearGradient(x - r, y - r, x + r, y + r); cr.addColorStop(0, '#e6e9ee'); cr.addColorStop(1, '#6c7178'); c.strokeStyle = cr; c.lineWidth = 2.2; c.beginPath(); c.arc(x, y, r + 2, 0, 7); c.stroke();
    const f = c.createRadialGradient(x - 3, y - 4, 1, x, y, r); f.addColorStop(0, '#2c3138'); f.addColorStop(1, '#101215'); c.fillStyle = f; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; for (let i = 0; i <= 8; i++) { const a = 2.35 + i * (4.2 / 8) - Math.PI * 0.15; c.beginPath(); c.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4)); c.lineTo(x + Math.cos(a) * (r - 1.5), y + Math.sin(a) * (r - 1.5)); c.stroke(); }
    const an = 2.35 - Math.PI * 0.15 + Math.max(0, Math.min(1, v)) * 4.2; c.strokeStyle = '#ff5a3c'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * (r - 3), y + Math.sin(an) * (r - 3)); c.stroke(); c.fillStyle = '#c9ccd0'; c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill();
  }
  function carrito(c, g, a, ahora) {                                                   // carrito de comida callejera
    if (g.golpe) { const k = g.t / 0.55; if (k < 1) { const r = a * (0.35 + k * 1.4), fl = c.createRadialGradient(0, -a * 0.5, 2, 0, -a * 0.5, r); fl.addColorStop(0, `rgba(255,248,200,${1 - k})`); fl.addColorStop(0.5, `rgba(255,150,40,${0.8 * (1 - k)})`); fl.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = fl; c.beginPath(); c.arc(0, -a * 0.5, r, 0, 7); c.fill(); c.strokeStyle = `rgba(255,236,190,${0.9 * (1 - k)})`; c.lineWidth = 3; c.beginPath(); c.arc(0, -a * 0.5, r * 0.9, 0, 7); c.stroke(); } return; }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, 0, a * 0.5, a * 0.08, 0, 0, 7); c.fill();
    c.fillStyle = '#2a2f36'; for (const wx of [-a * 0.32, a * 0.32]) { c.beginPath(); c.arc(wx, -a * 0.08, a * 0.1, 0, 7); c.fill(); c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(wx, -a * 0.08, a * 0.04, 0, 7); c.fill(); c.fillStyle = '#2a2f36'; }
    const cu = c.createLinearGradient(0, -a * 0.6, 0, -a * 0.12); cu.addColorStop(0, '#e8643a'); cu.addColorStop(1, '#a93a1c'); c.fillStyle = cu; c.fillRect(-a * 0.45, -a * 0.6, a * 0.9, a * 0.48);
    c.fillStyle = '#f1e3c4'; c.fillRect(-a * 0.5, -a * 0.64, a * 1, a * 0.07);
    c.fillStyle = '#ffd36a'; c.fillRect(-a * 0.36, -a * 0.5, a * 0.72, a * 0.16);                                           // letrero
    c.fillStyle = '#8c3a1c'; c.fillRect(-a * 0.3, -a * 0.46, a * 0.6, a * 0.03);
    c.fillStyle = '#c9a07a'; c.beginPath(); c.roundRect ? c.roundRect(-a * 0.2, -a * 0.8, a * 0.4, a * 0.13, a * 0.06) : c.rect(-a * 0.2, -a * 0.8, a * 0.4, a * 0.13); c.fill();   // hot dog en el mostrador
    c.fillStyle = '#b0432a'; c.fillRect(-a * 0.17, -a * 0.775, a * 0.34, a * 0.05);
    c.fillStyle = '#555c66'; c.fillRect(a * 0.28, -a * 1.0, a * 0.06, a * 0.36);                                              // chimenea
    c.fillStyle = 'rgba(220,220,220,.5)'; c.beginPath(); c.arc(a * 0.31 + Math.sin(ahora * 3) * a * 0.03, -a * 1.08, a * 0.06, 0, 7); c.fill();
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff' : '#e23b3b'; c.beginPath(); c.moveTo(0, -a * 1.06); c.arc(0, -a * 0.66, a * 0.62, Math.PI * (1 + i / 6), Math.PI * (1 + (i + 1) / 6)); c.closePath(); c.fill(); }   // sombrilla a rayas
    c.strokeStyle = '#555c66'; c.lineWidth = Math.max(1, a * 0.03); c.beginPath(); c.moveTo(0, -a * 1.06); c.lineTo(0, -a * 0.64); c.stroke();
  }
  function persona(c, s, g, ahora) {
    const p = 1 - g.z, y = yDe(p), esc_ = 0.12 + 0.88 * Math.pow(p, 1.3), cx = px(s, g.x, y, p), a = 112 * esc_ * g.tipo.alto;
    if (g.carrito) { c.save(); c.translate(cx, y); carrito(c, g, a * 1.05, ahora); c.restore(); return; }
    c.save(); c.translate(cx + (g.dx || 0), y - (g.dy || 0));
    if (!g.golpe) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, 0, a * 0.3, a * 0.07, 0, 0, 7); c.fill(); }
    if (g.golpe) c.rotate(g.rot);
    const paso = Math.sin(ahora * 9 + g.fase) * a * 0.1, tono = g.tipo.piel || '#f1c9a0';
    c.fillStyle = '#20252b'; rr(c, -a * 0.2, -a * 0.34, a * 0.16, a * 0.34 + paso, a * 0.05); c.fill(); rr(c, a * 0.04, -a * 0.34, a * 0.16, a * 0.34 - paso, a * 0.05); c.fill();        // piernas
    c.fillStyle = '#0d0f12'; c.fillRect(-a * 0.23, paso - a * 0.02, a * 0.22, a * 0.05); c.fillRect(a * 0.02, -paso - a * 0.02, a * 0.22, a * 0.05);       // zapatos
    const cuerpo = c.createLinearGradient(-a * 0.26, 0, a * 0.26, 0); cuerpo.addColorStop(0, g.tipo.ropa); cuerpo.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = g.tipo.ropa; rr(c, -a * 0.26, -a * 0.78, a * 0.52, a * 0.46, a * 0.1); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = Math.max(0.8, a * 0.014); c.stroke();
    c.fillStyle = cuerpo; c.globalAlpha = 0.45; rr(c, -a * 0.26, -a * 0.78, a * 0.52, a * 0.46, a * 0.1); c.fill(); c.globalAlpha = 1;
    c.fillStyle = tono; rr(c, -a * 0.38, -a * 0.76 - paso * 0.5, a * 0.12, a * 0.34, a * 0.05); c.fill(); rr(c, a * 0.26, -a * 0.76 + paso * 0.5, a * 0.12, a * 0.34, a * 0.05); c.fill();                // brazos
    const cb = c.createRadialGradient(-a * 0.05, -a * 0.97, a * 0.02, 0, -a * 0.92, a * 0.2); cb.addColorStop(0, '#fff'); cb.addColorStop(1, tono); c.fillStyle = tono; c.beginPath(); c.arc(0, -a * 0.92, a * 0.17, 0, 7); c.fill(); c.globalAlpha = 0.5; c.fillStyle = cb; c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = Math.max(0.8, a * 0.014); c.stroke();
    c.fillStyle = '#2b1d14'; c.beginPath(); c.arc(0, -a * 0.97, a * 0.17, Math.PI, 0); c.fill();                                                      // pelo
    c.fillStyle = '#1b1b1b'; c.fillRect(-a * 0.07, -a * 0.93, a * 0.035, a * 0.035); c.fillRect(a * 0.035, -a * 0.93, a * 0.035, a * 0.035);
    if (g.tipo.n === 'Chef') { c.fillStyle = '#fff'; c.beginPath(); c.roundRect ? c.roundRect(-a * 0.18, -a * 1.28, a * 0.36, a * 0.26, a * 0.08) : c.rect(-a * 0.18, -a * 1.28, a * 0.36, a * 0.26); c.fill(); }
    if (g.tipo.n === 'Rockero') { c.fillStyle = '#e23b7a'; c.beginPath(); c.moveTo(-a * 0.06, -a * 1.07); c.lineTo(0, -a * 1.28); c.lineTo(a * 0.06, -a * 1.07); c.fill(); }
    if (g.tipo.n === 'Ciclista') { c.fillStyle = '#ffd36a'; c.beginPath(); c.ellipse(0, -a * 1.04, a * 0.2, a * 0.1, 0, Math.PI, 0); c.fill(); }
    if (g.golpe) { c.fillStyle = '#ffd36a'; c.font = `900 ${a * 0.5}px sans-serif`; c.textAlign = 'center'; c.fillText('★', -a * 0.45, -a * 1.1); c.fillText('★', a * 0.45, -a * 0.8); }
    c.restore();
  }
  function cara(c, x, y, r) {                                                              // cara de gorila: cresta, ceja pesada, hocico claro, narinas y colmillos
    c.save(); c.translate(x, y);
    const pelo = c.createRadialGradient(0, -r * 0.2, r * 0.2, 0, 0, r * 1.15); pelo.addColorStop(0, '#34343c'); pelo.addColorStop(1, '#0e0e12');
    c.fillStyle = pelo; c.beginPath(); c.ellipse(0, 0, r, r * 1.05, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(0, -r * 0.95, r * 0.45, r * 0.32, 0, 0, 7); c.fill();                           // cresta
    c.fillStyle = '#4a3f3b'; c.beginPath(); c.ellipse(0, r * 0.2, r * 0.7, r * 0.72, 0, 0, 7); c.fill();       // máscara facial
    c.fillStyle = '#0b0b0e'; c.beginPath(); c.ellipse(0, -r * 0.32, r * 0.78, r * 0.2, 0, 0, 7); c.fill();     // ceja
    c.fillStyle = '#f4ead0'; for (const ex of [-r * 0.28, r * 0.28]) { c.beginPath(); c.ellipse(ex, -r * 0.14, r * 0.13, r * 0.1, 0, 0, 7); c.fill(); }
    c.fillStyle = '#120f0d'; for (const ex of [-r * 0.28, r * 0.28]) { c.beginPath(); c.arc(ex, -r * 0.13, r * 0.06, 0, 7); c.fill(); }
    c.fillStyle = '#6a5b54'; c.beginPath(); c.ellipse(0, r * 0.42, r * 0.46, r * 0.3, 0, 0, 7); c.fill();       // hocico
    c.fillStyle = '#17110f'; for (const nx of [-r * 0.12, r * 0.12]) { c.beginPath(); c.ellipse(nx, r * 0.24, r * 0.06, r * 0.045, 0, 0, 7); c.fill(); }
    c.strokeStyle = '#17110f'; c.lineWidth = Math.max(1, r * 0.06); c.beginPath(); c.moveTo(-r * 0.24, r * 0.5); c.quadraticCurveTo(0, r * 0.62, r * 0.24, r * 0.5); c.stroke();
    c.fillStyle = '#f4ead0'; c.fillRect(-r * 0.14, r * 0.5, r * 0.06, r * 0.09); c.fillRect(r * 0.08, r * 0.5, r * 0.06, r * 0.09);
    c.restore();
  }
  function mano(c, x, y, ang, lado) {                                                       // mano peluda de gorila agarrando el aro del volante
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = '#16161b'; c.beginPath(); c.ellipse(0, 6, 17, 21, 0, 0, 7); c.fill();                      // muñeca y brazo
    const pg = c.createRadialGradient(-4, -6, 2, 0, 0, 22); pg.addColorStop(0, '#4b4750'); pg.addColorStop(1, '#17171c'); c.fillStyle = pg; c.beginPath(); c.ellipse(0, 0, 17, 15, 0, 0, 7); c.fill();
    for (let i = 0; i < 4; i++) { const fx = (i - 1.5) * 9 * lado, g2 = c.createLinearGradient(fx, -16, fx, -4); g2.addColorStop(0, '#3e3a43'); g2.addColorStop(1, '#17171c'); c.fillStyle = g2; c.beginPath(); c.roundRect ? c.roundRect(fx - 4.4, -19, 8.8, 14, 4.4) : c.rect(fx - 4.4, -19, 8.8, 14); c.fill(); }
    c.fillStyle = '#6a6470'; for (let i = 0; i < 4; i++) c.fillRect((i - 1.5) * 9 * lado - 3, -17, 6, 1.6);          // nudillos
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-14 + i * 4.5, 12); c.lineTo(-12 + i * 4.5, 2); c.stroke(); }  // pelaje
    c.restore();
  }
  function remolque(c, x, y, w, ang) {                                                      // el food truck de Gorila: caja oscura con palmas naranjas, el logo y «Welcome to the jungle»
    const h = w * 0.7; c.save(); c.translate(x, y); c.rotate(ang || 0);
    c.fillStyle = '#111'; c.beginPath(); c.arc(0, -w * 0.1, w * 0.1, 0, 7); c.fill(); c.fillStyle = '#6b7078'; c.beginPath(); c.arc(0, -w * 0.1, w * 0.04, 0, 7); c.fill();
    c.fillStyle = '#2a221e'; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h - w * 0.12, w, h, w * 0.03) : c.rect(-w / 2, -h - w * 0.12, w, h); c.fill();
    c.strokeStyle = '#8b8e94'; c.lineWidth = Math.max(1, w * 0.012); c.stroke();
    c.save(); c.beginPath(); c.rect(-w / 2, -h - w * 0.12, w, h); c.clip();
    c.fillStyle = '#c4632a'; for (let i = 0; i < 6; i++) { c.save(); c.translate(-w * 0.4 + i * w * 0.15, -w * 0.2); c.rotate(-0.9 + (i % 3) * 0.55); c.beginPath(); c.ellipse(0, -w * 0.09, w * 0.035, w * 0.12, 0, 0, 7); c.fill(); c.restore(); }
    c.textAlign = 'center'; c.fillStyle = '#e7d8b8'; c.font = `900 ${w * 0.115}px sans-serif`; c.fillText('WELCOME', -w * 0.14, -h * 0.9); c.fillText('TO THE', -w * 0.14, -h * 0.72);
    c.fillStyle = '#d9692a'; c.font = `900 ${w * 0.15}px sans-serif`; c.fillText('JUNGLE', -w * 0.14, -h * 0.52);
    if (logo.complete && logo.naturalWidth) { c.beginPath(); c.arc(w * 0.3, -h * 0.62, w * 0.14, 0, 7); c.fillStyle = '#f2d7b8'; c.fill(); c.drawImage(logo, w * 0.3 - w * 0.13, -h * 0.62 - w * 0.13, w * 0.26, w * 0.26); }
    c.restore(); c.strokeStyle = '#17191d'; c.lineWidth = Math.max(1.5, w * 0.025); c.beginPath(); c.moveTo(w / 2, -w * 0.2); c.lineTo(w / 2 + w * 0.14, -w * 0.2); c.stroke(); c.restore();
  }
  function botella(c, x, y, ang, k) {                                                         // botella de la «Cerveza de Gorila»
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(k, k);
    const g = c.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, '#5a2e0a'); g.addColorStop(0.35, '#b8691b'); g.addColorStop(1, '#4a2508'); c.fillStyle = g;
    c.beginPath(); c.roundRect ? c.roundRect(-11, -10, 22, 48, 5) : c.rect(-11, -10, 22, 48); c.fill(); c.beginPath(); c.roundRect ? c.roundRect(-5, -36, 10, 30, 4) : c.rect(-5, -36, 10, 30); c.fill();
    c.fillStyle = '#d4a73a'; c.fillRect(-6, -40, 12, 6); c.fillStyle = '#f0e2bb'; c.fillRect(-11, 8, 22, 16);
    if (logo.complete && logo.naturalWidth) c.drawImage(logo, -7, 9, 14, 14);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-8, -6, 3, 36); c.restore();
  }
  function jeep(c, s, ahora) {
    const sh = s.sacude > 0 ? Math.sin(ahora * 70) * s.sacude * 7 : 0, bob = Math.sin(ahora * 14 * s.vel) * 0.9;
    c.save(); c.translate(W / 2 + sh - s.giro * 5, H); c.rotate(s.giro * 0.028); c.translate(-W / 2, -H + bob);                  // el jeep se inclina hacia donde gira
    const capo = c.createLinearGradient(0, 360, 0, H); capo.addColorStop(0, '#6f8440'); capo.addColorStop(0.5, '#4d5f2a'); capo.addColorStop(1, '#2f3b1b');
    c.fillStyle = capo; c.beginPath(); c.moveTo(52, H); c.lineTo(106, 368); c.lineTo(254, 368); c.lineTo(308, H); c.closePath(); c.fill();
    c.save(); c.beginPath(); c.moveTo(52, H); c.lineTo(106, 368); c.lineTo(254, 368); c.lineTo(308, H); c.closePath(); c.clip(); const bri = c.createLinearGradient(70, 380, 300, 470); bri.addColorStop(0, 'rgba(255,255,255,0)'); bri.addColorStop(0.45, 'rgba(255,255,255,.16)'); bri.addColorStop(0.6, 'rgba(255,255,255,0)'); c.fillStyle = bri; c.fillRect(0, 360, W, 130); c.fillStyle = 'rgba(0,0,0,.35)'; for (const rx of [118, 242]) { c.beginPath(); c.arc(rx, 382, 2.2, 0, 7); c.fill(); } c.restore();
    c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(112, 372); c.lineTo(248, 372); c.lineTo(252, 380); c.lineTo(108, 380); c.closePath(); c.fill();   // brillo del borde del capó
    c.strokeStyle = 'rgba(20,28,10,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(180, 372); c.lineTo(180, H); c.stroke();                                    // costura central
    if (logo.complete && logo.naturalWidth) { c.save(); c.translate(180, 387); c.scale(1, 0.66); c.globalAlpha = 0.95; c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 4; c.shadowOffsetY = 1.5; c.drawImage(logo, -21, -21, 42, 42); c.restore(); }   // logo en el capó
    for (const lx of [90, 270]) {                                                                                                                              // faros redondos con cromo
      const cr = c.createRadialGradient(lx - 4, 394, 2, lx, 398, 20); cr.addColorStop(0, '#fffbe6'); cr.addColorStop(0.6, '#e6d9a0'); cr.addColorStop(1, '#8c8456');
      c.fillStyle = cr; c.beginPath(); c.arc(lx, 398, 17, 0, 7); c.fill(); c.strokeStyle = '#c9ccd0'; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = '#2a3318'; c.lineWidth = 1.2; c.stroke();
    }
    c.fillStyle = '#17191d'; c.beginPath(); c.moveTo(0, 296); c.lineTo(W, 296); c.lineTo(W, H); c.lineTo(342, H); c.lineTo(318, 312); c.lineTo(42, 312); c.lineTo(18, H); c.lineTo(0, H); c.closePath(); c.fill();   // marco del parabrisas
    c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(60, 314); c.lineTo(120, 314); c.lineTo(90, 366); c.lineTo(48, 366); c.closePath(); c.fill();                                                  // reflejo en el vidrio
    c.fillStyle = lin(c, 436, H, '#2b2e34', '#15171a'); c.fillRect(0, 436, W, H - 436);                                                                                                            // tablero
    medidor(c, 76, 458, 15, (s.vel - 0.9) / 0.9 + Math.sin(ahora * 25) * 0.015); medidor(c, 284, 458, 15, 0.55 + Math.sin(ahora * 1.3) * 0.05 + Math.sin(ahora * 31) * 0.01);
    c.fillStyle = '#0d0e10'; c.beginPath(); c.roundRect ? c.roundRect(W / 2 - 52, 300, 104, 58, 12) : c.rect(W / 2 - 52, 300, 104, 58); c.fill();                                                                    // retrovisor
    c.strokeStyle = '#8b9096'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#2d3a46'; c.beginPath(); c.roundRect ? c.roundRect(W / 2 - 47, 305, 94, 48, 9) : c.rect(W / 2 - 47, 305, 94, 48); c.fill();
    c.save(); c.beginPath(); c.rect(W / 2 - 47, 305, 94, 48); c.clip(); const cielo = c.createLinearGradient(0, 305, 0, 353); cielo.addColorStop(0, '#3a5870'); cielo.addColorStop(1, '#6a5a52'); c.fillStyle = cielo; c.fillRect(W / 2 - 47, 305, 94, 48);
    c.fillStyle = '#34383e'; c.fillRect(W / 2 - 47, 340, 94, 13); remolque(c, W / 2 + s.rem * 16, 349, 54, s.rem * 0.07 + (s.sacude ? Math.sin(ahora * 60) * 0.03 * s.sacude : 0)); c.restore();                                                   // el food truck se ve atrás, en el retrovisor
    c.strokeStyle = '#8b9096'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, 300); c.lineTo(W / 2, 292); c.stroke();
    c.save(); c.translate(W / 2, 430); c.scale(1.08, 1.08); c.rotate(s.giro * 1.15);                                                                                                                                      // volante: gira de verdad
    c.strokeStyle = '#08080a'; c.lineWidth = 11; c.beginPath(); c.ellipse(0, 0, 58, 26, 0, 0, 7); c.stroke();
    c.strokeStyle = '#3b3d44'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -1.5, 58, 25, 0, Math.PI * 1.05, Math.PI * 1.9); c.stroke();
    c.strokeStyle = '#0d0d10'; c.lineWidth = 6; c.beginPath(); c.moveTo(-54, 2); c.lineTo(-8, 5); c.moveTo(54, 2); c.lineTo(8, 5); c.moveTo(0, 8); c.lineTo(0, 26); c.stroke();
    c.fillStyle = '#c9a24a'; c.beginPath(); c.ellipse(0, 6, 12, 8, 0, 0, 7); c.fill(); c.fillStyle = '#5b4818'; c.beginPath(); c.ellipse(0, 6, 6, 4, 0, 0, 7); c.fill();
    const beb = s.beb == null ? 0 : s.beb < 0.5 ? s.beb / 0.5 : s.beb < 1.9 ? 1 : Math.max(0, (2.4 - s.beb) / 0.5), tilt = beb * beb;
    mano(c, -50, 2, -0.22, 1); if (beb < 0.15) mano(c, 50, 2, 0.22, -1); c.restore();
    const bx = 322 + (W / 2 + 8 - 322) * beb, by = 458 + (404 - 458) * beb; botella(c, bx, by, tilt * 2.25, 1.35 + beb * 0.5);      // la cerveza: en el portavasos, o al aire cuando el Gorila toma
    if (beb > 0.05) { mano(c, bx + (1 - tilt) * 14, by + 14, 0.6 * tilt - 0.3, -1); if (tilt > 0.6) { c.fillStyle = 'rgba(255,230,150,.8)'; for (let i = 0; i < 6; i++) { const q = ((ahora * 1.4 + i * 0.37) % 1); c.beginPath(); c.arc(W / 2 + 20 + i * 6 - 12, 470 - q * 50, 2.2 - q, 0, 7); c.fill(); } } }
    c.restore();
  }

  /* ---------- partida ---------- */
  function partida() {
    raiz.innerHTML = `<div class="jg-juego"><div class="jg-vista"></div>
      <div class="jg-barra" id="jg-barra" role="slider" aria-label="Volante: desliza para girar" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><span class="jg-pista"></span><span class="jg-perilla" id="jg-perilla"></span><span class="jg-flecha izq">‹</span><span class="jg-flecha der">›</span></div>
      <p class="jg-nota">${esc(T.mando)}</p></div>`;
    const { ctx } = lienzo(raiz.querySelector('.jg-vista')), s = estadoInicial(), k = { izq: false, der: false };
    let activo = true, previo = performance.now(), t0 = previo;
    const teclas = { ArrowLeft: 'izq', a: 'izq', A: 'izq', ArrowRight: 'der', d: 'der', D: 'der' };
    const kd = e => { const q = teclas[e.key]; if (q) { k[q] = true; e.preventDefault(); } }, ku = e => { const q = teclas[e.key]; if (q) k[q] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const barra = raiz.querySelector('#jg-barra'), perilla = raiz.querySelector('#jg-perilla');
    const mueve = e => { const r = barra.getBoundingClientRect(); s.arrastre = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)); };
    barra.addEventListener('pointerdown', e => { e.preventDefault(); try { barra.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } barra.classList.add('on'); mueve(e); });
    barra.addEventListener('pointermove', e => { if (barra.classList.contains('on')) mueve(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => barra.addEventListener(ev, () => { barra.classList.remove('on'); s.arrastre = null; }));
    const lienzoEl = raiz.querySelector('.jg-lienzo');
    lienzoEl.addEventListener('pointerdown', e => { const r = lienzoEl.getBoundingClientRect(); s.arrastre = (e.clientX - r.left) / r.width * 2 - 1; });
    lienzoEl.addEventListener('pointermove', e => { if (s.arrastre != null && e.buttons) { const r = lienzoEl.getBoundingClientRect(); s.arrastre = (e.clientX - r.left) / r.width * 2 - 1; } });
    ['pointerup', 'pointercancel'].forEach(ev => lienzoEl.addEventListener(ev, () => { s.arrastre = null; }));
    document.body.classList.add('jg-jugando');
    const terminar = () => { if (!activo) return; activo = false; document.body.classList.remove('jg-jugando'); removeEventListener('keydown', kd); removeEventListener('keyup', ku); resultado(s.puntos); };
    fin = terminar; window.GorilaJeep.cerrar = () => { s.t = DURACION; };   // gancho para pruebas: salta al final de los 40 s
    function paso(dt) {
      if (s.final == null) { s.t += dt; s.vel = 1 + Math.min(0.7, s.t / 60); } else { s.final += dt; s.vel = Math.max(0.25, s.vel - dt * 0.7); }
      s.dist += dt * s.vel; if (s.fade > 0) s.fade = Math.max(0, s.fade - dt * 1.6);
      const dir = (k.der ? 1 : 0) - (k.izq ? 1 : 0);
      if (s.arrastre != null) s.x += (Math.max(-1.1, Math.min(1.1, s.arrastre * 1.4)) - s.x) * Math.min(1, dt * 9); else s.x += dir * dt * 1.9;
      s.x = Math.max(-1.35, Math.min(1.35, s.x));
      const meta = s.arrastre != null ? Math.max(-1, Math.min(1, (s.arrastre * 1.4 - s.x) * 2)) : dir; s.giro += (meta - s.giro) * Math.min(1, dt * 7);
      s.rem += (s.giro - s.rem) * Math.min(1, dt * 2.5); s.mostrado += (s.puntos - s.mostrado) * Math.min(1, dt * 9); s.flash = Math.max(0, s.flash - dt * 3);
      s.sigP -= dt * s.vel; if (s.sigP <= 0) { s.nP++; const r = Math.random(); s.props.push({ k: r < 0.5 ? 'farola' : r < 0.85 ? 'palma' : 'cartel', x: (s.nP % 2 ? 1 : -1) * (1.7 + Math.random() * 0.35), z: 1, fase: Math.random() * 6 }); s.sigP = 0.26 + Math.random() * 0.22; }
      s.props.forEach(o => { o.z -= dt * 0.42 * s.vel; }); s.props = s.props.filter(o => o.z > -0.25); s.rings.forEach(r => { r.t += dt; }); s.rings = s.rings.filter(r => r.t < 0.45);
      if (s.final == null) { if (s.beb != null) { s.beb += dt; if (s.beb > 1.1 && !s.salud) { s.salud = true; s.popups.push({ txt: '¡SALUD!', x: W / 2 + 50, y: 330, t: 0 }); } if (s.beb > 2.4) { s.beb = null; s.salud = false; } } else { s.proxBeb -= dt; if (s.proxBeb <= 0) { s.beb = 0; s.proxBeb = 5.5 + Math.random() * 3; } } }
      s.sacude = Math.max(0, s.sacude - dt * 3); s.comboT -= dt; if (s.comboT <= 0) s.combo = 1;
      s.sig -= dt; if (s.sig <= 0 && s.final == null) { s.sig = 0.35 + Math.random() * 0.5 / s.vel; const tipo = TIPOS[Math.random() < 0.5 ? 0 : Math.floor(Math.random() * TIPOS.length)]; const car = Math.random() < 0.13; s.gente.push({ carrito: car, x: (Math.random() * 2 - 1) * 1.45, z: 1, tipo: car ? CARRITO : tipo, fase: Math.random() * 6, vx: (Math.random() - 0.5) * 0.3 }); }
      for (const g of s.gente) {
        if (g.golpe) { g.t += dt; if (!g.carrito) { g.dx += g.vxv * dt; g.dy += g.vyv * dt; g.vyv -= 520 * dt; g.rot += 9 * dt; } g.z -= dt * 0.25; continue; }
        g.z -= dt * 0.42 * s.vel; g.x += g.vx * dt;
        if (g.z < 0.11 && g.z > -0.02 && Math.abs(g.x - s.x) < (g.carrito ? 0.36 : 0.26)) {
          g.golpe = true; g.t = 0; g.dx = 0; g.dy = 0; g.vxv = (g.x < s.x ? -1 : 1) * 170; g.vyv = 260; g.rot = 0;
          s.combo = Math.min(5, s.combo + (s.comboT > 0 ? 1 : 0)); s.comboT = 2; const pts = g.tipo.pts * s.combo; s.puntos += pts; s.sacude = g.carrito ? 1.7 : 1;
          const py = yDe(1 - g.z), pcx = px(s, g.x, py, 1 - g.z); s.flash = g.carrito ? 0.7 : 0.4; s.rings.push({ x: pcx, y: py - 20, t: 0 }); if (!g.carrito) for (let i = 0; i < 7; i++) { const an = Math.random() * 7, v = 90 + Math.random() * 200; s.parts.push({ x: pcx, y: py - 40, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 120, t: 0, k: i % 2 ? 2 : 0, r: Math.random() * 6 }); }
          if (g.carrito) { for (let i = 0; i < 18; i++) { const an = Math.random() * 7, v = 120 + Math.random() * 260; s.parts.push({ x: pcx, y: py - 40, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 160, t: 0, k: i % 3, r: Math.random() * 6 }); } }
          s.popups.push({ txt: `${g.carrito ? '¡BOOM!' : '¡PUM!'} +${pts}`, x: W / 2 + g.x * 70, y: 270, t: 0 }); navigator.vibrate?.(g.carrito ? [20, 30, 40] : 15);
        }
      }
      s.parts.forEach(q => { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt; q.r += dt * 9; }); s.parts = s.parts.filter(q => q.t < 1);
      s.popups.forEach(p => { p.t += dt; }); s.popups = s.popups.filter(p => p.t < 0.9);
      s.gente = s.gente.filter(g => g.z > -0.3 && !(g.golpe && g.t > 0.8));
    }
    function ciclo(ahora) {
      if (!activo) return;
      const dt = Math.min(0.05, (ahora - previo) / 1000); previo = ahora;
      paso(dt); dibujar(ctx, s, ahora / 1000);
      const pos = s.arrastre != null ? s.arrastre : s.giro; perilla.style.transform = `translateX(${(Math.max(-1, Math.min(1, pos)) * (barra.clientWidth / 2 - 30)).toFixed(1)}px)`;
      if (s.t >= DURACION && s.final == null) { s.final = 0; s.sacude = 0; }
      if (s.final != null && s.final > 3) { terminar(); return; }
      requestAnimationFrame(ciclo);
    }
    raiz.scrollIntoView({ block: 'center', behavior: 'smooth' });
    requestAnimationFrame(ciclo);
  }
  function resultado(puntos) {
    const mejor = lee('gorila_jeep_mejor') || 0, nuevo = puntos > mejor; if (nuevo) guarda('gorila_jeep_mejor', puntos);
    raiz.innerHTML = `<div class="jg-tarjeta jg-fin"><div class="jg-vista jg-sello-caja"></div><div class="jg-texto" role="status"><h3>Territorio conquistado</h3><p class="jg-premio">${puntos} ${esc(T.puntos.toLowerCase())}</p>
      <p>${nuevo && puntos > 0 ? esc(T.nuevo) : `${esc(T.mejor)}: ${Math.max(mejor, puntos)}`}</p>
      <p>El food truck de Gorila también conquista tu evento.</p>
      <a class="btn jg-ir" href="#eventos">Llevar el food truck a mi evento</a> <button type="button" class="btn btn-linea jg-ir" id="jg-otra">${esc(T.otra)}</button> <a class="enlace" href="#carta">${esc(T.pide)}</a></div></div>`;
    const { ctx: cs } = lienzo(raiz.querySelector('.jg-sello-caja')); cs.fillStyle = lin(cs, 0, H, '#12324A', '#0a2234'); cs.fillRect(0, 0, W, H); sello(cs, W / 2, H / 2, 140, 1, -0.2);
    const redibuja = () => { sello(cs, W / 2, H / 2, 140, 1, -0.2); }; if (!logo.complete) logo.addEventListener('load', () => { cs.fillStyle = lin(cs, 0, H, '#12324A', '#0a2234'); cs.fillRect(0, 0, W, H); redibuja(); }, { once: true });
    raiz.querySelector('#jg-otra').onclick = () => partida();
  }
  window.GorilaJeep = { terminar: () => fin() };   // gancho para las pruebas automáticas
  portada();
})();
