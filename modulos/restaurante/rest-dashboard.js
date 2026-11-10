/* Módulo de restaurante · dashboard del dueño. Lee dashboard() cada pocos segundos (sin recargar la página) y pinta cada bloque.
   Gráficas en HTML (no SVG) para que el texto conserve su tamaño en el celular; cada gráfica tiene su vista de tabla. */
(() => {
  const { $, $$, esc, plata, num, hhmm, fechaLarga, diaCorto, canalTxt, hace, aviso, tooltip } = window.RUI, R = window.RESTDATA;
  const CAN = { local: 'var(--d-s1)', llevar: 'var(--d-s2)', domicilio: 'var(--d-s3)' };
  const ESTADO = { ok: ['●', 'Hay'], bajo: ['▲', 'Bajo'], agotado: ['■', 'Agotado'], sin_definir: ['○', 'Sin cargar'], libre: ['–', 'Sin control'] };
  const COLOR_ESTADO = { ok: 'var(--d-ok)', bajo: 'var(--d-aviso)', agotado: 'var(--d-crit)' };
  let D = null, timer = null, auto = null, vistos = new Set(), primera = true;

  const raiz = $('#rd-app'), vivo = $('#rd-vivo');

  /* ---- bloques ---- */
  function pintarHeroe(d) {
    const r = d.resumen, sp = d.semana_pasada;
    $('#rd-hero').textContent = num(r.hamburguesas);
    $('#rd-fecha').textContent = fechaLarga(d.dia);
    const dif = r.hamburguesas - sp.hamburguesas_ahora, el = $('#rd-delta');
    if (sp.hamburguesas_ahora > 0 || r.hamburguesas > 0) {
      const pct = sp.hamburguesas_ahora ? Math.round(dif / sp.hamburguesas_ahora * 100) : null;
      el.hidden = false; el.className = 'rd-delta ' + (dif > 0 ? 'sube' : dif < 0 ? 'baja' : '');
      el.textContent = (dif > 0 ? '▲ ' : dif < 0 ? '▼ ' : '= ') + (dif === 0 ? 'Igual que' : `${Math.abs(dif)} ${dif > 0 ? 'más que' : 'menos que'}`) + ` el mismo día de la semana pasada a esta hora${pct != null && dif ? ` (${pct > 0 ? '+' : ''}${pct} %)` : ''}`;
    } else el.hidden = true;
    const rec = d.record, barra = $('#rd-rec-barra');
    if (rec) { barra.style.transform = `scaleX(${Math.min(1, r.hamburguesas / rec.hamburguesas)})`; $('#rd-rec-txt').textContent = `${num(r.hamburguesas)} de ${num(rec.hamburguesas)} del récord (${fechaLarga(rec.dia)})`; }
    else $('#rd-rec-txt').textContent = '';
  }
  function pintarKpis(d) {
    const r = d.resumen, pend = d.pendientes;
    const k = [
      ['Ingresos de hoy', plata(r.ingresos_cent), `Local ${plata(r.ingresos_local_cent)} · Web ${plata(r.ingresos_web_cent)}${r.envios_cent ? ` · + ${plata(r.envios_cent)} de envíos` : ''}`],
      ['Ventas (tickets)', num(r.ventas), `${num(r.unidades)} productos en total`],
      ['Ticket promedio', plata(r.ticket_cent), 'Por venta, sin envío'],
      [pend ? 'Pedidos por responder' : 'Pedidos de la web', pend ? num(pend) : '0', pend ? '<a href="personal.html#pedidos">Abrir y confirmar</a>' : 'Nada esperando']
    ];
    $('#rd-kpis').innerHTML = k.map(([a, b, c], n) => `<article class="rest-tarjeta rd-kpi${n === 3 && pend ? ' alerta' : ''}"><span class="rotulo">${a}</span><span class="valor">${b}</span><span class="pie">${c}</span></article>`).join('');
  }
  function pintarHoras(d) {
    const act = d.por_hora.filter(h => h.hamburguesas || h.anterior).map(h => h.h), ini = Math.min(11, ...act, d.hora), fin = Math.max(Math.min(23, d.hora + 1), 21, ...act);
    const horas = d.por_hora.filter(h => h.h >= ini && h.h <= fin), max = Math.max(1, ...horas.map(h => Math.max(h.hamburguesas, h.anterior))), tope = Math.max(4, Math.ceil(max / 4) * 4);
    const rejilla = [0, 0.5, 1].map(f => `<div style="bottom:${f * 100}%"></div><span style="bottom:${f * 100}%">${Math.round(tope * f)}</span>`).join('');
    const cols = horas.map(h => { const pct = h.hamburguesas / tope * 100, futura = h.h > d.hora, etiqueta = h.hamburguesas === max && h.hamburguesas > 0 || h.h === d.hora;
      return `<div class="rd-col${h.h === d.hora ? ' ahora' : ''}${futura ? ' futura' : ''}" tabindex="0" data-h="${h.h}" aria-label="${h.h}:00 ${h.hamburguesas} hamburguesas, semana pasada ${h.anterior}">
        ${etiqueta && !futura ? `<span class="v" style="bottom:${pct}%">${h.hamburguesas}</span>` : ''}<div class="barra" style="height:${pct}%"></div><span class="hh">${h.h}</span></div>`; }).join('');
    const pts = horas.map((h, k) => [(k + .5) / horas.length * 100, 100 - h.anterior / tope * 100]);
    const linea = `<svg class="rd-lineaS" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map(p => p.join(',')).join(' ')}"/></svg>`;
    const puntos = pts.map((p, k) => horas[k].anterior ? `<span class="rd-punto" style="left:calc(34px + (100% - 34px) * ${p[0] / 100});top:calc((100% - 26px) * ${p[1] / 100})"></span>` : '').join('');
    $('#rd-horas').innerHTML = `<div class="rejilla">${rejilla}</div><div class="rd-cols">${cols}</div>${linea}${puntos}`;
    $$('.rd-col', $('#rd-horas')).forEach(c => { const h = horas.find(x => x.h === +c.dataset.h); tooltip(c, () => [[`${h.h}:00 a ${h.h}:59`, `${h.hamburguesas} hamburguesas`, 'var(--fx-accent)'], ['Semana pasada', `${h.anterior}`, 'var(--d-mut)']]); });
    $('#rd-horas-tabla').innerHTML = `<table><thead><tr><th>Hora</th><th>Hoy</th><th>Semana pasada</th></tr></thead><tbody>${horas.map(h => `<tr><td>${h.h}:00</td><td>${h.hamburguesas}</td><td>${h.anterior}</td></tr>`).join('')}</tbody></table>`;
  }
  function pintarCanales(d) {
    const r = d.resumen, tot = r.hamburguesas || 1, cs = [['local', r.local], ['llevar', r.llevar], ['domicilio', r.domicilio]];
    $('#rd-canal').innerHTML = r.hamburguesas ? cs.filter(c => c[1]).map(([c, n]) => `<i style="flex:${n};background:${CAN[c]}" title="${canalTxt(c)}"></i>`).join('') : '<i style="flex:1;background:var(--d-line)"></i>';
    $('#rd-canal').setAttribute('aria-label', cs.map(([c, n]) => `${canalTxt(c)} ${n}`).join(', '));
    $('#rd-canal-lista').innerHTML = cs.map(([c, n]) => `<div><i style="background:${CAN[c]}"></i><span>${canalTxt(c)}</span><span><b>${num(n)}</b> <em>${Math.round(n / tot * 100)} %</em></span></div>`).join('');
  }
  /* ---- stock del día: una tarjeta grande por hamburguesa, con + y − (pensado para tocar sin pensar) ----
     El borrador vive en el navegador hasta que el dueño toca «Guardar stock»; la base recibe solo lo que cambió. */
  const draft = new Map(), ULT = 'rd_ultimo_stock';
  let armado = '';
  const clampMin = (p, n) => Math.max(p.vendidas || 0, Math.min(9999, Math.round(n) || 0));
  const actual = p => draft.has(p.clave) ? draft.get(p.clave) : (p.inicial != null ? p.inicial : 0);
  function pintarCambios() {
    const ps = (D ? D.productos : []).filter(p => draft.has(p.clave)), bar = $('#sk-guardar');
    bar.hidden = !ps.length;
    $('#sk-cambios').innerHTML = ps.length ? `<b>${ps.length} cambio${ps.length > 1 ? 's' : ''} sin guardar:</b> ` + ps.map(p => { const dif = draft.get(p.clave) - (p.inicial || 0); return `${esc(p.nombre)} ${p.inicial == null ? `→ ${draft.get(p.clave)}` : (dif > 0 ? '+' : '') + dif}`; }).join(' · ') : '';
    $$('.sk-card', $('#sk-grid')).forEach(c => {
      const p = D.productos.find(x => x.clave === c.dataset.k), on = draft.has(p.clave), dl = $('[data-r="delta"]', c);
      c.classList.toggle('cambio', on); dl.hidden = !on;
      if (on) { const dif = draft.get(p.clave) - (p.inicial || 0); dl.textContent = p.inicial == null ? `Se cargarán ${draft.get(p.clave)} para hoy` : `${p.inicial} → ${draft.get(p.clave)} (${dif >= 0 ? '+' : ''}${dif})`; }
    });
  }
  function poner(p, n) {
    n = clampMin(p, n); const base = p.inicial != null ? p.inicial : null;
    if (n === base || (base == null && n === 0 && !draft.has(p.clave))) draft.delete(p.clave); else draft.set(p.clave, n);
    const inp = $(`.sk-card[data-k="${CSS.escape(p.clave)}"] input`, $('#sk-grid')); if (inp) inp.value = draft.has(p.clave) ? draft.get(p.clave) : (p.inicial != null ? p.inicial : '');
    pintarCambios();
  }
  function pintarProductos(d) {
    const ps = d.productos.filter(p => p.estado !== 'libre'), otros = d.productos.filter(p => p.estado === 'libre' && p.vendidas > 0 && p.categoria !== 'extras'), maxV = Math.max(1, ...d.productos.map(p => p.vendidas));
    $('#sk-otros').hidden = !otros.length;
    $('#rd-prod').innerHTML = otros.map(p => `<tr><td class="nom">${esc(p.nombre)}<small>${plata(p.precio_cent)}</small></td><td><div class="rd-vend"><div class="pista"><i style="width:${p.vendidas / maxV * 100}%"></i></div><b>${p.vendidas}</b></div></td></tr>`).join('');
    if (!$('#sk-grid')) return;
    const llave = d.dia + '|' + ps.map(p => p.clave).join();
    if (armado !== llave) {                                                        // se arma una sola vez: así no se pierde lo que se está escribiendo
      armado = llave; draft.clear();
      $('#sk-grid').innerHTML = ps.map(p => `<article class="sk-card" data-k="${esc(p.clave)}"><header><h3>${esc(p.nombre)}</h3><span class="rd-estado" data-r="estado"></span></header>
        <div class="sk-quedan"><b data-r="quedan">—</b><span data-r="quedan-t">quedan</span></div><div class="pista" aria-hidden="true"><i data-r="barra"></i></div>
        <p class="sk-det" data-r="det"></p>
        <div class="sk-ctrl"><span class="sk-lab" id="sk-l-${esc(p.clave)}">Cargadas hoy</span>
          <div class="sk-paso" role="group" aria-labelledby="sk-l-${esc(p.clave)}"><button type="button" data-acc="menos" aria-label="Quitar una de ${esc(p.nombre)}">−</button><input type="number" inputmode="numeric" min="0" max="9999" step="1" data-r="in" aria-label="Cargadas hoy de ${esc(p.nombre)}" placeholder="0"><button type="button" data-acc="mas" aria-label="Subir una de ${esc(p.nombre)}">+</button></div>
          <div class="sk-rap" aria-label="Subir de golpe"><button type="button" data-n="5">+5</button><button type="button" data-n="10">+10</button><button type="button" data-n="20">+20</button></div>
          <p class="sk-delta" data-r="delta" hidden></p></div></article>`).join('');
    }
    ps.forEach(p => {
      const c = $(`.sk-card[data-k="${CSS.escape(p.clave)}"]`, $('#sk-grid')); if (!c) return;
      const f = p.inicial ? Math.max(0, Math.min(1, p.quedan / p.inicial)) : 0, col = COLOR_ESTADO[p.estado] || 'var(--d-mut)', [ic, tx] = ESTADO[p.estado], r = k => $(`[data-r="${k}"]`, c);
      c.className = 'sk-card ' + p.estado + (draft.has(p.clave) ? ' cambio' : '');
      r('estado').className = 'rd-estado ' + p.estado; r('estado').textContent = `${ic} ${tx}`;
      r('quedan').textContent = p.quedan == null ? '∞' : p.quedan; r('quedan-t').textContent = p.quedan == null ? 'sin tope' : p.quedan === 1 ? 'queda' : 'quedan';
      r('barra').style.width = (p.quedan == null ? 0 : f * 100) + '%'; r('barra').style.background = col;
      r('det').innerHTML = p.inicial == null ? 'Aún no cargaste cuántas hay hoy: se vende sin límite.' : `<b>${p.vendidas}</b> vendida${p.vendidas === 1 ? '' : 's'} de <b>${p.inicial}</b> cargadas`;
      const inp = r('in'); inp.min = p.vendidas; if (document.activeElement !== inp) inp.value = draft.has(p.clave) ? draft.get(p.clave) : (p.inicial != null ? p.inicial : '');
    });
    const sin = ps.filter(p => p.estado === 'sin_definir').length, baj = ps.filter(p => p.estado === 'bajo' || p.estado === 'agotado').length;
    $('#rd-stock-sub').textContent = sin ? `Faltan ${sin} por cargar: sin stock se vende sin límite. Toca + para empezar.` : baj ? `${baj} con poco o sin stock. Sube más con +5, +10 o +20.` : 'Toca + para subir hamburguesas al stock. Lo que se vende baja solo.';
    pintarCambios();
  }
  if ($('#sk-grid')) {
  $('#sk-grid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !D) return; const c = b.closest('.sk-card'), p = D.productos.find(x => x.clave === c.dataset.k); if (!p) return;
    if (b.dataset.acc) poner(p, actual(p) + (b.dataset.acc === 'mas' ? 1 : -1)); else if (b.dataset.n) poner(p, actual(p) + parseInt(b.dataset.n, 10));
  });
  $('#sk-grid').addEventListener('input', e => { const inp = e.target.closest('input'); if (!inp || !D) return; const p = D.productos.find(x => x.clave === inp.closest('.sk-card').dataset.k); if (!p) return;
    const n = inp.value === '' ? 0 : parseInt(inp.value, 10); if (n === actual(p)) return; const base = p.inicial != null ? p.inicial : null, v = Math.max(p.vendidas || 0, Math.min(9999, n || 0));
    if (v === base) draft.delete(p.clave); else draft.set(p.clave, v); pintarCambios(); });
  $('#sk-grid').addEventListener('change', e => { const inp = e.target.closest('input'); if (!inp || !D) return; const p = D.productos.find(x => x.clave === inp.closest('.sk-card').dataset.k); if (p) poner(p, inp.value === '' ? actual(p) : parseInt(inp.value, 10)); });
  $('#sk-descartar').onclick = () => { draft.clear(); armado = ''; if (D) pintarProductos(D); };
  $('#sk-ultimo').onclick = () => {
    let u = null; try { u = JSON.parse(localStorage.getItem(ULT) || 'null'); } catch (e) { u = null; }
    if (!u || !D) { aviso('Todavía no hay una carga anterior en este celular.', true); return; }
    D.productos.filter(p => p.estado !== 'libre' && u[p.clave] != null).forEach(p => poner(p, u[p.clave])); aviso('Listo: revisa los números y toca «Guardar stock».');
  };
  $('#sk-ok').onclick = async () => {
    const items = [...draft].map(([producto, cantidad]) => ({ producto, cantidad })); if (!items.length) return; const b = $('#sk-ok'); b.disabled = true;
    try {
      await window.REST.rpc('stock_fijar_varios', { p_items: items });
      const todo = {}; D.productos.filter(p => p.estado !== 'libre').forEach(p => { todo[p.clave] = actual(p); }); try { localStorage.setItem(ULT, JSON.stringify(todo)); } catch (e) { /* sin almacenamiento */ }
      aviso(items.length === 1 ? 'Stock guardado.' : `Stock guardado: ${items.length} hamburguesas.`); draft.clear(); armado = ''; await cargar();
    } catch (er) { aviso(er.message, true); } finally { b.disabled = false; }
  };
  }
  function pintarFeed(d) {
    const html = d.ultimas.map(v => { const nuevo = !primera && !vistos.has(v.id + v.estado); vistos.add(v.id + v.estado);
      return `<li class="${v.estado === 'anulada' ? 'anulada' : ''}${nuevo ? ' nuevo' : ''}"><span class="hora">${hhmm(v.creado)}</span><span><i class="rd-canalpunto" style="background:${CAN[v.canal]}"></i>${v.lineas.map(l => `${l.cantidad}× ${esc(l.nombre)}`).join(' · ')}</span><b>${plata(v.total_cent)}</b>
        <span class="det">#${v.numero} · ${canalTxt(v.canal)}${v.sector ? ' · ' + esc(v.sector) : ''}${v.quien ? ' · ' + esc(v.quien) : ''}${v.estado === 'anulada' ? ' · ANULADA' : ''}</span>${window.INS ? `<div class="ins-fila">${window.INS.boton(v.id)}${window.INS.bloque(v.id)}</div>` : ''}</li>`; }).join('');
    const sc = $('#rd-feed').scrollTop;
    $('#rd-feed').innerHTML = html || '<li><span class="det" style="grid-column:1/-1">Aún no hay ventas hoy.</span></li>';
    $('#rd-feed').scrollTop = sc;
  }
  function pintarSemana(d) {
    const max = Math.max(1, ...d.semana.map(x => x.hamburguesas));
    $('#rd-semana').innerHTML = d.semana.map((x, n) => `<div class="c${n === 6 ? ' hoy' : ''}" tabindex="0" data-n="${n}" aria-label="${diaCorto(x.dia)} ${x.hamburguesas} hamburguesas"><span class="v">${n === 6 || x.hamburguesas === max ? x.hamburguesas : ''}</span><div class="b" style="height:${x.hamburguesas / max * 100}%"></div><span class="d">${n === 6 ? 'hoy' : diaCorto(x.dia)}</span></div>`).join('');
    $$('.c', $('#rd-semana')).forEach(c => { const x = d.semana[+c.dataset.n]; tooltip(c, () => [[fechaLarga(x.dia), `${x.hamburguesas} hamburguesas`, 'var(--fx-accent)'], ['Ingresos', plata(x.ingresos_cent)], ['Ventas', String(x.ventas)]]); });
    $('#rd-semana-tabla').innerHTML = `<table><thead><tr><th>Día</th><th>Hamburguesas</th><th>Ingresos</th></tr></thead><tbody>${d.semana.map(x => `<tr><td>${fechaLarga(x.dia)}</td><td>${x.hamburguesas}</td><td>${plata(x.ingresos_cent)}</td></tr>`).join('')}</tbody></table>`;
  }
  function pintarEquipo(d) {
    const max = Math.max(1, ...d.equipo.map(e => e.hamburguesas));
    $('#rd-equipo').innerHTML = d.equipo.length ? d.equipo.map(e => `<div class="p"><span>${esc(e.nombre)}</span><span><b>${e.hamburguesas}</b> hamburguesas · ${plata(e.ingresos_cent)}</span><div class="pista"><i style="width:${e.hamburguesas / max * 100}%"></i></div></div>`).join('') : '<p class="rest-sub">Aún nadie registró ventas hoy.</p>';
  }
  function pintarWeb(d) {
    const r = d.resumen;
    $('#rd-web').innerHTML = `<p class="rd-kpi"><span class="valor">${d.pendientes}</span></p><p class="rest-sub" style="margin:6px 0 12px">${d.pendientes ? 'pedidos esperan que el local los confirme.' : 'No hay pedidos esperando.'}</p>
      <p class="rest-sub">Ya confirmados hoy: <b style="color:var(--fx-bg)">${num(r.llevar + r.domicilio)}</b> hamburguesas (${num(r.llevar)} para llevar y ${num(r.domicilio)} a domicilio).</p><p style="margin-top:14px"><a class="rest-btn sec chico" href="personal.html#pedidos">Ir a los pedidos</a></p>`;
  }

  /* ---- secciones (pestañas): una pantalla por tema, con avisos que llevan a donde hay que actuar ---- */
  const TABS = $$('.rd-tab'), IDS = TABS.map(b => b.dataset.p), badges = {};
  function badge(k, n) { badges[k] = n; const el = $('#rd-tab-' + k + ' .n'); if (!el) return; el.hidden = !n; el.textContent = n > 99 ? '99+' : n; }
  function irA(k, desdeUsuario) {
    if (!IDS.includes(k)) k = 'hoy';
    TABS.forEach(b => { const on = b.dataset.p === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    IDS.forEach(i => { $('#rd-p-' + i).hidden = i !== k; });
    try { sessionStorage.setItem('rd_tab', k); } catch (e) { /* sin almacenamiento */ }
    if (history.replaceState) history.replaceState(null, '', '#' + k);
    if (desdeUsuario) window.scrollTo({ top: Math.max(0, $('#rd-app').offsetTop - 8), behavior: 'smooth' });
  }
  function medirCabecera() { const c = document.querySelector('.cabecera'); document.documentElement.style.setProperty('--cab-h', (c ? c.offsetHeight : 0) + 'px'); }
  function pintarAlertas(d) {
    if (!d) return;
    const al = [], ag = d.productos.filter(p => p.estado === 'agotado'), ba = d.productos.filter(p => p.estado === 'bajo'), sin = d.productos.filter(p => p.cuenta_burger && p.estado === 'sin_definir');
    if (d.pendientes) al.push(['crit', 'Pedidos de la web', `${d.pendientes} esperando respuesta`, '<a class="rd-al-ir" href="personal.html#pedidos">Responder</a>']);
    if (ag.length) al.push(['crit', 'Agotado', ag.slice(0, 3).map(p => esc(p.nombre)).join(', ') + (ag.length > 3 ? ` y ${ag.length - 3} más` : ''), '<button type="button" class="rd-al-ir" data-ir="stock">Ver stock</button>']);
    if (ba.length) al.push(['aviso', 'Queda poco', ba.slice(0, 3).map(p => `${esc(p.nombre)} (${p.quedan})`).join(', ') + (ba.length > 3 ? ` y ${ba.length - 3} más` : ''), '<button type="button" class="rd-al-ir" data-ir="stock">Ver stock</button>']);
    if (sin.length) al.push(['info', 'Stock sin cargar', `${sin.length} hamburguesa${sin.length > 1 ? 's' : ''} sin tope hoy`, '<button type="button" class="rd-al-ir" data-ir="stock">Cargar stock</button>']);
    const ib = window.INS && window.INS.alertas;
    if (ib && (ib.agotados || ib.bajos)) al.push([ib.agotados ? 'crit' : 'aviso', 'Bodega', `${ib.agotados ? ib.agotados + ' agotado' + (ib.agotados > 1 ? 's' : '') : ''}${ib.agotados && ib.bajos ? ' y ' : ''}${ib.bajos ? ib.bajos + ' con poco' : ''}`, '<button type="button" class="rd-al-ir" data-ir="bodega">Ver bodega</button>']);
    if (ib && ib.sinCargar) al.push(['info', 'Bodega sin cargar', `${ib.sinCargar} insumo${ib.sinCargar > 1 ? 's' : ''} sin contar`, '<button type="button" class="rd-al-ir" data-ir="bodega">Contar ahora</button>']);
    const ce = window.CEN && window.CEN.alertas;
    if (ce && ce.bajas) al.push(['crit', 'Bodega central', `${ce.bajas} ingrediente${ce.bajas > 1 ? 's' : ''} sin lo suficiente para abastecer al local`, '<button type="button" class="rd-al-ir" data-ir="central">Ver central</button>']);
    if (ce && ce.paraEnviar - (ce.bajas || 0) > 0) al.push(['aviso', 'Para enviar', `${ce.paraEnviar - ce.bajas} ingrediente${ce.paraEnviar - ce.bajas > 1 ? 's' : ''} del local piden reposición`, '<button type="button" class="rd-al-ir" data-ir="central">Preparar envío</button>']);
    if (ce && ce.enCamino) al.push(['info', 'Envíos', `${ce.enCamino} en camino esperando que el local los reciba`, '<button type="button" class="rd-al-ir" data-ir="central">Ver envíos</button>']);
    $('#rd-alertas').innerHTML = al.length ? al.map(([c, t, x, b]) => `<div class="rd-al ${c}"><span class="ic" aria-hidden="true">${c === 'crit' ? '■' : c === 'aviso' ? '▲' : 'ℹ'}</span><span class="tx"><b>${t}</b> ${x}</span>${b}</div>`).join('')
      : '<div class="rd-al ok"><span class="ic" aria-hidden="true">●</span><span class="tx"><b>Todo en orden.</b> Nada urgente por ahora.</span></div>';
    badge('hoy', d.pendientes || 0); badge('stock', ag.length + ba.length); if (ib) badge('bodega', (ib.agotados || 0) + (ib.bajos || 0)); if (ce) badge('central', (ce.paraEnviar || 0) + (ce.enCamino || 0));
  }
  window.RD = { alertas: () => pintarAlertas(D), badge, datos: () => D };
  TABS.forEach(b => {
    b.onclick = () => irA(b.dataset.p, true);
    b.onkeydown = e => { const i = IDS.indexOf(b.dataset.p), j = e.key === 'ArrowRight' ? (i + 1) % IDS.length : e.key === 'ArrowLeft' ? (i + IDS.length - 1) % IDS.length : e.key === 'Home' ? 0 : e.key === 'End' ? IDS.length - 1 : -1;
      if (j >= 0) { e.preventDefault(); irA(IDS[j], true); TABS[j].focus(); } };
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) irA(b.dataset.ir, true); });
  window.addEventListener('resize', medirCabecera);

  function pintar(d) {
    D = d; if (window.INS && window.INS.pintarAlcance) window.INS.pintarAlcance(); pintarAlertas(d); pintarHeroe(d); pintarKpis(d); pintarHoras(d); pintarCanales(d); pintarProductos(d); pintarFeed(d); pintarSemana(d); pintarEquipo(d); pintarWeb(d);
    vivo.classList.remove('caido'); $('#rd-vivo-txt').textContent = `En vivo · actualizado ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: window.RUI.TZ })}`;
    primera = false;
  }
  async function cargar() {
    const c = $('#rd-cuerpo'); if (document.hidden) return;
    try { c.classList.remove('rd-atenuado'); pintar(await window.REST.rpc('dashboard')); }
    catch (e) { vivo.classList.add('caido'); $('#rd-vivo-txt').textContent = 'Sin conexión: mostrando lo último'; c.classList.add('rd-atenuado'); if (/dueño|acceso|JWT|permission/i.test(e.message)) { window.REST.salir(); location.reload(); } }
  }


  /* ---- mini juego (módulo adicional): partidas, ganadores, códigos sin canjear y ajustes del dueño ---- */
  async function juego() {
    const art = $('#rd-juego'); if (!art || document.hidden) return;
    try {
      const j = await window.REST.rpc('juego_resumen'), tasa = j.semana.partidas ? Math.round(j.semana.ganadores / j.semana.partidas * 1000) / 10 : null;
      $('#rd-juego-cifras').innerHTML = [['Partidas hoy', num(j.hoy.partidas)], ['Ganadores hoy', `${num(j.hoy.ganadores)} de ${num(j.premios_dia_max)}`], ['Canjeados hoy', num(j.hoy.canjeados)],
        ['Gana 1 de cada…', tasa ? String(Math.round(100 / tasa)) : '—']].map(([a, b]) => `<div><span class="rotulo">${a}</span><b>${b}</b></div>`).join('') +
        (j.semana.invalidas ? `<div class="aviso"><span class="rotulo">Partidas sospechosas (7 días)</span><b>${num(j.semana.invalidas)}</b></div>` : '');
      $('#rd-juego-sub').textContent = `Premio: ${j.premio}. La semana: ${num(j.semana.partidas)} partidas, ${num(j.semana.ganadores)} ganadores.`;
      $('#rd-juego-pend').innerHTML = j.pendientes.length ? `<h3>Códigos por canjear</h3><ul>${j.pendientes.map(x => `<li><b>${esc(x.codigo)}</b> · ${esc(x.nombre)} · vence ${diaCorto(x.vence.slice(0, 10))}</li>`).join('')}</ul>` : '<p class="rest-sub">No hay premios esperando canje.</p>';
      const f = $('#rd-juego-cfg'); if (!f.dataset.listo) { f.dia.value = j.premios_dia_max; f.dif.value = j.dificultad <= 0.85 ? '0.7' : j.dificultad >= 1.15 ? '1.3' : '1'; f.on.checked = j.activo; f.dataset.listo = '1'; }
    } catch (e) { /* se reintenta */ }
  }
  const fj = $('#rd-juego-cfg');
  if (fj) fj.onsubmit = async e => { e.preventDefault(); try { await window.REST.rpc('juego_config_guardar', { p_activo: fj.on.checked, p_premio: null, p_premios_dia: parseInt(fj.dia.value, 10) || 0, p_dificultad: parseFloat(fj.dif.value) }); aviso('Ajustes del juego guardados.'); juego(); } catch (er) { aviso(er.message, true); } };

  /* ---- acciones ---- */
  function alEntrar() {
    $('#rd-app').hidden = false; cargar(); timer = setInterval(cargar, 4000); juego(); setInterval(juego, 15000);
    if (window.INS && window.INS.arrancar) window.INS.arrancar();
    if (window.AJ) window.AJ.arrancar();
    if (window.CEN && window.CEN.arrancar) window.CEN.arrancar();
    medirCabecera(); let ini = location.hash.slice(1); try { ini = ini || sessionStorage.getItem('rd_tab'); } catch (e) { /* nada */ } irA(ini || 'hoy', false);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(); }); window.addEventListener('storage', cargar);
    if (window.REST.modo === 'demo') $('#rd-demo').hidden = false;
  }
  $('#rd-feed').addEventListener('click', async e => { const b = e.target.closest('[data-ins]'); if (!b) return; await window.INS.alternar(+b.dataset.ins); if (D) pintarFeed(D); });
  $('#rd-salir').onclick = () => { window.REST.salir(); location.reload(); };
  $$('.rd-vistatabla').forEach(b => b.onclick = () => { const k = b.dataset.tabla, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Ver gráfica' : 'Ver tabla'; $('#rd-' + k).hidden = on; $('#rd-' + k + '-tabla').hidden = !on; });
  const sim = async () => { try { const r = await window.REST.rpc('demo_simular'); if (r && r.n) { aviso(`Venta simulada: ${r.n} hamburguesa${r.n > 1 ? 's' : ''}.`); cargar(); } } catch (e) { aviso(e.message, true); } };
  $('#rd-sim').onclick = sim;
  $('#rd-auto').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? 'Detener simulación' : 'Simular ventas cada 6 s'; clearInterval(auto); if (on) { sim(); auto = setInterval(sim, 6000); } };
  $('#rd-reset').onclick = async () => { await window.REST.rpc('demo_reiniciar'); vistos = new Set(); primera = true; cargar(); aviso('Datos de ejemplo reiniciados.'); };

  window.RUI.sesion({ raiz: $('#rd-entrada'), roles: ['admin'], titulo: R.dashboard_txt.entrada_titulo, texto: R.dashboard_txt.entrada_texto, alEntrar });
})();
