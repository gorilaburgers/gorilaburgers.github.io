/* Gorila al volante · mini juego en primera persona (módulo adicional, sin premio ni base de datos). Corre en #juego-raiz y reutiliza los estilos .jg-* de rest-juego.css.
   Un gorila maneja un jeep clásico; la ciudad es de caricatura: los peatones salen volando con un «¡PUM!» (sin sangre) y cada uno suma puntos, con combo.
   Solo lo que se ve: carretera en falsa perspectiva, peatones dibujados por código, capó y volante del jeep. ~40 s por partida; la mejor marca queda en el celular. */
(() => {
  const raiz = document.getElementById('juego-raiz');
  if (!raiz) return;
  const T = Object.assign({ jugar: 'Manejar', lleva: 'Maneja el jeep del Gorila', regla: 'Cada peatón de caricatura que choques suma puntos, y los combos los multiplican. Tienes 40 segundos.',
    fin: '¡Se acabó el tiempo!', puntos: 'Puntos', mejor: 'Tu mejor marca', otra: 'Manejar otra vez', pide: 'Armar mi pedido', nuevo: '¡Nuevo récord!', mando: 'Mueve con las flechas, A y D, o los botones.' }, window.RESTDATA && window.RESTDATA.juego_txt || {});
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lee = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const C = { bg: col('--fx-bg') || '#F3EFD5', deep: col('--fx-deep') || '#12324A', acc: col('--fx-accent') || '#D39B67' };
  const W = 360, H = 480, HOR = 170, DURACION = 40;
  const TIPOS = [{ n: 'Turista', pts: 10, ropa: '#e4572e', alto: 1 }, { n: 'Rockero', pts: 25, ropa: '#2a2f36', alto: 1.05 }, { n: 'Ciclista', pts: 40, ropa: '#2fb36b', alto: 0.9 }, { n: 'Chef', pts: 60, ropa: '#f4f1e8', alto: 1.1 }];
  let fin = () => {};

  function portada() {
    const mejor = lee('gorila_jeep_mejor');
    raiz.innerHTML = `<div class="jg-tarjeta"><div class="jg-vista"></div><div class="jg-texto"><h3>${esc(T.lleva)}</h3><p>${esc(T.regla)}</p>
      ${mejor ? `<p class="jg-nota">${esc(T.mejor)}: ${mejor}</p>` : ''}<button type="button" class="btn jg-ir" id="jg-jugar">${esc(T.jugar)}</button></div></div>`;
    const cv = lienzo(raiz.querySelector('.jg-vista')); dibujar(cv.ctx, estadoInicial(), 0);
    raiz.querySelector('#jg-jugar').onclick = jugar;
  }
  function lienzo(cont) {
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; cv.className = 'jg-lienzo';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Juego: un gorila maneja un jeep clásico y se lleva por delante a peatones de caricatura para sumar puntos.');
    cont.appendChild(cv); const ctx = cv.getContext('2d'); ctx.scale(2, 2); return { cv, ctx };
  }
  const estadoInicial = () => ({ t: 0, x: 0, dist: 0, vel: 1, puntos: 0, combo: 1, comboT: 0, gente: [], popups: [], sacude: 0, sig: 0.3, tipoSig: 0 });

  /* ---------- dibujo ---------- */
  const yDe = p => HOR + (H - HOR) * Math.pow(p, 1.7);                       // p: 0 horizonte … 1 frente al jeep
  const mitadCalle = y => 26 + (y - HOR) * 0.66;
  function dibujar(c, s, ahora) {
    const cielo = c.createLinearGradient(0, 0, 0, HOR); cielo.addColorStop(0, '#12324A'); cielo.addColorStop(1, '#d99a72'); c.fillStyle = cielo; c.fillRect(0, 0, W, HOR);
    c.fillStyle = '#0a2234'; for (let i = 0; i < 9; i++) { const bx = i * 46 - 10, bh = 26 + (i * 37) % 34; c.fillRect(bx, HOR - bh, 38, bh); }   // siluetas de la ciudad
    for (let y = HOR; y < H; y += 2) {                                         // calle y banquetas con franjas que corren
      const p = (y - HOR) / (H - HOR), z = 1 / Math.max(p, 0.02), franja = Math.floor((z * 0.9 + s.dist * 4)) % 2 === 0, m = mitadCalle(y), cx = W / 2;
      c.fillStyle = franja ? '#35404a' : '#3b4752'; c.fillRect(cx - m, y, m * 2, 2);
      c.fillStyle = franja ? '#8a7d6b' : '#9a8d7b'; c.fillRect(0, y, cx - m, 2); c.fillRect(cx + m, y, W - cx - m, 2);
      if (franja) { c.fillStyle = '#f3efd5'; c.fillRect(cx - 1.5 - p * 2, y, 3 + p * 4, 2); }
    }
    s.gente.slice().sort((a, b) => b.z - a.z).forEach(g => persona(c, s, g, ahora));
    s.popups.forEach(p => { c.globalAlpha = Math.max(0, 1 - p.t / 0.9); c.fillStyle = C.bg; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillText(p.txt, p.x, p.y - p.t * 60); c.globalAlpha = 1; });
    jeep(c, s, ahora);
    c.fillStyle = 'rgba(10,34,52,.72)'; c.fillRect(0, 0, W, 34);
    c.fillStyle = C.bg; c.font = '800 15px sans-serif'; c.textAlign = 'left'; c.fillText(`${T.puntos}: ${s.puntos}`, 10, 22);
    c.textAlign = 'center'; c.fillStyle = s.combo > 1 ? C.acc : C.bg; c.fillText(s.combo > 1 ? `COMBO x${s.combo}` : '', W / 2, 22);
    c.textAlign = 'right'; c.fillStyle = C.bg; c.fillText(Math.max(0, Math.ceil(DURACION - s.t)) + ' s', W - 10, 22);
  }
  function persona(c, s, g, ahora) {
    const p = 1 - g.z, y = yDe(p), esc_ = 0.12 + 0.88 * Math.pow(p, 1.3), cx = W / 2 + g.x * mitadCalle(y), a = 112 * esc_ * g.tipo.alto;
    c.save(); c.translate(cx + (g.dx || 0), y - (g.dy || 0)); if (g.golpe) c.rotate(g.rot);
    const paso = Math.sin(ahora * 9 + g.fase) * a * 0.1;
    c.fillStyle = '#1b2026'; c.fillRect(-a * 0.2, -a * 0.34, a * 0.16, a * 0.34 + paso); c.fillRect(a * 0.04, -a * 0.34, a * 0.16, a * 0.34 - paso);
    c.fillStyle = g.tipo.ropa; c.fillRect(-a * 0.26, -a * 0.78, a * 0.52, a * 0.46);
    c.fillStyle = '#f1c9a0'; c.beginPath(); c.arc(0, -a * 0.92, a * 0.17, 0, 7); c.fill();
    if (g.tipo.n === 'Chef') { c.fillStyle = '#fff'; c.fillRect(-a * 0.17, -a * 1.18, a * 0.34, a * 0.16); }
    if (g.tipo.n === 'Rockero') { c.fillStyle = '#e23b7a'; c.fillRect(-a * 0.05, -a * 1.18, a * 0.1, a * 0.14); }
    if (g.tipo.n === 'Ciclista') { c.fillStyle = '#ffd36a'; c.fillRect(-a * 0.2, -a * 1.1, a * 0.4, a * 0.08); }
    if (g.golpe) { c.fillStyle = '#ffd36a'; c.font = `900 ${a * 0.5}px sans-serif`; c.textAlign = 'center'; c.fillText('★', -a * 0.4, -a * 1.1); c.fillText('★', a * 0.4, -a * 0.9); }
    c.restore();
  }
  function jeep(c, s, ahora) {
    const sh = s.sacude > 0 ? Math.sin(ahora * 70) * s.sacude * 7 : 0, g = s.x * 4, bob = Math.sin(ahora * 14 * s.vel) * 0.8;
    c.save(); c.translate(sh, bob);
    c.fillStyle = '#4a5a2a'; c.beginPath(); c.moveTo(60, H); c.lineTo(110, 372); c.lineTo(250, 372); c.lineTo(300, H); c.closePath(); c.fill();   // capó
    c.fillStyle = '#5d7035'; c.beginPath(); c.moveTo(110, 372); c.lineTo(250, 372); c.lineTo(262, 392); c.lineTo(98, 392); c.closePath(); c.fill();
    c.fillStyle = '#e8e0b0'; for (const lx of [92, 268]) { c.beginPath(); c.arc(lx, 398, 17, 0, 7); c.fill(); c.strokeStyle = '#2a3318'; c.lineWidth = 4; c.stroke(); }  // faros redondos
    c.fillStyle = '#1b2026'; c.fillRect(0, 300, 14, 180); c.fillRect(W - 14, 300, 14, 180); c.fillRect(0, 300, W, 8);                                      // marco del parabrisas
    c.fillStyle = '#26282c'; c.fillRect(0, 438, W, 42);                                                                                                  // tablero
    c.save(); c.translate(W / 2, 448); c.rotate(g * 0.35); c.strokeStyle = '#111'; c.lineWidth = 9; c.beginPath(); c.ellipse(0, 0, 52, 24, 0, 0, 7); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(-52, 0); c.lineTo(52, 0); c.moveTo(0, 0); c.lineTo(0, 24); c.stroke();
    for (const hx of [-44, 44]) { c.fillStyle = '#3a2a22'; c.beginPath(); c.arc(hx, 0, 15, 0, 7); c.fill(); c.fillStyle = '#5a4234'; c.beginPath(); c.arc(hx - 3, -4, 9, 0, 7); c.fill(); }   // manos peludas de gorila
    c.restore();
    c.fillStyle = '#1b2026'; c.beginPath(); c.roundRect ? c.roundRect(W / 2 - 46, 308, 92, 52, 10) : c.rect(W / 2 - 46, 308, 92, 52); c.fill();            // retrovisor con el gorila
    c.fillStyle = '#2a2f36'; c.beginPath(); c.arc(W / 2, 336, 17, 0, 7); c.fill(); c.fillStyle = '#e8d9c4'; c.beginPath(); c.ellipse(W / 2, 340, 10, 8, 0, 0, 7); c.fill();
    c.fillStyle = '#1b2026'; c.fillRect(W / 2 - 7, 331, 3, 4); c.fillRect(W / 2 + 4, 331, 3, 4);
    c.restore();
  }

  /* ---------- partida ---------- */
  function jugar() {
    raiz.innerHTML = `<div class="jg-juego"><div class="jg-vista"></div>
      <div class="jg-mando" aria-label="Controles"><div class="jg-dir"><button type="button" data-k="izq" aria-label="Izquierda"><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" data-k="der" aria-label="Derecha"><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button></div></div>
      <p class="jg-nota">${esc(T.mando)}</p></div>`;
    const { ctx } = lienzo(raiz.querySelector('.jg-vista')), s = estadoInicial(), k = { izq: false, der: false };
    let activo = true, previo = performance.now(), t0 = previo;
    const teclas = { ArrowLeft: 'izq', a: 'izq', A: 'izq', ArrowRight: 'der', d: 'der', D: 'der' };
    const kd = e => { const q = teclas[e.key]; if (q) { k[q] = true; e.preventDefault(); } }, ku = e => { const q = teclas[e.key]; if (q) k[q] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    raiz.querySelectorAll('.jg-mando button').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } k[b.dataset.k] = true; b.classList.add('on'); });
      const suelta = () => { k[b.dataset.k] = false; b.classList.remove('on'); }; ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, suelta));
    });
    const lienzoEl = raiz.querySelector('.jg-lienzo');
    lienzoEl.addEventListener('pointerdown', e => { const r = lienzoEl.getBoundingClientRect(); s.arrastre = (e.clientX - r.left) / r.width * 2 - 1; });
    lienzoEl.addEventListener('pointermove', e => { if (s.arrastre != null && e.buttons) { const r = lienzoEl.getBoundingClientRect(); s.arrastre = (e.clientX - r.left) / r.width * 2 - 1; } });
    ['pointerup', 'pointercancel'].forEach(ev => lienzoEl.addEventListener(ev, () => { s.arrastre = null; }));
    document.body.classList.add('jg-jugando');
    const terminar = () => { if (!activo) return; activo = false; document.body.classList.remove('jg-jugando'); removeEventListener('keydown', kd); removeEventListener('keyup', ku); resultado(s.puntos); };
    fin = terminar;
    function paso(dt) {
      s.t += dt; s.vel = 1 + Math.min(0.7, s.t / 60); s.dist += dt * s.vel;
      const dir = (k.der ? 1 : 0) - (k.izq ? 1 : 0);
      if (s.arrastre != null) s.x += (Math.max(-1.1, Math.min(1.1, s.arrastre * 1.4)) - s.x) * Math.min(1, dt * 9); else s.x += dir * dt * 1.9;
      s.x = Math.max(-1.35, Math.min(1.35, s.x));
      s.sacude = Math.max(0, s.sacude - dt * 3); s.comboT -= dt; if (s.comboT <= 0) s.combo = 1;
      s.sig -= dt; if (s.sig <= 0) { s.sig = 0.35 + Math.random() * 0.5 / s.vel; const tipo = TIPOS[Math.random() < 0.5 ? 0 : Math.floor(Math.random() * TIPOS.length)]; s.gente.push({ x: (Math.random() * 2 - 1) * 1.45, z: 1, tipo, fase: Math.random() * 6, vx: (Math.random() - 0.5) * 0.3 }); }
      for (const g of s.gente) {
        if (g.golpe) { g.t += dt; g.dx += g.vxv * dt; g.dy += g.vyv * dt; g.vyv -= 520 * dt; g.rot += 9 * dt; g.z -= dt * 0.25; continue; }
        g.z -= dt * 0.42 * s.vel; g.x += g.vx * dt;
        if (g.z < 0.11 && g.z > -0.02 && Math.abs(g.x - s.x) < 0.26) {
          g.golpe = true; g.t = 0; g.dx = 0; g.dy = 0; g.vxv = (g.x < s.x ? -1 : 1) * 170; g.vyv = 260; g.rot = 0;
          s.combo = Math.min(5, s.combo + (s.comboT > 0 ? 1 : 0)); s.comboT = 2; const pts = g.tipo.pts * s.combo; s.puntos += pts; s.sacude = 1;
          s.popups.push({ txt: `¡PUM! +${pts}`, x: W / 2 + g.x * 70, y: 330, t: 0 }); navigator.vibrate?.(15);
        }
      }
      s.popups.forEach(p => { p.t += dt; }); s.popups = s.popups.filter(p => p.t < 0.9);
      s.gente = s.gente.filter(g => g.z > -0.3 && !(g.golpe && g.t > 0.8));
    }
    function ciclo(ahora) {
      if (!activo) return;
      const dt = Math.min(0.05, (ahora - previo) / 1000); previo = ahora;
      paso(dt); dibujar(ctx, s, ahora / 1000);
      if (s.t >= DURACION) { terminar(); return; }
      requestAnimationFrame(ciclo);
    }
    raiz.scrollIntoView({ block: 'center', behavior: 'smooth' });
    requestAnimationFrame(ciclo);
  }
  function resultado(puntos) {
    const mejor = lee('gorila_jeep_mejor') || 0, nuevo = puntos > mejor; if (nuevo) guarda('gorila_jeep_mejor', puntos);
    raiz.innerHTML = `<div class="jg-tarjeta jg-fin"><div class="jg-texto" role="status"><h3>${esc(T.fin)}</h3><p class="jg-premio">${puntos} ${esc(T.puntos.toLowerCase())}</p>
      <p>${nuevo && puntos > 0 ? esc(T.nuevo) : `${esc(T.mejor)}: ${Math.max(mejor, puntos)}`}</p>
      <button type="button" class="btn jg-ir" id="jg-otra">${esc(T.otra)}</button> <a class="btn btn-linea jg-ir" href="#carta">${esc(T.pide)}</a></div></div>`;
    raiz.querySelector('#jg-otra').onclick = jugar;
  }
  window.GorilaJeep = { terminar: () => fin() };   // gancho para las pruebas automáticas
  portada();
})();
