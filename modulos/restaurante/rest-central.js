/* Módulo de restaurante · bodega central y envíos al local (módulo adicional: solo se copia si el cliente tiene restaurante.bodega_central).
   Dueño (dashboard › «Bodega central»): qué hay en la central, qué está en camino, cómo está el local y qué conviene enviar, con envíos de un toque.
   Local (pantalla de ventas › «Inventario»): recibir lo que envía la bodega, ver el inventario en vivo y cuántas alcanzan de cada producto; cada venta lo descuenta (008).
   La base valida todo (011_bodega_central.sql): aquí solo se muestra y se pide. Todo texto que viene de la base se inserta con esc(). */
(() => {
  const R = window.RESTDATA;
  if (!R || !R.bodega_central || !window.RUI) return;
  const { $, $$, esc, num, aviso, hace, hhmm } = window.RUI;
  const redondo = n => Math.round(n * 10) / 10;
  const cant = (n, u) => u === 'gr' ? `${num(redondo(n))} gr` : num(redondo(n));
  const chip = x => `<li><b>${cant(x.cantidad, x.unidad)}</b> ${esc(x.nombre)}</li>`;
  const FALTA = /could not find|schema cache|does not exist|no está disponible/i;       // la base aún no tiene 011_bodega_central.sql: la pantalla sigue igual que antes
  const ESTADO = { ok: ['●', 'Hay'], bajo: ['▲', 'Poco'], agotado: ['■', 'Agotado'], sin_cargar: ['○', 'Sin cargar'], enviar: ['▲', 'Enviar'], central_bajo: ['■', 'Central baja'], sin_central: ['○', 'Sin contar'] };
  const COLOR = { ok: 'var(--d-ok)', bajo: 'var(--d-aviso)', agotado: 'var(--d-crit)', enviar: 'var(--d-aviso)', central_bajo: 'var(--d-crit)' };
  const unidadTxt = i => i.unidad === 'gr' ? 'gramos' : 'unidades';
  const empaque = (n, i) => i.empaque_cant ? ` · ${redondo(n / i.empaque_cant)} ${esc(i.empaque_nombre || 'empaque')}${redondo(n / i.empaque_cant) === 1 ? '' : 's'}` : '';
  window.CEN = { ok: null, alcance: new Map(), pendientes: 0, alertas: null };

  /* =====================  PANTALLA DE VENTAS (local)  ===================== */
  const iv = $('#p-inventario');
  if (iv) {
    let inv = { insumos: [], productos: [] }, envios = [], filtro = 'todo';
    const badgeIv = () => { const n = envios.filter(e => e.estado === 'enviado').length; window.CEN.pendientes = n; const b = $('#rp-n-inv'); if (b) { b.hidden = !n; b.textContent = n; } };
    function pintarEnvios() {
      const en = envios.filter(e => e.estado === 'enviado'), rec = envios.filter(e => e.estado === 'recibido').slice(0, 3);
      $('#iv-envios').innerHTML = en.length ? en.map(e => `<article class="rest-tarjeta iv-envio"><header><div><h2>Envío #${e.numero} de la bodega</h2><small>Salió ${hace(e.creado)}${e.quien ? ' · lo envió ' + esc(e.quien) : ''}${e.nota ? ' · ' + esc(e.nota) : ''}</small></div><span class="rd-estado bajo">▲ En camino</span></header>
          <ul class="ins-chips">${e.items.map(chip).join('')}</ul><p class="rest-sub">Cuenta lo que llegó. Al recibirlo, pasa al inventario del local y las ventas lo descuentan.</p>
          <div class="acc"><button type="button" class="rest-btn" data-recibir="${e.id}">Recibir envío</button></div></article>`).join('')
        : `<p class="rest-sub iv-vacio">No hay envíos esperando.${rec.length ? ` Último recibido: #${rec[0].numero}, ${hace(rec[0].recibido_en)}.` : ''}</p>`;
    }
    function pintarInventario() {
      const prio = { agotado: 0, bajo: 1, sin_cargar: 2, ok: 3 }, pasa = i => filtro === 'todo' || (filtro === 'atencion' ? i.estado === 'agotado' || i.estado === 'bajo' : i.estado === filtro);
      $('#iv-grid').innerHTML = inv.insumos.map((i, n) => ({ i, n })).filter(x => pasa(x.i)).sort((a, b) => prio[a.i.estado] - prio[b.i.estado] || a.n - b.n).map(({ i }) => {
        const [ic, tx] = ESTADO[i.estado], col = COLOR[i.estado] || 'var(--d-mut)', f = i.estado === 'sin_cargar' ? 0 : Math.max(0, Math.min(1, (i.alcanza_dias == null ? (i.saldo > 0 ? 7 : 0) : i.alcanza_dias) / 7));
        return `<article class="sk-card compacta ${i.estado}"><header><h3>${esc(i.nombre)}</h3><span class="rd-estado ${i.estado === 'sin_cargar' ? 'sin_definir' : i.estado}">${ic} ${tx}</span></header>
          <div class="sk-quedan"><b>${i.estado === 'sin_cargar' ? '—' : num(redondo(i.saldo))}</b><span>${unidadTxt(i)}${i.estado === 'sin_cargar' ? '' : empaque(i.saldo, i)}</span></div><div class="pista" aria-hidden="true"><i style="width:${f * 100}%;background:${col}"></i></div>
          <p class="sk-det">${i.hoy ? `Hoy salieron <b>${cant(i.hoy, i.unidad)}</b>` : 'Hoy no ha salido'}${i.alcanza_dias != null ? ` · alcanza <b>${i.alcanza_dias < 1 ? 'menos de 1 día' : redondo(i.alcanza_dias) + ' día' + (i.alcanza_dias === 1 ? '' : 's')}</b>` : ''}</p></article>`; }).join('')
        || '<p class="rest-sub">Nada para mostrar con este filtro.</p>';
      $$('#iv-filtros .rd-chipf').forEach(b => { b.setAttribute('aria-pressed', b.dataset.f === filtro); b.dataset.n = b.dataset.f === 'todo' ? inv.insumos.length : inv.insumos.filter(i => b.dataset.f === 'atencion' ? i.estado === 'agotado' || i.estado === 'bajo' : i.estado === b.dataset.f).length; });
      const ps = inv.productos.filter(p => p.alcanzan != null || p.faltan_datos);
      $('#iv-prod').innerHTML = ps.map(p => { const n = p.alcanzan, est = n == null ? 'sin_cargar' : n <= 0 ? 'agotado' : n <= Math.max(R.stock_bajo || 5, 10) ? 'bajo' : 'ok', [ic] = ESTADO[est];
        return `<li class="iv-p ${est}"><span class="nom">${esc(p.nombre)}</span><span class="n">${n == null ? '—' : n}</span><span class="lim">${n == null ? 'faltan datos' : (n <= 0 ? 'sin ingredientes' : 'alcanzan') + (p.limita && n != null && n < 40 ? ' · se acaba antes: ' + esc(p.limita) : '')}</span><span class="rd-estado ${est === 'sin_cargar' ? 'sin_definir' : est}">${ic}</span></li>`; }).join('') || '<li class="rest-sub">Todavía no hay recetas cargadas.</li>';
    }
    async function cargarInv() {
      try { inv = await window.REST.rpc('inventario_local'); window.CEN.ok = true; window.CEN.alcance = new Map(inv.productos.map(p => [p.producto, p])); pintarInventario(); if (window.CEN.alAlcance) window.CEN.alAlcance(); }
      catch (e) { if (FALTA.test(e.message)) { window.CEN.ok = false; $('#t-inventario').hidden = true; } }
    }
    async function cargarEnvios() {
      try { envios = await window.REST.rpc('envios_lista', { p_dias: 14 }); window.CEN.ok = true; pintarEnvios(); badgeIv(); } catch (e) { if (FALTA.test(e.message)) { window.CEN.ok = false; $('#t-inventario').hidden = true; } }
    }
    async function refrescar() { await Promise.all([cargarInv(), cargarEnvios()]); }
    $('#iv-envios').addEventListener('click', async e => {
      const b = e.target.closest('[data-recibir]'); if (!b) return; b.disabled = true;
      try { const r = await window.REST.rpc('envio_recibir', { p_id: +b.dataset.recibir }); aviso(`Envío #${r.numero} recibido: ya está en el inventario del local.`); await refrescar(); }
      catch (er) { aviso(er.message, true); b.disabled = false; refrescar(); }
    });
    $$('#iv-filtros .rd-chipf').forEach(b => b.onclick = () => { filtro = b.dataset.f; pintarInventario(); });
    /* después de cada venta: se refresca el inventario y se avisa si algo se acabó */
    window.CEN.trasVenta = async () => {
      await cargarInv(); const sin = inv.insumos.filter(i => i.estado === 'agotado'); if (sin.length) aviso(`Ojo: se acabó ${sin.slice(0, 3).map(i => i.nombre).join(', ')}${sin.length > 3 ? '…' : ''}. Avisa a bodega.`, true);
    };
    window.CEN.refrescar = refrescar;
    window.CEN.arrancar = () => { refrescar(); setInterval(() => { if (!document.hidden) refrescar(); }, 7000); window.addEventListener('storage', refrescar); };
  }

  /* =====================  DASHBOARD DEL DUEÑO (bodega central)  ===================== */
  const raiz = $('#rd-p-central');
  if (!raiz) return;
  let est = [], envios = [], filtro = 'todo', dias = 3, armado = '';
  const draft = new Map();
  const paso = i => i.unidad === 'gr' ? 100 : 1;
  const rapidos = i => i.unidad === 'uni' ? [10, 20, 50] : [500, 1000, 5000];
  const limpio = n => Math.max(0, Math.min(1000000, Math.round((Number(n) || 0) * 100) / 100));
  const actual = i => draft.has(i.clave) ? draft.get(i.clave) : 0;
  const estadoDe = i => i.estado === 'sin_cargar' ? 'sin_central' : i.estado;

  function pintarKpis() {
    const paraEnviar = est.filter(i => i.estado === 'enviar' || i.estado === 'central_bajo').length, bajas = est.filter(i => i.estado === 'central_bajo').length, sin = est.filter(i => i.estado === 'sin_cargar').length, cam = envios.filter(e => e.estado === 'enviado').length;
    window.CEN.alertas = { paraEnviar, bajas, sin, enCamino: cam };
    const k = [['Para enviar al local', paraEnviar, paraEnviar ? 'El local lo necesita pronto' : 'El local está cubierto', paraEnviar ? 'aviso' : 'ok'], ['Central baja', bajas, bajas ? 'No alcanza para lo sugerido: compra más' : 'La central alcanza', bajas ? 'alerta' : 'ok'],
      ['Envíos en camino', cam, cam ? 'Esperan que el local los reciba' : 'Nada pendiente', cam ? 'aviso' : ''], ['Central sin contar', sin, sin ? 'Cuéntalos con «Conté»' : 'Todo contado', sin ? 'aviso' : 'ok']];
    $('#ce-kpis').innerHTML = k.map(([a, b, c, cl]) => `<article class="rest-tarjeta rd-kpi ${cl}"><span class="rotulo">${a}</span><span class="valor">${b}</span><span class="pie">${c}</span></article>`).join('');
    const f = { todo: est.length, enviar: paraEnviar, central_bajo: bajas, sin_cargar: sin }; $$('#ce-filtros .rd-chipf').forEach(b => { b.setAttribute('aria-pressed', b.dataset.f === filtro); b.dataset.n = f[b.dataset.f]; });
    if (window.RD) { window.RD.badge('central', paraEnviar + cam); window.RD.alertas(); }
  }
  function pintarCambios() {
    const cs = est.filter(i => draft.has(i.clave)), bar = $('#ce-guardar'); bar.hidden = !cs.length;
    $('#ce-cambios').innerHTML = cs.length ? `<b>Enviar ${cs.length} ingrediente${cs.length > 1 ? 's' : ''} al local:</b> ` + cs.map(i => `${cant(draft.get(i.clave), i.unidad)} ${esc(i.nombre)}`).join(' · ') : '';
    $$('.sk-card', $('#ce-grid')).forEach(c => { const i = est.find(x => x.clave === c.dataset.k); if (!i) return; const on = draft.has(i.clave), dl = $('[data-r="delta"]', c); c.classList.toggle('cambio', on); dl.hidden = !on;
      if (on) { const v = draft.get(i.clave); dl.innerHTML = v > i.central ? `<b>Ojo:</b> en la central solo hay ${cant(i.central, i.unidad)}` : `Se enviarán ${cant(v, i.unidad)}. En la central quedarán ${cant(i.central - v, i.unidad)}.`; dl.classList.toggle('malo', v > i.central); } });
  }
  function poner(i, n) { n = limpio(n); n ? draft.set(i.clave, n) : draft.delete(i.clave); const inp = $(`.sk-card[data-k="${CSS.escape(i.clave)}"] input`, $('#ce-grid')); if (inp) inp.value = n || ''; pintarCambios(); }
  function pintarGrid() {
    pintarKpis();
    const sel = $('#ce-sub'), sug = est.filter(i => i.sugerido > 0 && i.estado !== 'sin_cargar').length;
    sel.textContent = sug ? `${sug} ingrediente${sug > 1 ? 's' : ''} con envío sugerido para cubrir ${dias} día${dias > 1 ? 's' : ''} de venta. Toca «Llenar con lo sugerido» o ajusta cada uno.` : `El local está cubierto para ${dias} día${dias > 1 ? 's' : ''}. Cuando algo baje, aparece aquí.`;
    const prio = { central_bajo: 0, enviar: 1, sin_cargar: 2, ok: 3 }, llave = est.map(i => i.clave).join(), pasa = i => filtro === 'todo' || i.estado === filtro;
    if (armado !== llave) {
      armado = llave; draft.clear();
      const orden = est.map((i, n) => ({ i, n })).sort((a, b) => prio[a.i.estado] - prio[b.i.estado] || a.n - b.n).map(x => x.i);
      $('#ce-grid').innerHTML = orden.map(i => `<article class="sk-card" data-k="${esc(i.clave)}"><header><h3>${esc(i.nombre)}</h3><span class="rd-estado" data-r="estado"></span></header>
        <div class="sk-quedan"><b data-r="central">—</b><span data-r="unid"></span></div><div class="pista" aria-hidden="true"><i data-r="barra"></i></div><p class="sk-det" data-r="det"></p>
        <div class="sk-ctrl"><span class="sk-lab" id="ce-l-${esc(i.clave)}">Enviar ahora</span>
          <div class="sk-paso" role="group" aria-labelledby="ce-l-${esc(i.clave)}"><button type="button" data-acc="menos" aria-label="Quitar de ${esc(i.nombre)}">−</button><input type="number" inputmode="decimal" min="0" max="1000000" step="any" data-r="in" aria-label="Cuánto enviar de ${esc(i.nombre)}" placeholder="0"><button type="button" data-acc="mas" aria-label="Subir ${esc(i.nombre)}">+</button></div>
          <div class="sk-rap" aria-label="Enviar de golpe"><button type="button" data-sug class="sug">Sugerido</button>${rapidos(i).map(n => `<button type="button" data-n="${n}">+${num(n)}</button>`).join('')}</div>
          <p class="sk-delta" data-r="delta" hidden></p></div></article>`).join('');
    }
    est.forEach(i => {
      const c = $(`.sk-card[data-k="${CSS.escape(i.clave)}"]`, $('#ce-grid')); if (!c) return; const e = estadoDe(i), [ic, tx] = ESTADO[e], col = COLOR[e] || 'var(--d-mut)', r = k => $(`[data-r="${k}"]`, c);
      const f = i.estado === 'sin_cargar' ? 0 : Math.max(0, Math.min(1, (i.alcanza_dias == null ? (i.local > 0 ? 7 : 0) : i.alcanza_dias) / 7));
      c.className = 'sk-card ' + (i.estado === 'sin_cargar' ? 'sin_cargar' : i.estado === 'central_bajo' ? 'agotado' : i.estado === 'enviar' ? 'bajo' : 'ok') + (draft.has(i.clave) ? ' cambio' : ''); c.hidden = !pasa(i);
      r('estado').className = 'rd-estado ' + (e === 'sin_central' ? 'sin_definir' : i.estado === 'central_bajo' ? 'agotado' : i.estado === 'enviar' ? 'bajo' : 'ok'); r('estado').textContent = `${ic} ${tx}`;
      r('central').textContent = i.central_cargado ? num(redondo(i.central)) : '—'; r('unid').textContent = `en central · ${unidadTxt(i)}${i.central_cargado ? empaque(i.central, i) : ''}`;
      r('barra').style.width = f * 100 + '%'; r('barra').style.background = col;
      r('det').innerHTML = `Local: <b>${i.local_cargado ? cant(i.local, i.unidad) : 'sin contar'}</b>${i.alcanza_dias != null ? ` · alcanza <b>${i.alcanza_dias < 1 ? 'menos de 1 día' : redondo(i.alcanza_dias) + ' día' + (i.alcanza_dias === 1 ? '' : 's')}</b>` : ''}${i.en_camino ? `<br>En camino: <b>${cant(i.en_camino, i.unidad)}</b>` : ''}${i.sugerido > 0 ? `<br>Sugerido enviar: <b>${cant(i.sugerido, i.unidad)}</b>` : ''}`;
      const inp = r('in'); if (document.activeElement !== inp) inp.value = draft.has(i.clave) ? draft.get(i.clave) : '';
      const bs = $('[data-sug]', c); bs.hidden = !(i.sugerido > 0); if (i.sugerido > 0) bs.textContent = `Sugerido ${num(i.sugerido)}`;
    });
    $('#ce-vacio').hidden = est.some(pasa);
    const f = $('#ce-insumo'), previo = f.value; if (f.options.length !== est.length) { f.innerHTML = est.map(i => `<option value="${esc(i.clave)}">${esc(i.nombre)}</option>`).join(''); if (previo) f.value = previo; unidadForm(); }
    pintarCambios();
  }
  function unidadForm() {
    const i = est.find(x => x.clave === $('#ce-insumo').value); if (!i) return;
    $('#ce-unidad').innerHTML = `<option value="1">${i.unidad === 'gr' ? 'gramos' : 'unidades'}</option>` + (i.empaque_cant ? `<option value="${i.empaque_cant}">${esc(i.empaque_nombre || 'empaque')}s de ${num(i.empaque_cant)} ${i.unidad === 'gr' ? 'gr' : 'uni'}</option>` : '');
  }
  function pintarEnvios() {
    $('#ce-envios').innerHTML = envios.length ? envios.slice(0, 12).map(e => {
      const cl = e.estado === 'enviado' ? 'bajo' : e.estado === 'recibido' ? 'ok' : 'agotado', tx = e.estado === 'enviado' ? '▲ En camino' : e.estado === 'recibido' ? '● Recibido' : '■ Anulado';
      return `<article class="ce-envio ${e.estado}"><header><h3>Envío #${e.numero}</h3><span class="rd-estado ${cl}">${tx}</span></header>
        <p class="sk-det">Salió ${hace(e.creado)}${e.quien ? ' · ' + esc(e.quien) : ''}${e.nota ? ' · ' + esc(e.nota) : ''}${e.estado === 'recibido' ? `<br>Lo recibió <b>${esc(e.recibido_por || 'el local')}</b> a las ${hhmm(e.recibido_en)}` : ''}${e.estado === 'anulado' ? `<br>Anulado: ${esc(e.anulado_motivo || '')}` : ''}</p>
        <ul class="ins-chips">${e.items.map(chip).join('')}</ul>${e.estado === 'enviado' ? `<div class="acc"><button type="button" class="rest-btn peligro chico" data-anular="${e.id}">Anular envío</button></div>` : ''}</article>`; }).join('')
      : '<p class="rest-sub">Todavía no has enviado nada al local. Arriba eliges qué enviar.</p>';
  }
  async function cargar() {
    if (document.hidden) return;
    try { [est, envios] = await Promise.all([window.REST.rpc('central_estado', { p_dias: dias }), window.REST.rpc('envios_lista', { p_dias: 30 })]); window.CEN.ok = true; pintarGrid(); pintarEnvios(); }
    catch (e) { if (FALTA.test(e.message)) { window.CEN.ok = false; const t = $('#rd-tab-central'); if (t) t.hidden = true; } }
  }
  function dialogo(html, alCerrar) {
    const d = document.createElement('dialog'); d.className = 'rest-dialogo'; d.innerHTML = html; document.body.append(d); d.addEventListener('close', () => { alCerrar && alCerrar(d); d.remove(); }); d.showModal(); return d;
  }

  /* ---- eventos ---- */
  $('#ce-dias').onchange = e => { dias = parseInt(e.target.value, 10); cargar(); };
  $$('#ce-filtros .rd-chipf').forEach(b => b.onclick = () => { filtro = b.dataset.f; pintarGrid(); });
  $('#ce-sugerido').onclick = () => { let n = 0; est.filter(i => i.sugerido > 0).forEach(i => { poner(i, Math.min(i.sugerido, Math.max(i.central, 0))); n++; }); aviso(n ? 'Listo: revisa los números y toca «Enviar al local».' : 'No hay nada sugerido por ahora.', !n); };
  $('#ce-grid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const c = b.closest('.sk-card'), i = est.find(x => x.clave === c.dataset.k); if (!i) return;
    if (b.dataset.acc) poner(i, actual(i) + (b.dataset.acc === 'mas' ? paso(i) : -paso(i))); else if (b.dataset.n) poner(i, actual(i) + parseFloat(b.dataset.n)); else if (b.hasAttribute('data-sug')) poner(i, i.sugerido);
  });
  $('#ce-grid').addEventListener('input', e => { const inp = e.target.closest('input'); if (!inp) return; const i = est.find(x => x.clave === inp.closest('.sk-card').dataset.k); if (!i) return; const v = limpio(inp.value === '' ? 0 : parseFloat(inp.value)); v ? draft.set(i.clave, v) : draft.delete(i.clave); pintarCambios(); });
  $('#ce-descartar').onclick = () => { draft.clear(); armado = ''; pintarGrid(); };
  $('#ce-ok').onclick = () => {
    const cs = est.filter(i => draft.has(i.clave)); if (!cs.length) return; const pasan = cs.filter(i => draft.get(i.clave) > i.central);
    if (pasan.length) { aviso(`En la central no alcanza: ${pasan.map(i => i.nombre).join(', ')}. Baja la cantidad o compra más.`, true); return; }
    const d = dialogo(`<form method="dialog"><h2>Enviar al local</h2><p class="rest-sub">Esto sale de la bodega central ahora y el local lo suma a su inventario cuando lo reciba.</p>
      <ul class="ins-chips ce-resumen">${cs.map(i => `<li><b>${cant(draft.get(i.clave), i.unidad)}</b> ${esc(i.nombre)}</li>`).join('')}</ul>
      <label class="rest-campo">Nota para el local (opcional)<input id="ce-nota" maxlength="200" placeholder="Ej.: viaja con el pedido de las 3"></label>
      <div class="acc"><button value="no" class="rest-btn sec" formnovalidate>Volver</button><button value="si" class="rest-btn">Enviar ahora</button></div></form>`,
      async dl => { if (dl.returnValue !== 'si') return;
        try { const r = await window.REST.rpc('envio_crear', { p_items: cs.map(i => ({ insumo: i.clave, cantidad: draft.get(i.clave) })), p_nota: ($('#ce-nota', dl) || {}).value ? $('#ce-nota', dl).value.trim() : null });
          aviso(`Envío #${r.numero} en camino: ${cs.length} ingrediente${cs.length > 1 ? 's' : ''}.`); draft.clear(); armado = ''; await cargar(); } catch (er) { aviso(er.message, true); } });
    void d;
  };
  $('#ce-envios').addEventListener('click', e => {
    const b = e.target.closest('[data-anular]'); if (!b) return; const id = +b.dataset.anular;
    dialogo(`<form method="dialog"><h2>Anular envío</h2><p class="rest-sub">La mercadería vuelve a la bodega central. Solo se puede si el local todavía no lo recibió.</p><label class="rest-campo">Motivo<input id="ce-motivo" maxlength="200" placeholder="Ej.: me equivoqué de insumo"></label>
      <div class="acc"><button value="no" class="rest-btn sec" formnovalidate>Volver</button><button value="si" class="rest-btn peligro">Anular</button></div></form>`,
      async dl => { const m = ($('#ce-motivo', dl) || {}).value || ''; if (dl.returnValue !== 'si') return; if (m.trim().length < 3) { aviso('Escribe el motivo de la anulación.', true); return; }
        try { await window.REST.rpc('envio_anular', { p_id: id, p_motivo: m.trim() }); aviso('Envío anulado: la mercadería volvió a la central.'); await cargar(); } catch (er) { aviso(er.message, true); } });
  });
  $('#ce-abrir').onclick = () => { const f = $('#ce-form'); f.hidden = !f.hidden; if (!f.hidden) { unidadForm(); $('#ce-cantidad').focus(); } };
  $('#ce-x').onclick = () => { $('#ce-form').hidden = true; };
  $('#ce-insumo').onchange = unidadForm;
  const ayuda = { compra: 'Cuánto entró a la central (se suma).', conteo: 'Cuánto hay de verdad en la central ahora (se corrige la diferencia).', merma: 'Cuánto se perdió o dañó (se resta). Escribe el motivo.' };
  $('#ce-tipo').onchange = e => { $('#ce-ayuda').textContent = ayuda[e.target.value]; };
  $('#ce-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target, n = parseFloat(String(f.cantidad.value).replace(',', '.')) * parseFloat(f.unidad.value || '1'); if (!(n >= 0)) { aviso('Escribe una cantidad.', true); return; }
    try { const r = await window.REST.rpc('central_mover', { p_insumo: f.insumo.value, p_tipo: f.tipo.value, p_cantidad: Math.round(n * 100) / 100, p_nota: f.nota.value.trim() || null });
      aviso(r.sin_cambio ? 'Ya coincidía: no se movió nada.' : 'Bodega central actualizada.'); f.cantidad.value = ''; f.nota.value = ''; f.hidden = true; armado = ''; await cargar(); } catch (er) { aviso(er.message, true); }
  };
  window.CEN.arrancar = () => { cargar(); setInterval(cargar, 8000); window.addEventListener('storage', cargar); };
})();
