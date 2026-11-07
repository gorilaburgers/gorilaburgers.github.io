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
  let estado = [], formAbierta = false, periodo = 'hoy', cons = null, receta = { insumos: [], recetas: [] };

  const cantEmp = i => i.empaque_cant ? ` · ${redondo(i.saldo / i.empaque_cant)} ${esc(i.empaque_nombre || 'empaque')}${redondo(i.saldo / i.empaque_cant) === 1 ? '' : 's'}` : '';
  function pintarBodega() {
    const bajos = estado.filter(i => i.estado === 'bajo' || i.estado === 'agotado').length, sin = estado.filter(i => i.estado === 'sin_cargar').length;
    $('#bo-sub').textContent = sin ? `${sin} insumo${sin > 1 ? 's' : ''} sin cargar: cuenta lo que hay y regístralo (Bodega › Entró / Conté).` : bajos ? `${bajos} insumo${bajos > 1 ? 's' : ''} con poco o sin existencias.` : 'Todo con existencias. Baja solo con cada venta, según la receta.';
    $('#bo-n').hidden = !bajos; $('#bo-n').textContent = bajos;
    const prio = { agotado: 0, bajo: 1, sin_cargar: 2, ok: 3 };
    $('#bo-tabla').innerHTML = estado.map((i, n) => ({ i, n })).sort((a, b) => prio[a.i.estado] - prio[b.i.estado] || a.n - b.n).map(({ i }) => {
      const [ic, tx] = ESTADO[i.estado], f = i.minimo ? Math.max(0, Math.min(1, i.saldo / (i.minimo * 3))) : (i.saldo > 0 ? 1 : 0), col = COLOR[i.estado] || 'var(--d-mut)';
      return `<tr><td class="nom">${esc(i.nombre)}<small>${i.unidad === 'gr' ? 'gramos' : 'unidades'}${i.minimo ? ` · avisa bajo ${cant(i.minimo, i.unidad)}` : ''}</small></td>
        <td class="num">${i.hoy ? `<b>${cant(i.hoy, i.unidad)}</b>` : '<span class="mut">—</span>'}</td>
        <td><div class="rd-stock">${i.estado === 'sin_cargar' ? `<span><span class="rd-estado sin_definir">${ic} ${tx}</span></span>` : `<div class="pista"><i style="width:${f * 100}%;background:${col}"></i></div>
          <span><b>${cant(i.saldo, i.unidad)}<small style="font-weight:400">${cantEmp(i)}</small></b><span class="rd-estado ${i.estado}">${ic} ${tx}</span></span>`}</div></td>
        <td class="num">${i.alcanza_dias != null ? `<b>${i.alcanza_dias < 1 ? '< 1' : redondo(i.alcanza_dias)}</b> <small>día${i.alcanza_dias === 1 ? '' : 's'}</small>` : '<span class="mut">—</span>'}</td></tr>`;
    }).join('');
    const sel = $('#bo-insumo'), previo = sel.value;
    if (sel.options.length !== estado.length) { sel.innerHTML = estado.map(i => `<option value="${esc(i.clave)}">${esc(i.nombre)}</option>`).join(''); if (previo) sel.value = previo; actualizarUnidad(); }
  }
  function actualizarUnidad() {
    const i = estado.find(x => x.clave === $('#bo-insumo').value); if (!i) return;
    const u = $('#bo-unidad'); u.innerHTML = `<option value="1">${i.unidad === 'gr' ? 'gramos' : 'unidades'}</option>` + (i.empaque_cant ? `<option value="${i.empaque_cant}">${esc(i.empaque_nombre || 'empaque')}s de ${num(i.empaque_cant)} ${i.unidad === 'gr' ? 'gr' : 'uni'}</option>` : '');
  }
  async function bodega() {
    if (document.hidden || formAbierta) return;
    try { estado = await window.REST.rpc('insumos_estado'); window.INS.ok = true; raiz.hidden = false; pintarBodega(); } catch (e) { if (FALTA.test(e.message)) { window.INS.ok = false; raiz.hidden = true; } }
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
  async function recetas() { try { receta = await window.REST.rpc('recetas_admin'); pintarReceta(); } catch (e) { aviso(e.message, true); } }

  /* ---- eventos ---- */
  $('#bo-abrir').onclick = () => { const f = $('#bo-form'); f.hidden = !f.hidden; formAbierta = !f.hidden; if (!f.hidden) { actualizarUnidad(); $('#bo-cantidad').focus(); } };
  $('#bo-x').onclick = () => { $('#bo-form').hidden = true; formAbierta = false; };
  $('#bo-insumo').onchange = actualizarUnidad;
  const tipoAyuda = { compra: 'Cuánto entró (se suma a lo que hay).', conteo: 'Cuánto hay de verdad ahora (se corrige la diferencia).', merma: 'Cuánto se perdió o dañó (se resta). Escribe el motivo.' };
  $('#bo-tipo').onchange = e => { $('#bo-ayuda').textContent = tipoAyuda[e.target.value]; };
  $('#bo-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, n = parseFloat(String(f.cantidad.value).replace(',', '.')) * parseFloat(f.unidad.value || '1');
    if (!(n >= 0)) { aviso('Escribe una cantidad.', true); return; }
    try {
      const r = await window.REST.rpc('insumo_mover', { p_insumo: f.insumo.value, p_tipo: f.tipo.value, p_cantidad: Math.round(n * 100) / 100, p_nota: f.nota.value.trim() || null });
      aviso(r.sin_cambio ? 'Ya coincidía: no se movió nada.' : 'Bodega actualizada.'); f.cantidad.value = ''; f.nota.value = ''; f.hidden = true; formAbierta = false; await bodega();
    } catch (er) { aviso(er.message, true); }
  };
  $$('[data-periodo]').forEach(b => b.onclick = () => { periodo = b.dataset.periodo; $$('[data-periodo]').forEach(x => x.setAttribute('aria-pressed', x === b)); consumo(); });
  $('#co-lista').onclick = e => { const b = e.target.closest('[data-co]'); if (!b) return; const k = b.dataset.co; abiertosCons.has(k) ? abiertosCons.delete(k) : abiertosCons.add(k); pintarConsumo(); };
  $('#re-producto').onchange = pintarReceta;
  $('#re-abrir').onclick = () => { const f = $('#re-form'); f.hidden = !f.hidden; if (!f.hidden && !receta.insumos.length) recetas(); };
  $('#re-form').onsubmit = async e => {
    e.preventDefault(); const items = [...new FormData(e.target)].filter(([k, v]) => k !== 'producto' && v !== '' && parseFloat(v) > 0).map(([insumo, v]) => ({ insumo, cantidad: parseFloat(v) }));
    try { await window.REST.rpc('receta_guardar', { p_producto: $('#re-producto').value, p_items: items }); aviso('Receta guardada: vale para las próximas ventas.'); await recetas(); }
    catch (er) { aviso(er.message, true); }
  };

  window.INS.arrancar = () => { bodega(); consumo(); setInterval(bodega, 6000); setInterval(consumo, 12000); window.addEventListener('storage', () => { bodega(); consumo(); }); };
})();
