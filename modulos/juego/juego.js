/* modulos/juego/juego.js · mini juego con ranking (demo del módulo: el ranking vive solo en este navegador).
   Configuración: window.JUEGO (la genera nuevo-cliente.py desde cliente.json → modulos.juego).
   Si el premio va al 1.º hace falta el esquema SQL anti-trampa (CLAUDE.md §3): esto es solo la demo. */
(() => {
  const J = window.JUEGO; if (!J) return;
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = document.getElementById('tablero'), pan = document.getElementById('pan'), pila = document.getElementById('pila');
  const pant = document.getElementById('pantalla'), ptsEl = document.getElementById('pts'), segEl = document.getElementById('seg');
  const TIPOS = J.tipos;
  const CLAVE = J.claveRanking, EJ = J.ejemplos;
  let W, H, px, vx = 0, objetivo = null, items = [], pts = 0, t0, ult, spawn, jugando = false, racha = 0;
  const medir = () => { W = T.clientWidth; H = T.clientHeight; };
  const rank = () => { let r = []; try { r = JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) {}
    const todos = [...r.map(x => [x.n, x.p, true]), ...EJ.map(x => [...x, false])].sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('rank').innerHTML = todos.map(([n, p, real]) => `<li><span>${esc(n)}${real ? '' : ' <span class="chip-ej">ejemplo</span>'}</span><b>${p}</b></li>`).join(''); };
  function inicio() {
    pant.innerHTML = `<div><h3>${esc(J.textos.listo)}</h3><p>${esc(J.textos.mover)}</p><button type="button" class="btn" id="jugar">${esc(J.textos.jugar)}</button></div>`;
    document.getElementById('jugar').onclick = jugar;
  }
  function jugar() {
    medir(); items.forEach(i => i.el.remove()); items = []; pila.innerHTML = ''; pts = 0; racha = 0; ptsEl.textContent = 0;
    px = (W - 96) / 2; pant.hidden = true; jugando = true; t0 = ult = performance.now(); spawn = 0; T.focus(); requestAnimationFrame(bucle);
  }
  function flotar(txt, x) { const f = document.createElement('div'); f.className = 'flotante'; f.textContent = txt; f.style.left = x + 'px'; f.style.bottom = '90px'; T.append(f); setTimeout(() => f.remove(), 700); }
  function crear(prog) {
    const malo = Math.random() < .22, ti = TIPOS[Math.floor(Math.random() * TIPOS.length)];
    const el = document.createElement('div'); el.className = 'ing' + (malo ? ' malo' : ''); el.textContent = malo ? J.malo : ti.nombre;
    if (!malo) { el.style.background = ti.fondo || ti.color; if (ti.texto) el.style.color = ti.texto; }
    const w = malo ? 56 : 64; T.append(el);
    items.push({ el, x: Math.random() * (W - w), y: -30, w, v: 170 + prog * 190 + Math.random() * 40, malo, color: ti.color });
  }
  function bucle(now) {
    if (!jugando) return;
    const dt = Math.min(.05, (now - ult) / 1000), trans = (now - t0) / 1000, prog = trans / 30; ult = now;
    const rest = Math.max(0, 30 - trans); segEl.textContent = Math.ceil(rest);
    spawn -= dt; if (spawn <= 0) { crear(prog); spawn = .65 - prog * .28; }
    if (objetivo != null) px += (objetivo - 48 - px) * Math.min(1, dt * 14);
    px += vx * dt * 520; px = Math.max(0, Math.min(W - 96, px));
    pan.style.transform = `translateX(${px}px)`;
    const topPan = H - 14 - 22 - pila.childElementCount * 9;
    items = items.filter(it => {
      it.y += it.v * dt;
      if (it.y + 22 >= topPan && it.y < topPan + 20 && it.x + it.w > px + 6 && it.x < px + 90) {
        it.el.remove();
        if (it.malo) { pts = Math.max(0, pts - 15); racha = 0; pila.innerHTML = ''; pan.classList.remove('golpe'); void pan.offsetWidth; pan.classList.add('golpe'); flotar('−15', px + 30); }
        else { pts += 10; racha++; const c = document.createElement('div'); c.className = 'capa'; c.style.background = it.color; pila.append(c); flotar('+10', px + 30);
          if (racha % 6 === 0) { pts += 30; flotar(J.textos.completa, Math.max(0, px - 40)); setTimeout(() => pila.innerHTML = '', 250); } }
        ptsEl.textContent = pts; return false;
      }
      if (it.y > H) { it.el.remove(); return false; }
      it.el.style.transform = `translate(${it.x}px, ${it.y}px)`; return true;
    });
    if (rest <= 0) return fin();
    requestAnimationFrame(bucle);
  }
  function fin() {
    jugando = false; vx = 0; objetivo = null; pant.hidden = false;
    pant.innerHTML = `<div><h3>${pts} puntos</h3><p>${esc(J.textos.guardarInfo)}</p>
      <input id="nom" maxlength="20" placeholder="Tu nombre" aria-label="Tu nombre para el ranking"><br>
      <button type="button" class="btn" id="guardar">Guardar puntaje</button> <button type="button" class="btn btn-linea" id="otra">Jugar otra vez</button></div>`;
    document.getElementById('otra').onclick = jugar;
    document.getElementById('guardar').onclick = () => {
      const n = document.getElementById('nom').value.trim(); if (!n) { document.getElementById('nom').focus(); return; }
      try { const r = JSON.parse(localStorage.getItem(CLAVE) || '[]'); r.push({ n, p: pts }); localStorage.setItem(CLAVE, JSON.stringify(r.slice(-20))); } catch (e) {}
      rank(); inicio();
    };
  }
  T.addEventListener('pointerdown', e => { if (!jugando) return; const r = T.getBoundingClientRect(); objetivo = e.clientX - r.left; T.setPointerCapture(e.pointerId); });
  T.addEventListener('pointermove', e => { if (objetivo == null) return; const r = T.getBoundingClientRect(); objetivo = e.clientX - r.left; });
  ['pointerup', 'pointercancel'].forEach(ev => T.addEventListener(ev, () => objetivo = null));
  T.addEventListener('keydown', e => { if (!jugando) return; if (e.key === 'ArrowLeft') { vx = -1; e.preventDefault(); } if (e.key === 'ArrowRight') { vx = 1; e.preventDefault(); } });
  T.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') vx = 0; });
  [['izq', -1], ['der', 1]].forEach(([id, d]) => { const b = document.getElementById(id);
    b.addEventListener('pointerdown', () => vx = d); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => vx = 0)); });
  window.addEventListener('resize', medir);
  medir(); rank(); inicio();
})();
