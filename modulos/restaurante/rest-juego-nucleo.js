/* Gorila arriba · núcleo del juego (sin pantalla). El gorila sube por 5 pisos esquivando las hamburguesas que ruedan desde la plancha de arriba; si llega a la cerveza, gana.
   Sin DOM: corre igual en el navegador (window.GorilaNucleo) y en Node (para calibrar la dificultad con un jugador simulado, ver modulos/restaurante/calibrar-juego.js).
   Paso fijo de 1/60 s y azar con semilla (la que entrega la base al abrir la partida). El resultado lo vuelve a validar la base (007_juego.sql): este archivo solo juega. */
(function (raiz) {
  const W = 360, H = 480;
  const PISOS = [   // y = suelo; las hamburguesas ruedan en sentido dir y caen por el extremo abierto
    { y: 452, x0: 0, x1: 360, dir: 1 }, { y: 372, x0: 40, x1: 360, dir: -1 }, { y: 292, x0: 0, x1: 320, dir: 1 },
    { y: 212, x0: 40, x1: 360, dir: -1 }, { y: 132, x0: 0, x1: 300, dir: 1 }];
  const ESCALERAS = [{ x: 300, de: 0, a: 1 }, { x: 70, de: 1, a: 2 }, { x: 300, de: 2, a: 3 }, { x: 70, de: 3, a: 4 }];
  const CERVEZA = { x: 272, y: 132 };
  const GR = 620, SALTO = -190, ANDAR = 70, TREPAR = 48, RADIO = 7, MEDIO = 6, ALTO = 18;

  /* Parámetros que mueven la dificultad. `dificultad` 1.0 = la pensada para que gane ~1 de cada 10. */
  const BASE = { intervalo: 1.8, vel: 74, pEscalera: 0.2, primera: 1.0, limite: 150 };

  function azar(semilla) { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function crear(op) {
    op = op || {};
    const dif = Math.min(1.5, Math.max(0.5, op.dificultad || 1)), r = azar(op.semilla || 12345);
    const P = Object.assign({}, BASE, op.parametros || {});
    const juego = {
      W, H, PISOS, ESCALERAS, CERVEZA, RADIO, MEDIO, ALTO, t: 0, resultado: null, hitos: [], burgers: [], entrada: { izq: false, der: false, arriba: false, abajo: false },
      j: { x: 24, y: PISOS[0].y, vy: 0, vx: 0, piso: 0, estado: 'suelo', dir: 1, esc: null, max: 0, paso: 0 },
      proxima: P.primera, suenaGolpe: false
    };
    const intervalo = () => P.intervalo / (0.75 + 0.25 * dif) * (0.7 + 0.6 * r());
    const vel = () => P.vel * (0.85 + 0.15 * dif) * (0.92 + 0.16 * r());

    juego.saltar = () => {
      const j = juego.j;
      if (juego.resultado || j.estado !== 'suelo') return;
      j.estado = 'salto'; j.vy = SALTO; j.vx = (juego.entrada.der ? 1 : 0) - (juego.entrada.izq ? 1 : 0);
    };

    function escaleraCerca(j, subir) {
      return ESCALERAS.find(e => Math.abs(e.x - j.x) <= 9 && (subir ? e.de === j.piso : e.a === j.piso)) || null;
    }

    function paso(dt) {
      if (juego.resultado) return;
      const j = juego.j, e = juego.entrada;
      juego.t += dt;
      if (juego.t > P.limite) { juego.resultado = 'perdio'; return; }

      // ----- jugador -----
      if (j.estado === 'suelo') {
        const mov = (e.der ? 1 : 0) - (e.izq ? 1 : 0), p = PISOS[j.piso];
        if (mov) { j.x = Math.min(p.x1 - MEDIO, Math.max(p.x0 + MEDIO, j.x + mov * ANDAR * dt)); j.dir = mov; j.paso += dt; }
        const sube = e.arriba && escaleraCerca(j, true), baja = e.abajo && escaleraCerca(j, false);
        if (sube || baja) { j.esc = sube || baja; j.estado = 'escalera'; j.x = j.esc.x; j.sentido = sube ? -1 : 1; }
      } else if (j.estado === 'salto') {
        const p = PISOS[j.piso];
        j.vy += GR * dt; j.y += j.vy * dt; j.x = Math.min(p.x1 - MEDIO, Math.max(p.x0 + MEDIO, j.x + j.vx * ANDAR * dt));
        if (j.y >= p.y) { j.y = p.y; j.vy = 0; j.estado = 'suelo'; }
      } else if (j.estado === 'escalera') {
        const arriba = e.arriba ? -1 : e.abajo ? 1 : 0, meta = j.esc;
        j.y += arriba * TREPAR * dt; j.paso += dt * Math.abs(arriba);
        const yArriba = PISOS[meta.a].y, yAbajo = PISOS[meta.de].y;
        if (j.y <= yArriba) { j.y = yArriba; j.piso = meta.a; j.estado = 'suelo'; j.esc = null; }
        else if (j.y >= yAbajo) { j.y = yAbajo; j.piso = meta.de; j.estado = 'suelo'; j.esc = null; }
      }
      if (j.piso > j.max) { j.max = j.piso; juego.hitos.push(Math.round(juego.t * 100) / 100); }
      if (j.piso === 4 && j.estado === 'suelo' && j.x >= CERVEZA.x - 6) { juego.hitos.push(Math.round(juego.t * 100) / 100); juego.resultado = 'gano'; return; }

      // ----- hamburguesas -----
      juego.proxima -= dt;
      if (juego.proxima <= 0) { juego.burgers.push({ x: 18, y: PISOS[4].y, vx: vel(), vy: 0, piso: 4, estado: 'rueda' }); juego.proxima = intervalo(); }
      for (const b of juego.burgers) {
        if (b.estado === 'rueda') {
          const p = PISOS[b.piso], x0 = b.x; b.x += b.vx * dt;
          if (b.piso > 0) {
            const esc = ESCALERAS.find(s => s.a === b.piso && (x0 - s.x) * (b.x - s.x) <= 0 && x0 !== b.x);
            if (esc && !b.salto && r() < P.pEscalera) { b.estado = 'escalera'; b.x = esc.x; b.esc = esc; continue; }
            if (esc) b.salto = esc.x;    // ya decidió en esta escalera
          }
          if (b.salto && Math.abs(b.x - b.salto) > 12) b.salto = null;
          if (b.piso > 0 && (b.x > p.x1 || b.x < p.x0)) { b.estado = "cae"; b.vy = 0; }
          if (b.piso === 0 && b.x > W + 20) b.muerta = true;
        } else if (b.estado === 'cae') {
          b.vy += GR * dt; b.y += b.vy * dt; const destino = PISOS[b.piso - 1];
          if (b.y >= destino.y) { b.y = destino.y; b.piso -= 1; b.estado = 'rueda'; b.vy = 0; b.vx = Math.abs(b.vx) * destino.dir; b.salto = null; }
        } else if (b.estado === 'escalera') {
          b.y += 60 * dt; const destino = PISOS[b.esc.de];
          if (b.y >= destino.y) { b.y = destino.y; b.piso = b.esc.de; b.estado = 'rueda'; b.vx = Math.abs(b.vx) * destino.dir; b.salto = b.esc.x; b.esc = null; }
        }
        // golpe: rectángulo del gorila contra el círculo de la hamburguesa
        const cx = b.x, cy = b.y - RADIO, qx = Math.max(j.x - MEDIO, Math.min(cx, j.x + MEDIO)), qy = Math.max(j.y - ALTO, Math.min(cy, j.y));
        if ((cx - qx) * (cx - qx) + (cy - qy) * (cy - qy) < (RADIO - 0.8) * (RADIO - 0.8)) { juego.resultado = 'perdio'; juego.suenaGolpe = true; return; }
      }
      juego.burgers = juego.burgers.filter(b => !b.muerta);
    }
    juego.paso = paso;
    juego.parametros = P;
    return juego;
  }

  const api = { crear, W, H, PISOS, ESCALERAS, CERVEZA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.GorilaNucleo = api;
})(typeof window !== 'undefined' ? window : globalThis);
