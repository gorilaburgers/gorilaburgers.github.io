/* Módulo de restaurante · insumos, recetas y desglose por venta (módulo adicional: solo se copia si el cliente tiene restaurante.insumos).
   Lo usan el dashboard del dueño (bodega, qué salió, recetas, desglose de cada movimiento) y la pantalla de ventas (qué salió de cada venta y ticket de cocina de los pedidos web).
   Todo texto que viene de la base se inserta con esc(). Las cantidades las calcula la base (008_insumos.sql); aquí solo se muestran. */
(() => {
  const R = window.RESTDATA;
  if (!R || !R.insumos || !window.RUI) return;
  const { $, $$, esc, num, aviso, tooltip } = window.RUI;
  const redondo = n => Math.round(n * 10) / 10;
  const cant = (n, u) => u === 'gr' ? `${num(redondo(n))} gr` : num(redondo(n));
  const chip = x => `<li><b>${cant(x.cantidad, x.unidad)}</b> ${esc(x.nombre)}</li>`;

  /* ---------- desglose de una venta: qué salió de bodega, por línea y en total ---------- */
  const cache = new Map(), abiertos = new Set(), FALTA = /could not find|schema cache|does not exist|no está disponible/i;   // la base aún no tiene 008_insumos.sql: la pantalla sigue igual que antes
  function html(d, compacto) {
    if (!d) return '';
    const lineas = d.lineas.map(l => `<div class="ins-linea"><h4>${l.cantidad}× ${esc(l.nombre)}</h4>${l.insumos.length ? `<ul class="ins-chips">${l.insumos.map(chip).join('')}</ul>` : '<p class="ins-vacio">Sin receta cargada: no descuenta bodega.</p>'}</div>`).join('');
    return `<div class="ins-desglose${compacto ? ' compacto' : ''}">
      <p class="ins-tit">${d.previsto ? 'Para preparar (receta vigente)' : 'Lo que salió de bodega'}</p>${lineas}
      ${d.total.length ? `<div class="ins-total"><h4>${d.previsto ? 'Total a usar' : 'Total de la venta'}</h4><ul class="ins-chips">${d.total.map(chip).join('')}</ul></div>` : ''}</div>`;
  }
  async function cargarVenta(id) { const r = await window.REST.rpc('venta_desglose', { p_id: id }); cache.set(id, r.desglose); return r.desglose; }
  async function alternar(id) {
    if (abiertos.has(id)) { abiertos.delete(id); return false; }
    abiertos.add(id); try { await cargarVenta(id); } catch (e) { abiertos.delete(id); aviso(e.message, true); return false; } return true;
  }
  async function pendientes() {
    try { const m = new Map(); (await window.REST.rpc('desglose_pendientes')).forEach(x => m.set(x.id, x.desglose)); window.INS.ok = true; return m; }
    catch (e) { if (FALTA.test(e.message)) window.INS.ok = false; return new Map(); }
  }
  const boton = id => window.INS && window.INS.ok === false ? '' : `<button type="button" class="ins-ver" data-ins="${id}" aria-expanded="${abiertos.has(id)}">${abiertos.has(id) ? 'Ocultar lo que salió' : 'Ver lo que salió'}</button>`;
  const bloque = id => abiertos.has(id) ? html(cache.get(id)) : '';
  window.INS = { html, cache, abiertos, alternar, pendientes, boton, bloque, cargarVenta, cant };

  /* ---------- dashboard del dueño ---------- */
  const raiz = $('#rd-bodega');
  if (!raiz) return;
  const ESTADO = { ok: ['●', 'Hay'], bajo: ['▲', 'Poco'], agotado: ['■', 'Agotado'], sin_cargar: ['○', 'Sin cargar'] };
  const COLOR = { ok: 'var(--d-ok)', bajo: 'var(--d-aviso)', agotado: 'var(--d-crit)' };
  let estado = [], periodo = 'hoy', cons = null, receta = { insumos: [], recetas: [] }, filtro = 'todo', armado = '';
  const draft = new Map(), ULT = 'rd_ultimo_ingredientes';

  /* ---- carga de la mañana: una tarjeta grande por ingrediente, con + y − (lo que hay ahora: «10 carnes, 30 quesos…») ----
     El borrador vive en el navegador hasta tocar «Guardar»: la base recibe solo lo que cambió, como un conteo («hay esto»). */
  const base = i => i.estado === 'sin_cargar' ? null : i.saldo;
  const actual = i => draft.has(i.clave) ? draft.get(i.clave) : (base(i) == null ? 0 : base(i));
  const paso = i => i.unidad === 'gr' ? 100 : 1;
  const rapidos = i => i.unidad === 'uni' ? [[5, '+5'], [10, '+10'], [20, '+20']]
    : i.empaque_cant ? [[500, '+500'], [1000, '+1.000'], [i.empaque_cant, `+1 ${esc(i.empaque_nombre || 'empaque')}`]] : [[100, '+100'], [500, '+500'], [1000, '+1.000']];
  const unidadTxt = i => i.unidad === 'gr' ? 'gramos' : 'unidades';
  const limpio = n => Math.max(0, Math.min(1000000, Math.round((Number(n) || 0) * 100) / 100));
  const cantEmp = i => i.empaque_cant ? ` · ${redondo(i.saldo / i.empaque_cant)} ${esc(i.empaque_nombre || 'empaque')}${redondo(i.saldo / i.empaque_cant) === 1 ? '' : 's'}` : '';

  function pintarKpis() {
    const n = estado.length, ag = estado.filter(i => i.estado === 'agotado').length, ba = estado.filter(i => i.estado === 'bajo').length, sin = estado.filter(i => i.estado === 'sin_cargar').length,
      pocos = estado.filter(i => i.alcanza_dias != null && i.alcanza_dias < 2 && i.estado !== 'agotado').length;
    window.INS.alertas = { agotados: ag, bajos: ba, sinCargar: sin };
    const k = [['Ingredientes controlados', n, 'En la bodega', ''], ['Con poco o agotados', ag + ba, ag ? `${ag} agotado${ag > 1 ? 's' : ''}` : 'Revisa y compra', ag + ba ? 'alerta' : 'ok'],
      ['Alcanzan menos de 2 días', pocos, 'Según lo que se gasta', pocos ? 'aviso' : ''], ['Sin cargar', sin, sin ? 'Cuéntalos con + o escribe cuánto hay' : 'Todo contado', sin ? 'aviso' : 'ok']];
    $('#bo-kpis').innerHTML = k.map(([a, b, c, cl]) => `<article class="rest-tarjeta rd-kpi ${cl}"><span class="rotulo">${a}</span><span class="valor">${b}</span><span class="pie">${c}</span></article>`).join('');
    const f = { todo: n, atencion: ag + ba, sin_cargar: sin };
    $$('#bo-filtros .rd-chipf').forEach(b => { b.setAttribute('aria-pressed', b.dataset.f === filtro); b.dataset.n = f[b.dataset.f]; });
    if (window.RD) window.RD.alertas();
  }
  function pintarCambios() {
    const cs = estado.filter(i => draft.has(i.clave)), bar = $('#bo-guardar');
    bar.hidden = !cs.length;
    $('#bo-cambios').innerHTML = cs.length ? `<b>${cs.length} cambio${cs.length > 1 ? 's' : ''} sin guardar:</b> ` + cs.map(i => { const b = base(i), v = draft.get(i.clave); return b == null ? `${esc(i.nombre)} → ${cant(v, i.unidad)}` : `${esc(i.nombre)} ${cant(b, i.unidad)} → ${cant(v, i.unidad)}`; }).join(' · ') : '';
    $$('.sk-card', $('#bo-grid')).forEach(c => {
      const i = estado.find(x => x.clave === c.dataset.k); if (!i) return; const on = draft.has(i.clave), dl = $('[data-r="delta"]', c);
      c.classList.toggle('cambio', on); dl.hidden = !on;
      if (on) { const b = base(i), v = draft.get(i.clave), dif = v - (b || 0); dl.textContent = b == null ? `Se marcará: hay ${cant(v, i.unidad)}` : `${cant(b, i.unidad)} → ${cant(v, i.unidad)} (${dif >= 0 ? '+' : ''}${cant(dif, i.unidad)})`; }
    });
  }
  function poner(i, n) {
    n = limpio(n); const b = base(i);
    if (b != null && Math.abs(n - b) < 0.005) draft.delete(i.clave); else if (b == null && n === 0 && !draft.has(i.clave)) draft.delete(i.clave); else draft.set(i.clave, n);
    const inp = $(`.sk-card[data-k="${CSS.escape(i.clave)}"] input`, $('#bo-grid')); if (inp) inp.value = draft.has(i.clave) ? draft.get(i.clave) : (b == null ? '' : b);
    pintarCambios();
  }
  function pintarBodega() {
    pintarKpis();
    const bajos = estado.filter(i => i.estado === 'bajo' || i.estado === 'agotado').length, sin = estado.filter(i => i.estado === 'sin_cargar').length;
    $('#bo-sub').textContent = sin ? `${sin} ingrediente${sin > 1 ? 's' : ''} sin contar. Toca + o escribe cuánto hay en la cocina.` : bajos ? `${bajos} con poco o sin existencias.` : 'Todo con existencias. Lo que se vende baja solo, según la receta.';
    $('#bo-n').hidden = !bajos; $('#bo-n').textContent = bajos;
    const prio = { agotado: 0, bajo: 1, sin_cargar: 2, ok: 3 }, llave = estado.map(i => i.clave).join(), pasa = i => filtro === 'todo' || (filtro === 'atencion' ? i.estado === 'agotado' || i.estado === 'bajo' : i.estado === filtro);
    if (armado !== llave) {                                                          // se arma una sola vez: así no se pierde lo que se está escribiendo
      armado = llave; draft.clear();
      const orden = estado.map((i, n) => ({ i, n })).sort((a, b) => prio[a.i.estado] - prio[b.i.estado] || a.n - b.n).map(x => x.i);
      $('#bo-grid').innerHTML = orden.map(i => `<article class="sk-card" data-k="${esc(i.clave)}"><header><h3>${esc(i.nombre)}</h3><span class="rd-estado" data-r="estado"></span></header>
        <div class="sk-quedan"><b data-r="saldo">—</b><span data-r="unid"></span></div><div class="pista" aria-hidden="true"><i data-r="barra"></i></div>
        <p class="sk-det" data-r="det"></p>
        <div class="sk-ctrl"><span class="sk-lab" id="bk-l-${esc(i.clave)}">Hay ahora</span>
          <div class="sk-paso" role="group" aria-labelledby="bk-l-${esc(i.clave)}"><button type="button" data-acc="menos" aria-label="Quitar de ${esc(i.nombre)}">−</button><input type="number" inputmode="decimal" min="0" max="1000000" step="any" data-r="in" aria-label="Cuánto hay de ${esc(i.nombre)}" placeholder="0"><button type="button" data-acc="mas" aria-label="Subir ${esc(i.nombre)}">+</button></div>
          <div class="sk-rap" aria-label="Subir de golpe">${rapidos(i).map(([n, t]) => `<button type="button" data-n="${n}">${t}</button>`).join('')}</div>
          <p class="sk-delta" data-r="delta" hidden></p></div></article>`).join('');
    }
    estado.forEach(i => {
      const c = $(`.sk-card[data-k="${CSS.escape(i.clave)}"]`, $('#bo-grid')); if (!c) return;
      const f = i.minimo ? Math.max(0, Math.min(1, i.saldo / (i.minimo * 3))) : (i.saldo > 0 ? 1 : 0), col = COLOR[i.estado] || 'var(--d-mut)', [ic, tx] = ESTADO[i.estado], r = k => $(`[data-r="${k}"]`, c);
      c.className = 'sk-card ' + i.estado + (draft.has(i.clave) ? ' cambio' : ''); c.hidden = !pasa(i);
      r('estado').className = 'rd-estado ' + (i.estado === 'sin_cargar' ? 'sin_definir' : i.estado); r('estado').textContent = `${ic} ${tx}`;
      r('saldo').textContent = i.estado === 'sin_cargar' ? '—' : num(redondo(i.saldo)); r('unid').textContent = unidadTxt(i) + (i.estado === 'sin_cargar' ? '' : cantEmp(i));
      r('barra').style.width = (i.estado === 'sin_cargar' ? 0 : f * 100) + '%'; r('barra').style.background = col;
      r('det').innerHTML = i.estado === 'sin_cargar' ? 'Todavía no lo cuentas: toca + o escribe cuánto hay.'
        : `Salió hoy <b>${cant(i.hoy, i.unidad)}</b>${i.alcanza_dias != null ? ` · alcanza <b>${i.alcanza_dias < 1 ? 'menos de 1 día' : redondo(i.alcanza_dias) + ' día' + (i.alcanza_dias === 1 ? '' : 's')}</b>` : ''}${i.minimo ? ` · avisa bajo ${cant(i.minimo, i.unidad)}` : ''}`;
      const inp = r('in'); if (document.activeElement !== inp) inp.value = draft.has(i.clave) ? draft.get(i.clave) : (base(i) == null ? '' : base(i));
    });
    $('#bo-vacio').hidden = estado.some(pasa);
    const sel = $('#bo-insumo'), previo = sel.value;
    if (sel.options.length !== estado.length) { sel.innerHTML = estado.map(i => `<option value="${esc(i.clave)}">${esc(i.nombre)}</option>`).join(''); if (previo) sel.value = previo; actualizarUnidad(); }
    pintarCambios(); pintarAlcance();
  }
  function actualizarUnidad() {
    const i = estado.find(x => x.clave === $('#bo-insumo').value); if (!i) return;
    const u = $('#bo-unidad'); u.innerHTML = `<option value="1">${i.unidad === 'gr' ? 'gramos' : 'unidades'}</option>` + (i.empaque_cant ? `<option value="${i.empaque_cant}">${esc(i.empaque_nombre || 'empaque')}s de ${num(i.empaque_cant)} ${i.unidad === 'gr' ? 'gr' : 'uni'}</option>` : '');
    if (i.empaque_cant) u.selectedIndex = 1;
  }
  async function bodega() {
    if (document.hidden) return;
    try { estado = await window.REST.rpc('insumos_estado'); window.INS.ok = true; raiz.hidden = false; pintarBodega(); } catch (e) { if (FALTA.test(e.message)) { window.INS.ok = false; raiz.hidden = true; } }
  }

  /* ---- «Qué se vende»: cuántas hamburguesas más alcanzan con los ingredientes que hay (menor cantidad posible entre todos sus ingredientes) ---- */
  function alcanceDe(clave) {
    const items = receta.recetas.filter(r => r.producto === clave); if (!items.length) return null;
    let min = Infinity, lim = null; const falta = [];
    items.forEach(r => { const i = estado.find(x => x.clave === r.insumo); if (!i) return; if (i.estado === 'sin_cargar') { falta.push(i.nombre); return; }
      const n = Math.floor(Math.max(0, i.saldo) / r.cantidad + 1e-9); if (n < min) { min = n; lim = i.nombre; } });
    return { n: min === Infinity ? null : min, lim, falta };
  }
  let armadoAl = '';
  function pintarAlcance() {
    const g = $('#al-grid'), d = window.RD && window.RD.datos(); if (!g || !d || !estado.length || !receta.recetas.length) return;
    const ps = d.productos.filter(p => p.categoria !== 'extras' && p.categoria !== 'bebidas').map(p => ({ p, a: alcanceDe(p.clave) })).filter(x => x.a);
    const maxN = Math.max(1, ...ps.map(x => x.a.n || 0)), umbral = Math.max(R.stock_bajo || 5, 10);
    g.innerHTML = ps.sort((x, y) => y.p.vendidas - x.p.vendidas).map(({ p, a }) => {
      const est = a.n == null ? 'sin_cargar' : a.n <= 0 ? 'agotado' : a.n <= umbral ? 'bajo' : 'ok', [ic, tx] = ESTADO[est];
      return `<article class="sk-card ${est}"><header><h3>${esc(p.nombre)}</h3><span class="rd-estado ${est === 'sin_cargar' ? 'sin_definir' : est}">${ic} ${tx}</span></header>
        <div class="sk-quedan"><b>${a.n == null ? '—' : a.n}</b><span>${a.n == null ? 'faltan datos' : a.n === 1 ? 'alcanza' : 'alcanzan'}</span></div><div class="pista" aria-hidden="true"><i style="width:${a.n == null ? 0 : Math.min(1, a.n / maxN) * 100}%;background:${COLOR[est] || 'var(--d-mut)'}"></i></div>
        <p class="sk-det"><b>${p.vendidas}</b> vendida${p.vendidas === 1 ? '' : 's'} hoy${a.lim && a.n != null ? ` · se acaba antes: <b>${esc(a.lim)}</b>` : ''}${a.falta.length ? `<br>Falta contar: ${esc(a.falta.slice(0, 3).join(', '))}${a.falta.length > 3 ? '…' : ''}` : ''}</p></article>`;
    }).join('');
    const agot = ps.filter(x => x.a.n === 0).length, bajos = ps.filter(x => x.a.n != null && x.a.n > 0 && x.a.n <= umbral).length;
    $('#al-sub').textContent = agot ? `${agot} sin ingredientes para hacerla: revisa la bodega.` : bajos ? `${bajos} con pocas por hacer.` : 'Calculado con los ingredientes que cargaste en la bodega.';
  }

  /* qué salió: hoy, 7 días o el mes, con el detalle por producto */
  const iso = d => d.toISOString().slice(0, 10);
  function rango() {
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: window.RUI.TZ })), hasta = iso(new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())));
    const desde = periodo === 'hoy' ? hasta : periodo === 'semana' ? iso(new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 6))) : iso(new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1)));
    return [desde, hasta];
  }
  const abiertosCons = new Set();
  function pintarConsumo() {
    if (!cons) return;
    const pp = {}; cons.por_producto.forEach(x => (pp[x.insumo] = pp[x.insumo] || []).push(x));
    $('#co-lista').innerHTML = cons.por_insumo.length ? cons.por_insumo.map(i => {
      const det = pp[i.insumo] || [], abierto = abiertosCons.has(i.insumo), emp = i.empaque_cant ? ` <small>(${redondo(i.consumido / i.empaque_cant)} ${esc(i.empaque_nombre || 'empaque')}s)</small>` : '';
      return `<li><button type="button" class="co-fila" data-co="${esc(i.insumo)}" aria-expanded="${abierto}"><span>${esc(i.nombre)}</span><b>${cant(i.consumido, i.unidad)}${emp}</b></button>
        ${abierto ? `<ul class="co-det">${det.map(x => `<li><span>${esc(x.nombre)}</span><b>${cant(x.cantidad, i.unidad)}</b></li>`).join('')}</ul>` : ''}</li>`; }).join('')
      : '<li class="rest-sub">Todavía no salió nada en este período.</li>';
  }
  async function consumo() {
    if (document.hidden) return;
    try { const [d, h] = rango(); cons = await window.REST.rpc('consumo_periodo', { p_desde: d, p_hasta: h }); pintarConsumo(); } catch (e) { /* se reintenta */ }
  }

  /* recetas */
  function pintarReceta() {
    const sel = $('#re-producto'), ps = R.productos.filter(p => p.categoria !== 'bebidas');
    if (!sel.options.length) {
      const claves = new Set(ps.map(p => p.clave)), extra = [...new Set(receta.recetas.map(r => r.producto))].filter(k => !claves.has(k));
      sel.innerHTML = ps.map(p => `<option value="${esc(p.clave)}">${esc(p.nombre)}</option>`).join('') + extra.map(k => `<option value="${esc(k)}">${esc(k)} (aún no está en la carta)</option>`).join('');
    }
    const act = {}; receta.recetas.filter(r => r.producto === sel.value).forEach(r => { act[r.insumo] = r.cantidad; });
    $('#re-campos').innerHTML = receta.insumos.filter(i => i.activo !== false).map(i => `<label class="rest-campo">${esc(i.nombre)} <small>${i.unidad === 'gr' ? 'gr' : 'uni'}</small>
      <input type="number" min="0" step="any" inputmode="decimal" name="${esc(i.clave)}" value="${act[i.clave] ?? ''}" placeholder="—"></label>`).join('');
  }
  async function recetas() { try { receta = await window.REST.rpc('recetas_admin'); pintarReceta(); pintarAlcance(); } catch (e) { /* se reintenta */ } }

  /* ---- eventos ---- */
  $('#bo-abrir').onclick = () => { const f = $('#bo-form'); f.hidden = !f.hidden; if (!f.hidden) { actualizarUnidad(); $('#bo-tipo').value = 'merma'; $('#bo-tipo').onchange({ target: $('#bo-tipo') }); $('#bo-cantidad').focus(); } };
  $$('#bo-filtros .rd-chipf').forEach(b => b.onclick = () => { filtro = b.dataset.f; pintarBodega(); });
  $('#bo-x').onclick = () => { $('#bo-form').hidden = true; };
  $('#bo-insumo').onchange = actualizarUnidad;
  $('#bo-grid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const c = b.closest('.sk-card'), i = estado.find(x => x.clave === c.dataset.k); if (!i) return;
    if (b.dataset.acc) poner(i, actual(i) + (b.dataset.acc === 'mas' ? paso(i) : -paso(i))); else if (b.dataset.n) poner(i, actual(i) + parseFloat(b.dataset.n));
  });
  $('#bo-grid').addEventListener('input', e => {
    const inp = e.target.closest('input'); if (!inp) return; const i = estado.find(x => x.clave === inp.closest('.sk-card').dataset.k); if (!i) return;
    const v = limpio(inp.value === '' ? 0 : parseFloat(inp.value)), b = base(i); if (b != null && Math.abs(v - b) < 0.005) draft.delete(i.clave); else draft.set(i.clave, v); pintarCambios();
  });
  $('#bo-grid').addEventListener('change', e => { const inp = e.target.closest('input'); if (!inp) return; const i = estado.find(x => x.clave === inp.closest('.sk-card').dataset.k); if (i && inp.value !== '') poner(i, parseFloat(inp.value)); });
  $('#bo-descartar').onclick = () => { draft.clear(); armado = ''; pintarBodega(); };
  $('#bo-ultimo').onclick = () => {
    let u = null; try { u = JSON.parse(localStorage.getItem(ULT) || 'null'); } catch (e) { u = null; }
    if (!u) { aviso('Todavía no hay una carga anterior en este celular.', true); return; }
    estado.filter(i => u[i.clave] != null).forEach(i => poner(i, u[i.clave])); aviso('Listo: revisa los números y toca «Guardar».');
  };
  $('#bo-ok').onclick = async () => {
    const items = [...draft].map(([insumo, cantidad]) => ({ insumo, cantidad })); if (!items.length) return; const b = $('#bo-ok'); b.disabled = true; let hechos = 0, error = null;
    for (const it of items) { try { await window.REST.rpc('insumo_mover', { p_insumo: it.insumo, p_tipo: 'conteo', p_cantidad: it.cantidad, p_nota: 'Carga de la mañana' }); draft.delete(it.insumo); hechos++; } catch (er) { error = er.message; break; } }
    if (hechos) { const todo = {}; estado.forEach(i => { todo[i.clave] = draft.has(i.clave) ? base(i) : (items.find(x => x.insumo === i.clave) || {}).cantidad ?? base(i); }); try { localStorage.setItem(ULT, JSON.stringify(todo)); } catch (e) { /* sin almacenamiento */ } }
    aviso(error ? `Se guardaron ${hechos}. ${error}` : (hechos === 1 ? 'Guardado.' : `Guardados: ${hechos} ingredientes.`), !!error);
    armado = ''; b.disabled = false; await bodega(); consumo();
  };
  $('#bo-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, n = parseFloat(String(f.cantidad.value).replace(',', '.')) * parseFloat(f.unidad.value || '1');
    if (!(n >= 0)) { aviso('Escribe una cantidad.', true); return; }
    try {
      const r = await window.REST.rpc('insumo_mover', { p_insumo: f.insumo.value, p_tipo: f.tipo.value, p_cantidad: Math.round(n * 100) / 100, p_nota: f.nota.value.trim() || null });
      aviso(r.sin_cambio ? 'Ya coincidía: no se movió nada.' : 'Bodega actualizada.'); f.cantidad.value = ''; f.nota.value = ''; f.hidden = true; await bodega();
    } catch (er) { aviso(er.message, true); }
  };
  const tipoAyuda = { compra: 'Cuánto entró (se suma a lo que hay).', conteo: 'Cuánto hay de verdad ahora (se corrige la diferencia).', merma: 'Cuánto se perdió o dañó (se resta). Escribe el motivo.' };
  $('#bo-tipo').onchange = e => { $('#bo-ayuda').textContent = tipoAyuda[e.target.value]; };
  $$('[data-periodo]').forEach(b => b.onclick = () => { periodo = b.dataset.periodo; $$('[data-periodo]').forEach(x => x.setAttribute('aria-pressed', x === b)); consumo(); });
  $('#co-lista').onclick = e => { const b = e.target.closest('[data-co]'); if (!b) return; const k = b.dataset.co; abiertosCons.has(k) ? abiertosCons.delete(k) : abiertosCons.add(k); pintarConsumo(); };
  $('#re-producto').onchange = pintarReceta;
  $('#re-abrir').onclick = () => { const f = $('#re-form'); f.hidden = !f.hidden; if (!f.hidden) pintarReceta(); };
  $('#re-form').onsubmit = async e => {
    e.preventDefault(); const items = [...new FormData(e.target)].filter(([k, v]) => k !== 'producto' && v !== '' && parseFloat(v) > 0).map(([insumo, v]) => ({ insumo, cantidad: parseFloat(v) }));
    try { await window.REST.rpc('receta_guardar', { p_producto: $('#re-producto').value, p_items: items }); aviso('Receta guardada: vale para las próximas ventas.'); await recetas(); }
    catch (er) { aviso(er.message, true); }
  };

  window.INS.pintarAlcance = pintarAlcance;
  window.INS.arrancar = () => { recetas(); bodega(); consumo(); setInterval(bodega, 6000); setInterval(consumo, 12000); setInterval(recetas, 60000); window.addEventListener('storage', () => { bodega(); consumo(); }); };
})();
