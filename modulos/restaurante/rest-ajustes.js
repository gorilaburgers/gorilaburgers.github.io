/* Módulo de restaurante · ajustes del dueño: costo de envío por sector y precios de la carta, editables sin tocar código.
   Los cambios valen para los pedidos nuevos; las ventas ya guardadas conservan su precio. La validación real vive en 010_ajustes.sql. Todo texto de la base va con esc(). */
(() => {
  const raiz = document.getElementById('rd-p-ajustes');
  if (!raiz || !window.RUI) return;
  const { $, $$, esc, aviso } = window.RUI;
  let sectores = [], productos = [], armado = false;
  const cent = v => Math.round(parseFloat(String(v).replace(',', '.')) * 100);
  const dolar = c => (c / 100).toFixed(2);
  const CAT = { vip: 'Hamburguesas VIP', especiales: 'Especiales', peques: 'Peques', papas: 'Papas', bebidas: 'Bebidas', extras: 'Extras' };

  function pintar() {
    $('#aj-sectores').innerHTML = sectores.map((s, n) => `<div class="aj-fila${s.activo ? '' : ' off'}" data-n="${n}"><span class="nom">${esc(s.nombre)}</span>
      <label class="aj-precio"><span class="sr">Costo de envío a ${esc(s.nombre)}</span><b>$</b><input type="number" inputmode="decimal" min="0" max="20" step="0.25" data-r="costo" value="${dolar(s.costo_cent)}"></label>
      <label class="aj-sw"><input type="checkbox" data-r="activo" ${s.activo ? 'checked' : ''}><span>${s.activo ? 'Atiende' : 'Apagado'}</span></label></div>`).join('') || '<p class="rest-sub">Todavía no hay sectores.</p>';
    const grupos = {}; productos.forEach(p => (grupos[p.categoria] = grupos[p.categoria] || []).push(p));
    $('#aj-precios').innerHTML = Object.entries(grupos).map(([cat, ps]) => `<h3 class="aj-grupo">${esc(CAT[cat] || cat)}</h3>` + ps.map(p => `<div class="aj-fila" data-c="${esc(p.clave)}"><span class="nom">${esc(p.nombre)}</span>
      <label class="aj-precio"><span class="sr">Precio de ${esc(p.nombre)}</span><b>$</b><input type="number" inputmode="decimal" min="0.01" max="1000" step="0.05" data-r="precio" value="${dolar(p.precio_cent)}"></label></div>`).join('')).join('');
    armado = true; cambios();
  }
  function lista() {
    const ss = [], ps = [];
    $$('#aj-sectores .aj-fila').forEach(f => { const s = sectores[+f.dataset.n], costo = cent($('[data-r="costo"]', f).value), activo = $('[data-r="activo"]', f).checked;
      f.classList.toggle('off', !activo); $('.aj-sw span', f).textContent = activo ? 'Atiende' : 'Apagado'; f.classList.toggle('cambio', costo !== s.costo_cent || activo !== s.activo);
      if (costo !== s.costo_cent || activo !== s.activo) ss.push({ nombre: s.nombre, costo_cent: costo, activo, antes: s }); });
    $$('#aj-precios .aj-fila').forEach(f => { const p = productos.find(x => x.clave === f.dataset.c), precio = cent($('[data-r="precio"]', f).value);
      f.classList.toggle('cambio', precio !== p.precio_cent); if (precio !== p.precio_cent) ps.push({ clave: p.clave, precio_cent: precio, nombre: p.nombre, antes: p.precio_cent }); });
    return { ss, ps };
  }
  function cambios() {
    if (!armado) return; const { ss, ps } = lista(), n = ss.length + ps.length, bar = $('#aj-guardar');
    bar.hidden = !n;
    $('#aj-cambios').innerHTML = n ? `<b>${n} cambio${n > 1 ? 's' : ''} sin guardar:</b> ` + [...ss.map(s => `Envío ${esc(s.nombre)} $${dolar(s.antes.costo_cent)} → $${dolar(s.costo_cent)}${s.activo !== s.antes.activo ? (s.activo ? ' (se enciende)' : ' (se apaga)') : ''}`),
      ...ps.map(p => `${esc(p.nombre)} $${dolar(p.antes)} → $${dolar(p.precio_cent)}`)].join(' · ') : '';
  }
  async function cargar() {
    try { [sectores, productos] = await Promise.all([window.REST.rpc('sectores_admin'), window.REST.rpc('productos_admin')]); productos = productos.filter(p => p.activo !== false); pintar(); }
    catch (e) { $('#aj-sectores').innerHTML = `<p class="rest-error">${esc(e.message)}</p>`; }
  }
  raiz.addEventListener('input', e => { if (e.target.closest('.aj-fila')) cambios(); });
  raiz.addEventListener('change', e => { if (e.target.closest('.aj-fila')) cambios(); });
  $('#aj-todos-ok').onclick = () => {
    const v = cent($('#aj-todos').value); if (!(v >= 0 && v <= 2000)) { aviso('Escribe un costo entre $0 y $20.', true); return; }
    $$('#aj-sectores [data-r="costo"]').forEach(i => { i.value = dolar(v); }); cambios();
  };
  $('#aj-nuevo').onsubmit = e => {
    e.preventDefault(); const f = e.target, nombre = f.nombre.value.trim(), v = cent(f.costo.value || '0');
    if (nombre.length < 2) { aviso('Escribe el nombre del sector.', true); return; }
    if (!(v >= 0 && v <= 2000)) { aviso('El envío va de $0 a $20.', true); return; }
    if (sectores.some(s => s.nombre.toLowerCase() === nombre.toLowerCase())) { aviso('Ese sector ya existe.', true); return; }
    window.REST.rpc('sectores_guardar_varios', { p_items: [{ nombre, costo_cent: v, activo: true }] }).then(() => { aviso(`Sector «${nombre}» agregado.`); f.reset(); return cargar(); }).catch(er => aviso(er.message, true));
  };
  $('#aj-descartar').onclick = () => pintar();
  $('#aj-ok').onclick = async () => {
    const { ss, ps } = lista(); if (!ss.length && !ps.length) return; const b = $('#aj-ok'); b.disabled = true;
    try {
      if (ss.length) await window.REST.rpc('sectores_guardar_varios', { p_items: ss.map(s => ({ nombre: s.nombre, costo_cent: s.costo_cent, activo: s.activo })) });
      if (ps.length) await window.REST.rpc('precios_guardar', { p_items: ps.map(p => ({ clave: p.clave, precio_cent: p.precio_cent })) });
      aviso('Guardado. Vale para los pedidos nuevos.'); await cargar();
    } catch (er) { aviso(er.message, true); } finally { b.disabled = false; }
  };
  window.AJ = { arrancar: cargar };
})();
