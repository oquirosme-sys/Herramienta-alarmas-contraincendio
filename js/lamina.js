/* Láminas de alarma contra incendio: diagrama unifilar (DU), matriz de entradas/salidas y cálculos.
 * Un solo modelo de dibujo (líneas, polilíneas, círculos, textos; mm; Y hacia arriba) se muestra como SVG en pantalla
 * y se exporta como DXF (capas FA-*) para pegarlo en las láminas del proyecto. Símbolos: NFPA 170 cap. 8 (js/simbolos-nfpa170.js). */
(function (global) {
  'use strict';

  /* ---------- capas (nombre → color AutoCAD / color en pantalla) ---------- */
  var CAPAS = {
    'FA-MARCO': [7, '#111'], 'FA-TEXTO': [7, '#111'], 'FA-SIMBOLOS': [7, '#111'], 'FA-TABLA': [7, '#111'],
    'FA-SLC': [3, '#1b9e3a'], 'FA-NAC': [30, '#a0522d'], 'FA-IDNAC': [30, '#a0522d'], 'FA-VOCEO': [30, '#a0522d'], 'FA-NAC-VOCEO': [30, '#a0522d'],
    'FA-24VDC': [7, '#111'], 'FA-IDC': [3, '#1b9e3a'], 'FA-RED': [150, '#6c8cff'], 'FA-TELEFONO': [5, '#1f3bd1'], 'FA-ENCABEZADO': [5, '#1f4e79'], 'FA-ALERTA': [1, '#c00000'], 'FA-TEXTO-BLANCO': [7, '#fff'], 'FA-CAJETIN': [7, '#111']
  };
  var CAPA_DE_TIPO = { SLC: 'FA-SLC', NAC: 'FA-NAC', IDNAC: 'FA-IDNAC', VOCEO: 'FA-VOCEO', 'NAC+VOCEO': 'FA-NAC-VOCEO', '24VDC': 'FA-24VDC', IDC: 'FA-IDC' };

  /* ---------- símbolos NFPA 170 ---------- */
  var SIM = {};
  (global.SIMBOLOS_NFPA170 || []).forEach(function (s) { SIM[s.id] = s; });
  function caja(s) {
    if (s._c) return s._c;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    function pt(x, y) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    s.g.forEach(function (it) {
      if (it[0] === 'L') { pt(it[1], it[2]); pt(it[3], it[4]); }
      else if (it[0] === 'C') { pt(it[1] - it[3], it[2] - it[3]); pt(it[1] + it[3], it[2] + it[3]); }
      else if (it[0] === 'P') it[2].forEach(function (q) { pt(q[0], q[1]); });
      else if (it[0] === 'H') it[1].forEach(function (q) { pt(q[0], q[1]); });
    });
    if (x0 > x1) { x0 = y0 = -3; x1 = y1 = 3; }
    return (s._c = { w: x1 - x0, h: y1 - y0 });
  }

  /* TAG del catálogo → símbolo NFPA 170 (id). Las etiquetas «AIM», «AOM», etc. vienen dentro del propio símbolo. */
  var SIM_TAG = [
    [/^FACP/, 'FA016'], [/^TRP/, 'FA018'], [/^ANN/, 'FA013'], [/^AMP/, 'FA002'], [/^RPS/, 'FA025'],
    [/^SD-DUCTO|^RTS/, 'FA133'], [/^SDH-C/, 'FA132'], [/^SDT/, 'FA079'], [/^CO\+SB/, 'FA127'], [/^CO-B/, 'FA076'], [/^TC4/, 'FA096'], [/^CO/, 'FA127'], [/^SDH/, 'FA132'],
    [/^BH/, 'FA130'], [/^EM/, 'FA118'], [/^AIM/, 'FA064'], [/^AOM/, 'FA066'], [/^ZAM|^ISO/, 'FA067'], [/^RLY/, 'FA088'],
    [/^SS/, 'FA100'], [/^WF/, 'FA090'], [/^VS/, 'FA104'], [/^SB/, 'FA134'],
    [/^ST-C-WRF/, 'FA157'], [/^ST-WRF/, 'FA158'], [/^SPK\+ST-C/, 'FA154'], [/^SPK\+ST/, 'FA155'], [/^SPK/, 'FA151'],
    [/^ST-C/, 'FA154'], [/^ST-P/, 'FA155'], [/^AV-C/, 'FA142'], [/^AV-P/, 'FA142'],
    [/^J-PH/, 'FA163'], [/^J/, 'FA166']
  ];
  function simboloDe(d) {
    var tag = (d && d.tag) || '';
    if (/^(TRP|CO-B|TC4)/.test(tag)) { for (var k = 0; k < SIM_TAG.length; k++) if (SIM_TAG[k][0].test(tag)) return SIM_TAG[k][1]; }
    var fila = global.Simbologia && global.Simbologia.filaDe(d);   // símbolo según la simbología CDCLH-001S
    if (fila) return fila.sim;
    for (var i = 0; i < SIM_TAG.length; i++) if (SIM_TAG[i][0].test(tag)) return SIM_TAG[i][1];
    return 'FA001';
  }

  /* ======================= LEYENDA DE SIMBOLOGÍA (CDCLH-001S + modelos del catálogo) ======================= */
  function claveSimb(d) { var r = global.Simbologia && global.Simbologia.filaDe(d); return r ? r.id : d.id; }
  function nombreFab(cx, id) { return cx.fabricantes && cx.fabricantes[id] ? cx.fabricantes[id].nombre : String(id || '').toUpperCase(); }
  function unicos(a) { var o = [], v = {}; a.forEach(function (x) { if (x && !v[x]) { v[x] = 1; o.push(x); } }); return o; }

  /* dispositivos distintos usados en el proyecto (con cantidad) */
  function dispositivosUsados(ctx) {
    var P = ctx.proy, cx = ctx.cx, Calc = ctx.Calc, ids = [], lista = [];
    P.paneles.concat(P.fuentes).forEach(function (eq) {
      (eq.filas || []).forEach(function (f) {
        var dsp = cx.disp[f.disp];
        if (!dsp || !Calc.num(f.cant) || /^(FACP|TRP|OTRO)$/.test(dsp.tag)) return;
        if (ids.indexOf(dsp.id) < 0) { ids.push(dsp.id); lista.push(dsp); }
      });
    });
    return lista;
  }

  /* referencia automática: la de la lámina CDCLH-001S de cada fabricante + los modelos del catálogo (usados, o los del fabricante del proyecto) */
  function refAuto(row, devs, P, cx) {
    var fabs = unicos(devs.map(function (q) { return q.fabricante; })), lineas = [];
    if (!fabs.length) fabs = [P.fabricante];
    fabs.forEach(function (fid) {
      var nom = nombreFab(cx, fid), pdf = row && row.ref && row.ref[fid] ? row.ref[fid] : '';
      var propios = devs.filter(function (q) { return q.fabricante === fid; });
      if (!devs.length && row && global.Simbologia) propios = (cx.raw.dispositivos || []).filter(function (q) { return q.fabricante === fid && global.Simbologia.filaDe(q) === row; });
      function sinAcento(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
      var modelos = unicos(propios.map(function (q) { return q.modelo; })).filter(function (m) { return m && m !== '—' && sinAcento(pdf).indexOf(sinAcento(m)) < 0; });
      if (pdf) lineas.push('REFERENCIA ' + nom + ': ' + pdf);
      if (modelos.length) lineas.push((pdf ? 'ADEMÁS EN CATÁLOGO ' : 'REFERENCIA ') + nom + ': ' + modelos.slice(0, 6).join(', '));
    });
    return lineas.join('\n');
  }

  /* filas de la leyenda: por cada fila de la simbología, los dispositivos del proyecto que le corresponden; modo «on»/«off» por fila; todas = lámina de simbología completa */
  function itemsLeyenda(ctx, devs, numDe, todas) {
    var P = ctx.proy, cx = ctx.cx, ov = P.simbDU || {}, Sb = global.Simbologia, porFila = {}, sueltos = [], items = [];
    devs.forEach(function (dsp) { var r = Sb && Sb.filaDe(dsp); if (r) (porFila[r.id] = porFila[r.id] || []).push(dsp); else sueltos.push(dsp); });
    if (Sb) Sb.filas.forEach(function (r) {
      var o = ov[r.id] || {}, usado = !!porFila[r.id];
      if (o.modo === 'off') return;
      if (!usado && !(o.modo === 'on' || todas)) return;
      var dv = porFila[r.id] || [];
      items.push({ row: r, devs: dv, num: usado ? numDe[r.id] : null, sid: dv.length ? simboloDe(dv[0]) : r.sim, desc: o.desc || r.desc, refOv: o.ref });
    });
    sueltos.forEach(function (dsp) { items.push({ row: null, devs: [dsp], num: numDe[dsp.id], sid: simboloDe(dsp), desc: (dsp.tipo ? dsp.tipo + ' — ' : '') + (dsp.descripcion || ''), refOv: '' }); });
    items.forEach(function (it) { it.ref = it.refOv ? String(it.refOv) : refAuto(it.row, it.devs, P, cx); });
    return items;
  }

  function dibujarLeyenda(d, lx, yy, lw, items) {
    var cw = 24, rw = 64, dw = lw - cw - rw - 4;
    items.forEach(function (it) {
      var ld = partir(it.desc, 2.3, dw), lr = [];
      String(it.ref || '').split('\n').forEach(function (par) { partir(par, 2.1, rw - 3).forEach(function (l) { lr.push(l); }); });
      var al = Math.max(15, Math.max(ld.length * 3.5, lr.length * 3.2) + 5), cb = caja(SIM[it.sid] || SIM.FA001), esc = Math.min(1.4, 12 / Math.max(cb.w, cb.h));
      d.R(lx, yy - al, lw, al, 'FA-TABLA'); d.L(lx + cw, yy, lx + cw, yy - al, 'FA-TABLA'); d.L(lx + lw - rw, yy, lx + lw - rw, yy - al, 'FA-TABLA');
      d.S(it.sid, lx + 12, yy - al / 2, esc, 'FA-SIMBOLOS');
      if (it.num) { d.C(lx + 4, yy - 4, 2.2, 'FA-TEXTO'); d.T(lx + 4, yy - 4.8, it.num, 2.2, 'FA-TEXTO', 'c'); }
      ld.forEach(function (t, k) { d.T(lx + cw + 2, yy - 5 - k * 3.5, t, 2.3, 'FA-TEXTO'); });
      lr.forEach(function (t, k) { d.T(lx + lw - rw + 2, yy - 5 - k * 3.2, t, 2.1, 'FA-TEXTO'); });
      yy -= al;
    });
    return yy;
  }

  /* ---------- modelo de dibujo ---------- */
  function Dib(w, h) { this.w = w; this.h = h; this.e = []; }
  Dib.prototype = {
    L: function (x1, y1, x2, y2, capa, ancho) { var e = { k: 'L', a: [x1, y1, x2, y2], c: capa || 'FA-TEXTO' }; if (ancho) e.w = ancho; this.e.push(e); return this; },
    P: function (pts, cerr, capa, relleno) { this.e.push({ k: 'P', p: pts, z: !!cerr, c: capa || 'FA-TEXTO', f: !!relleno }); return this; },
    C: function (x, y, r, capa) { this.e.push({ k: 'C', a: [x, y, r], c: capa || 'FA-TEXTO' }); return this; },
    R: function (x, y, w, h, capa, relleno) { return this.P([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, capa, relleno); },
    /* al: 'l' | 'c' | 'r'; rot en grados */
    T: function (x, y, txt, h, capa, al, rot) {
      if (txt === null || txt === undefined || txt === '') return this;
      this.e.push({ k: 'T', a: [x, y], t: String(txt), h: h || 2.5, c: capa || 'FA-TEXTO', al: al || 'l', r: rot || 0 }); return this;
    },
    /* inserta un símbolo NFPA 170 centrado en (x,y) con escala s (el símbolo se explota en primitivas) */
    S: function (id, x, y, s, capa) {
      var sim = SIM[id] || SIM.FA001; if (!sim) return this;
      capa = capa || 'FA-SIMBOLOS'; s = s || 1;
      var self = this;
      sim.g.forEach(function (it) {
        if (it[0] === 'L') self.L(x + it[1] * s, y + it[2] * s, x + it[3] * s, y + it[4] * s, capa);
        else if (it[0] === 'C') self.C(x + it[1] * s, y + it[2] * s, it[3] * s, capa);
        else if (it[0] === 'P') self.P(it[2].map(function (q) { return [x + q[0] * s, y + q[1] * s]; }), it[1] === 1, capa);
        else if (it[0] === 'H') self.P(it[1].map(function (q) { return [x + q[0] * s, y + q[1] * s]; }), true, capa, true);
        else if (it[0] === 'T') self.T(x + it[1] * s, y + it[2] * s, it[4], it[3] * s, capa);
      });
      return this;
    },
    ancho: function (txt, h) { return String(txt).length * (h || 2.5) * 0.62; }
  };

  function partir(txt, h, maxAncho) {
    var max = Math.max(4, Math.floor(maxAncho / (h * 0.62))), pal = String(txt || '').split(/\s+/), lin = [], cur = '';
    pal.forEach(function (p) {
      if ((cur + ' ' + p).trim().length > max && cur) { lin.push(cur); cur = p; } else cur = (cur + ' ' + p).trim();
    });
    if (cur) lin.push(cur);
    return lin.length ? lin : [''];
  }

  /* ---------- salida SVG ---------- */
  function xml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function aSVG(d) {
    var H = d.h, o = [];
    function col(c) { return (CAPAS[c] || CAPAS['FA-TEXTO'])[1]; }
    d.e.forEach(function (e) {
      var c = col(e.c);
      if (e.k === 'L') o.push('<line' + (e.w ? ' stroke-width="' + e.w + '"' : '') + ' x1="' + e.a[0].toFixed(2) + '" y1="' + (H - e.a[1]).toFixed(2) + '" x2="' + e.a[2].toFixed(2) + '" y2="' + (H - e.a[3]).toFixed(2) + '" stroke="' + c + '"/>');
      else if (e.k === 'C') o.push('<circle cx="' + e.a[0].toFixed(2) + '" cy="' + (H - e.a[1]).toFixed(2) + '" r="' + e.a[2].toFixed(2) + '" fill="none" stroke="' + c + '"/>');
      else if (e.k === 'P') o.push('<' + (e.z ? 'polygon' : 'polyline') + ' points="' + e.p.map(function (q) { return q[0].toFixed(2) + ',' + (H - q[1]).toFixed(2); }).join(' ') + '" fill="' + (e.f ? c : 'none') + '" stroke="' + c + '"/>');
      else if (e.k === 'T') {
        var x = e.a[0], y = H - e.a[1];
        o.push('<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" font-size="' + e.h.toFixed(2) + '" fill="' + c + '" stroke="none" text-anchor="' + ({ l: 'start', c: 'middle', r: 'end' }[e.al]) + '"' +
          (e.r ? ' transform="rotate(' + (-e.r) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ')"' : '') + '>' + xml(e.t) + '</text>');
      }
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + d.w + ' ' + d.h + '" font-family="Arial, Helvetica, sans-serif" style="background:#fff">' +
      '<g stroke-width="0.25" stroke-linejoin="round">' + o.join('') + '</g></svg>';
  }

  /* ---------- salida DXF (formato R12: lo abre cualquier AutoCAD) ---------- */
  function aDXF(d) {
    var o = [], capas = {};
    function g(c, v) { o.push(String(c), String(v)); }
    function n(v) { return (+v).toFixed(3); }
    function txt(s) { // acentos y ñ como \U+XXXX (AutoCAD los decodifica en cualquier TEXT)
      return String(s).replace(/[^\x20-\x7e]/g, function (ch) { return '\\U+' + ('0000' + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4); });
    }
    d.e.forEach(function (e) { capas[e.c] = 1; });
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1); g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0); g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(capas).length);
    Object.keys(capas).forEach(function (c) { g(0, 'LAYER'); g(2, c); g(70, 0); g(62, (CAPAS[c] || CAPAS['FA-TEXTO'])[0]); g(6, 'CONTINUOUS'); });
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1); g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 2.5); g(3, 'txt'); g(4, ''); g(0, 'ENDTAB');
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    d.e.forEach(function (e) {
      if (e.k === 'L' && e.w) { g(0, 'POLYLINE'); g(8, e.c); g(66, 1); g(70, 0); g(40, e.w); g(41, e.w); [[e.a[0], e.a[1]], [e.a[2], e.a[3]]].forEach(function (q) { g(0, 'VERTEX'); g(8, e.c); g(10, n(q[0])); g(20, n(q[1])); g(30, 0); }); g(0, 'SEQEND'); g(8, e.c); }
      else if (e.k === 'L') { g(0, 'LINE'); g(8, e.c); g(10, n(e.a[0])); g(20, n(e.a[1])); g(30, 0); g(11, n(e.a[2])); g(21, n(e.a[3])); g(31, 0); }
      else if (e.k === 'C') { g(0, 'CIRCLE'); g(8, e.c); g(10, n(e.a[0])); g(20, n(e.a[1])); g(30, 0); g(40, n(e.a[2])); }
      else if (e.k === 'P') {
        if (e.f && e.p.length >= 3) { // relleno: abanico de triángulos (SOLID) — válido para formas convexas (puntos, flechas)
          for (var i = 1; i < e.p.length - 1; i++) {
            var a = e.p[0], b = e.p[i], c = e.p[i + 1];
            g(0, 'SOLID'); g(8, e.c); g(10, n(a[0])); g(20, n(a[1])); g(30, 0); g(11, n(b[0])); g(21, n(b[1])); g(31, 0);
            g(12, n(c[0])); g(22, n(c[1])); g(32, 0); g(13, n(c[0])); g(23, n(c[1])); g(33, 0);
          }
        }
        g(0, 'POLYLINE'); g(8, e.c); g(66, 1); g(70, e.z ? 1 : 0);
        e.p.forEach(function (q) { g(0, 'VERTEX'); g(8, e.c); g(10, n(q[0])); g(20, n(q[1])); g(30, 0); });
        g(0, 'SEQEND'); g(8, e.c);
      } else if (e.k === 'T') {
        g(0, 'TEXT'); g(8, e.c); g(10, n(e.a[0])); g(20, n(e.a[1])); g(30, 0); g(40, n(e.h)); g(1, txt(e.t));
        if (e.r) g(50, n(e.r));
        g(7, 'STANDARD');
        if (e.al !== 'l') { g(72, e.al === 'c' ? 1 : 2); g(11, n(e.a[0])); g(21, n(e.a[1])); g(31, 0); g(73, 0); }
      }
    });
    g(0, 'ENDSEC'); g(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  /* ---------- datos comunes ---------- */
  function fmt(v, d) {
    if (v === null || v === undefined || v === '' || !isFinite(v)) return '—';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d });
  }
  function nombreEquipo(eq) { return (eq && eq.tag) || '(sin TAG)'; }

  /* ======================= MATRIZ DE ENTRADAS / SALIDAS ======================= */
  function matrizBase() {
    var E = ['System Smoke Detectors (1) (10)', 'System Heat Detectors (7)', 'Elevator Lobby smoke detectors (2)', 'Guestroom System Smoke Sensors (3)',
      'Manual Pull Stations', 'Waterflow Switches', 'Dry Sprinkler Pressure Switches', 'Type 1 - Grease Hood & Duct Fire Suppression',
      'Low / High Air Supply Switches', 'Duct Smoke Sensors', 'Sprinkler Valve Tamper Switches', 'Fire Pump Signals (8)', 'Emergency Generator Signals (9)', 'Carbon Monoxide Signals'];
    function marcas(lista) { var r = {}; lista.forEach(function (x) { if (Array.isArray(x)) r[x[0]] = x[1]; else r[x] = 'X'; }); return r; }
    var todas = []; for (var i = 0; i < 14; i++) todas.push(i);
    var S = [
      ['FACP: Display an audible / visual alarm.', '', todas],
      ['Remote Annunciator: Display an audible / visual alarm.', '', todas],
      ['Audible / Visual Alarms: Activate audible / visual strobe appliances on affected floor.', '(5)', [0, 1, 4, 5, 6, 7]],
      ['Fire Doors: Release all magnetic door holders on floor in alarm.', '', [0, 1, 5, 6]],
      ['Stairwell Pressurization: Automatically activate pressurization.', '', [0, 1, 4, 5, 6]],
      ['Smoke Exhaust: Automatically activate exhaust system in alarm zones.', '', [0, 1, [5, 'X(4)'], [6, 'X(4)']]],
      ['Guestroom Audible Alarms: Activate alarms in rooms on affected floor.', '(5)', [0, 1, 4, 5, 6, 7]],
      ['Guestrooms Audible / Visual Signals: Activate both signals in hearing impaired guestrooms on affected floor.', '', [0, 1, 4, 5, 6, 7]],
      ['Local Audible Alarms: Activate audible signals only in rooms containing alarm.', '', [3, [13, 'X(6)']]],
      ['Guestroom Local Audible / Visual Signals: Activate both signals in hearing impaired guestroom containing alarm.', '(6)', [3, [13, 'X(6)']]],
      ['Air Handlers: Automatically shut off associated air handlers.', '', [9]],
      ['Cooking Area Gas / Electric: Automatically shut off associated cooking line gas & electric and associated makeup air.', '', [7]],
      ['Elevator Phase 1 Designated Level and Alternate Level Recall, Phase 2 Firefighters\' In-Car Operation.', '', [2]]
    ];
    return {
      titulo: 'FIRE ALARM SYSTEM', subtitulo: 'Input / Output Matrix',
      fuente: 'Matriz base (modelo ED-6201, NFPA 72:2022 cap. 21 — funciones de salida por señal de entrada)',
      generales: [
        'Reference numbers are shown in parenthesis (1) for "Notes / Notations" indicated below and in headings to the right.',
        'Fire alarm system devices are point addressable.',
        'On campus style properties, provide point addressable intelligent networking reporting to continuously attended property location.',
        'Sprinkler system water flow and tamper switches are annunciated on the FACP.'
      ],
      entradas: E.map(function (n, i) { return { id: 'e' + (i + 1), nombre: n }; }),
      salidas: S.map(function (s, i) {
        var mk = {};
        var r = marcas(s[2]); Object.keys(r).forEach(function (k) { mk['e' + (+k + 1)] = r[k]; });
        return { id: 's' + (i + 1), texto: s[0], nota: s[1], marcas: mk };
      }),
      notas: [
        '(1) System smoke detectors not located in guestrooms.',
        '(2) Provide Elevator Phase 1 Designated Level and Alternate Level Recall, Shunt Trip Function and Phase 2 Firefighters\' In-Car Operation in compliance with ASME A17.1, Elevator Code.',
        '(3) Guestroom Smoke Detectors: Provide photoelectric type, with sounder base (minimum ratings of 85 dBA, with 75 dBA "at the pillow"). In suites, multiple detectors shall activate simultaneously.',
        '(4) Except on guestroom floors, waterflow alarms shall not activate smoke control exhaust fans where smoke control zones and fire sprinkler zones do not correspond.',
        '(5) Fire alarms shall activate only on floor of alarm. Governing authority may require additional zoning.',
        '(6) Carbon monoxide monitors in guestrooms, public and BOH areas shall activate an alarm in the guestroom and rooms of incident and at the fire alarm control panel.',
        '(7) Heat detectors are not recommended since fire sprinklers serve the same function.',
        '(8) Provide "fire pump run" and "fire pump fault" supervisory signals from controller to the FACP, as a minimum.',
        '(9) Provide "generator run" and "generator fault" supervisory signals to the FACP.',
        '(10) Provide positive alarm sequence for non-guestroom smoke detectors in high-rise buildings.'
      ]
    };
  }

  /* Dibujo de la matriz. Origen arriba a la izquierda de la hoja (x0, y0 = borde superior). */
  function dibujarMatriz(d, M, x0, yTop) {
    var CA = 105, CN = 16, CE = 13, HH = 78, RH = 11, h = 2.4;
    var n = M.entradas.length, ancho = CA + CN + n * CE, y = yTop;
    d.T(x0, y, M.titulo || 'FIRE ALARM SYSTEM', 6, 'FA-TEXTO');
    d.T(x0, y - 8, M.subtitulo || 'Input / Output Matrix', 4, 'FA-TEXTO');
    y -= 20;
    d.T(x0, y, 'General Notes:', 3, 'FA-TEXTO'); y -= 5;
    (M.generales || []).forEach(function (t) {
      partir('• ' + t, 2.2, ancho).forEach(function (l) { d.T(x0, y, l, 2.2, 'FA-TEXTO'); y -= 3.6; });
    });
    y -= 6;
    // encabezado
    d.R(x0, y - HH, ancho, HH, 'FA-ENCABEZADO');
    d.L(x0 + CA, y, x0 + CA, y - HH, 'FA-ENCABEZADO'); d.L(x0 + CA + CN, y, x0 + CA + CN, y - HH, 'FA-ENCABEZADO');
    d.T(x0 + CA / 2, y - HH / 2, 'Action / Output', 3.2, 'FA-ENCABEZADO', 'c');
    d.T(x0 + CA + CN / 2, y - HH / 2, 'Notes', 2.8, 'FA-ENCABEZADO', 'c');
    M.entradas.forEach(function (e, i) {
      var cx = x0 + CA + CN + i * CE;
      if (i) d.L(cx, y, cx, y - HH, 'FA-ENCABEZADO');
      // texto vertical (de abajo hacia arriba); si es largo se parte en dos líneas
      var l = partir(e.nombre, h, HH - 6);
      if (l.length > 2) l = [l[0], l.slice(1).join(' ')];
      l.forEach(function (t, k) { d.T(cx + CE / 2 + 1 + (l.length === 2 ? (k ? 0.5 : 3.3) - 2.2 : 0), y - HH + 3, t, h, 'FA-ENCABEZADO', 'l', 90); });
    });
    y -= HH;
    // filas
    M.salidas.forEach(function (s) {
      var lin = partir(s.texto, h, CA - 4), alto = Math.max(RH, lin.length * 3.6 + 4);
      d.R(x0, y - alto, ancho, alto, 'FA-TABLA');
      d.L(x0 + CA, y, x0 + CA, y - alto, 'FA-TABLA'); d.L(x0 + CA + CN, y, x0 + CA + CN, y - alto, 'FA-TABLA');
      lin.forEach(function (t, k) { d.T(x0 + 2, y - 4.5 - k * 3.6, t, h, 'FA-TEXTO'); });
      d.T(x0 + CA + CN / 2, y - alto / 2 - 1, s.nota || '', h, 'FA-TEXTO', 'c');
      M.entradas.forEach(function (e, i) {
        var cx = x0 + CA + CN + i * CE;
        if (i) d.L(cx, y, cx, y - alto, 'FA-TABLA');
        if (s.marcas && s.marcas[e.id]) d.T(cx + CE / 2, y - alto / 2 - 1.2, s.marcas[e.id], 3, 'FA-ENCABEZADO', 'c');
      });
      y -= alto;
    });
    y -= 8;
    d.T(x0, y, 'Notes / Notations:', 3, 'FA-TEXTO'); y -= 5;
    (M.notas || []).forEach(function (t) {
      partir(t, 2.2, ancho + 60).forEach(function (l, k) { d.T(x0 + (k ? 5 : 0), y, l, 2.2, 'FA-TEXTO'); y -= 3.6; });
    });
    return { ancho: ancho, yFin: y };
  }

  /* ======================= CÁLCULOS: caída de tensión + baterías ======================= */
  function dibujarCalculos(d, ctx, x0, yTop) {
    var P = ctx.proy, cx = ctx.cx, Calc = ctx.Calc, cd = Calc.caida(cx, P);
    var equipos = P.paneles.map(function (p) { return { eq: p, r: Calc.panel(cx, p, P), tipo: 'p' }; })
      .concat(P.fuentes.map(function (f) { return { eq: f, r: Calc.fuente(cx, f, P), tipo: 'f' }; }));
    var cols = [['FUENTE / PANEL', 24], ['CIRCUITO / LAZO', 22], ['NIVEL / DESCRIPCIÓN', 40], ['I CIRCUITO (mA)', 20], ['CABLE', 46], ['R (Ω/km)', 15], ['LONG. IDA (m)', 17], ['R LAZO (Ω)', 17],
      ['V FUENTE (V)', 17], ['CAÍDA (V)', 16], ['V EN DISP. (V)', 17], ['% CAÍDA', 15], ['ESTADO', 28]];
    var W = cols.reduce(function (a, c) { return a + c[1]; }, 0), y = yTop, h = 2.3;
    d.T(x0, y, 'CÁLCULOS — ' + (P.nombre || '') + (P.numero ? ' (' + P.numero + ')' : ''), 5, 'FA-TEXTO'); y -= 8;
    d.T(x0, y, (P.normativa || '') + ' · V fuente = ' + fmt(cd.params.vFuente, 1) + ' V · V mín = ' + fmt(cd.params.vMin, 0) + ' V · I máx NAC = ' + fmt(cd.params.iMaxNac, 1) + ' A', 2.6, 'FA-TEXTO'); y -= 10;
    equipos.forEach(function (E) {
      (d.cortes = d.cortes || []).push(y + 6);
      var eq = E.eq, lazos = P.caida.circuitos.map(function (c, i) { return { c: c, r: cd.circuitos[i] }; }).filter(function (x) { return x.c.fuente === eq.id; });
      // tabla de caída de tensión
      if (lazos.length) {
        var x = x0;
        d.R(x0, y - 11, W, 11, 'FA-ENCABEZADO', false);
        cols.forEach(function (c, i) {
          partir(c[0], 2, c[1] - 2).slice(0, 3).forEach(function (t, k, a) { d.T(x + c[1] / 2, y - 5.5 + (a.length - 1) * 1.7 - k * 3.4, t, 2, 'FA-ENCABEZADO', 'c'); });
          if (i) d.L(x, y, x, y - 11, 'FA-ENCABEZADO'); x += c[1];
        });
        y -= 11;
        lazos.forEach(function (z) {
          var cab = z.c.cable ? cx.cables[z.c.cable] : null, r = z.r;
          var v = [nombreEquipo(eq), z.c.circuito, z.c.nivel || z.c.desc || '', r.iMa === null ? '—' : fmt(r.iMa, 0),
            cab ? (cab.fabricante + ' ' + cab.modelo + ' (' + cab.awg + ' AWG)') : '—', cab ? fmt(cab.rKm, 2) : '—', z.c.long === null || z.c.long === '' ? '—' : fmt(z.c.long, 0),
            fmt(r.rLazo, 3), fmt(r.vFuente, 1), fmt(r.caida, 2), fmt(r.vDisp, 2), r.pct === null ? '—' : fmt(r.pct * 100, 1) + '%', r.estado || '—'];
          var xx = x0;
          d.R(x0, y - 6, W, 6, 'FA-TABLA');
          cols.forEach(function (c, i) {
            var t = v[i], mx = Math.floor((c[1] - 2) / (h * 0.62)); if (String(t).length > mx) t = String(t).slice(0, mx - 1) + '…';
            d.T(xx + (i < 3 || i === 4 ? 1.2 : c[1] / 2), y - 4, t, h, i === 12 && /ERROR/.test(r.estado) ? 'FA-ALERTA' : 'FA-TEXTO', i < 3 || i === 4 ? 'l' : 'c');
            if (i) d.L(xx, y, xx, y - 6, 'FA-TABLA'); xx += c[1];
          });
          y -= 6;
        });
        y -= 4;
      }
      // tarjeta de batería (hoja BAT_xxx)
      var b = E.r.bat, ancho = 150, filas = [
        ['CORRIENTE TOTAL EN ESPERA (A)', fmt(b.iEsp, 4)], ['TIEMPO DE ESPERA (h)', fmt(b.tEsp, 1)], ['CAPACIDAD EN ESPERA (Ah)', fmt(b.ahEsp, 3)],
        ['CORRIENTE TOTAL EN ALARMA (A)', fmt(b.iAlm, 4)], ['TIEMPO DE ALARMA (h)', fmt(b.tAlmMin / 60, 3)], ['CAPACIDAD EN ALARMA (Ah)', fmt(b.ahAlm, 3)],
        ['CAPACIDAD CALCULADA (Ah)', fmt(b.ahCalc, 3)], ['FACTOR DE SEGURIDAD', fmt(b.fs * 100, 0) + '%'], ['CAPACIDAD MÍNIMA REQUERIDA (Ah)', fmt(b.ahReq, 3)],
        ['BATERÍA SELECCIONADA (Ah, estándar)', b.ah === null ? (b.excede ? 'EXCEDE LA MAYOR BATERÍA' : '—') : fmt(b.ah, 1)], ['REFERENCIA', b.referencia]
      ];
      var alto = 8 + filas.length * 5;
      d.R(x0, y - alto, ancho, alto, 'FA-TABLA');
      d.P([[x0, y], [x0 + ancho, y], [x0 + ancho, y - 8], [x0, y - 8]], true, 'FA-ALERTA', true);
      d.T(x0 + ancho / 2, y - 5.6, 'CÁLCULO DE CAPACIDAD DE BATERÍA (NFPA 72:2022 §10.6.7 / UL 864) — ' + nombreEquipo(eq), 2.8, 'FA-TEXTO-BLANCO', 'c');
      d.L(x0 + ancho * 0.62, y - 8, x0 + ancho * 0.62, y - alto, 'FA-TABLA');
      filas.forEach(function (f, i) {
        var yy = y - 8 - (i + 1) * 5;
        if (i) d.L(x0, yy + 5, x0 + ancho, yy + 5, 'FA-TABLA');
        d.T(x0 + 1.5, yy + 1.6, f[0], 2.4, 'FA-TEXTO'); d.T(x0 + ancho * 0.62 + ancho * 0.19, yy + 1.6, f[1], 2.4, /EXCEDE/.test(f[1]) ? 'FA-ALERTA' : 'FA-TEXTO', 'c');
      });
      d.T(x0, y - alto - 3.5, 'Configuración: 2 baterías 12 V en serie = 24 VDC. Verifique dimensiones vs. gabinete y capacidad máxima del cargador según ficha.', 1.9, 'FA-TEXTO');
      y -= alto + 12;
    });
    if (!equipos.length) d.T(x0, y, 'El proyecto no tiene paneles ni fuentes: agregue niveles para ver los cálculos.', 3, 'FA-TEXTO');
    return { ancho: W, yFin: y };
  }

  /* ======================= NOTAS DEL DIAGRAMA (editables, con casilla para apagarlas) =======================
   * facp: notas con flecha junto al FACP (ED-6200). grupo 'h' = encabezado de la lista de botones de desconexión; 'i' = cada botón (se rotula A, B, C… en orden).
   * gen: notas de la tabla «NOTAS SISTEMA…». Fichas {tEspera}, {tAlarma} y {facpRef} se reemplazan al dibujar. */
  function notasDUBase() {
    var n = 0;
    function f(txt, grupo) { return { id: 'nf' + (++n), on: true, txt: txt, grupo: grupo || '' }; }
    function g(txt) { return { id: 'ng' + (++n), on: true, txt: txt }; }
    return {
      facp: [
        f('PANEL DE ALARMA CONTRA INCENDIO UBICADO EN CUARTO DE COMANDO DE BOMBEROS. REFERENCIA: {facpRef}'),
        f('ANUNCIADOR REMOTO DE ALARMA CONTRA INCENDIO UBICADO EN RECEPCIÓN'),
        f('4 CONDUCTORES (SÓLIDO) FPLR CALIBRE 16 AWG. REF.: 5522UL.'),
        f('CONEXIÓN POR FIBRA ÓPTICA CON EL PANEL DE INCENDIO DEL PANEL OPERATIVO'),
        f('CIRCUITO DEDICADO 120 VAC/20 A (POR MEDIO DE UN INTERRUPTOR APROBADO CON OPCIÓN DE BLOQUEO), DE ACUERDO CON 10.6.5.4 NFPA 72. BATERÍA 12 V. SE DEBERÁ GARANTIZAR UNA CAPACIDAD DE OPERACIÓN DURANTE UN MÍNIMO DE {tEspera} HORAS CON EL SISTEMA BAJO CARGA INACTIVA Y {tAlarma} MINUTOS CON EL SISTEMA BAJO CARGA MÁXIMA CONECTADA. DE ACUERDO CON 10.6.7.2.1.2 NFPA 72 SE DEBE CONTEMPLAR ESPACIO PARA UNA AMPLIACIÓN NO MENOR DE 20%.'),
        f('CON LOS SIGUIENTES BOTONES DE DESCONEXIÓN INDIVIDUAL:', 'h'),
        f('DISPOSITIVOS DE NOTIFICACIÓN ACÚSTICA Y LUCES ESTROBOSCÓPICAS (LA BASE DEL AVISADOR ACÚSTICO DE LAS HABITACIONES Y LAS LUCES ESTROBOSCÓPICAS DE LAS HABITACIONES PARA PERSONAS CON DISCAPACIDAD AUDITIVA DEBERÁN FUNCIONAR TRAS LA ACTIVACIÓN DEL DETECTOR DE HUMO DE LA HABITACIÓN)', 'i'),
        f('MECANISMOS DE RETENCIÓN DE PUERTAS', 'i'),
        f('RECUPERACIÓN DE ASCENSORES', 'i'),
        f('UNIDADES DE TRATAMIENTO DE AIRE Y SISTEMAS DE CONTROL DE HUMOS', 'i'),
        f('SISTEMAS AUDIOVISUALES (MÚSICA DEL HOTEL Y SISTEMA DE REGULACIÓN DE LA ILUMINACIÓN)', 'i'),
        f('MODO DE PRUEBA ACELERADA DE MONÓXIDO DE CARBONO (CO)', 'i')
      ],
      cab: [
        { id: 'nc1', on: true, capa: 'FA-SLC', txt: 'LAZO DE INICIACIÓN. 2x16 AWG SÓLIDO, SIN PANTALLA, ESPECIFICACIÓN NEC/UL=FPLR, FORRO COLOR ROJO, 300V, IGUAL O SUPERIOR A REFERENCIA, EN TUBERÍA EMT LISTADA UL, O EL INDICADO EN DIAGRAMA UNIFILAR. CABLE CONTRA HUMEDAD EN EXTERIORES VER REFERENCIA. IGUAL O SUPERIOR A REFERENCIA:\nSLC= {SLC}\nIDC= {IDC}\nEXTERIORES= WEST PENN AQ225' },
        { id: 'nc2', on: true, capa: 'FA-NAC', txt: 'LAZO DE NOTIFICACIÓN Y VOCEO. CIRCUITO DE NOTIFICACIÓN, 2x16 AWG SÓLIDO (SOLO NAC), 2x2x16 AWG SÓLIDO (NAC+VOCEO), NAC=SIN PANTALLA, VOCEO=CON PANTALLA, ESPECIFICACIÓN NEC/UL=FPLR, FORRO COLOR ROJO, 300V, EN TUBERÍA EMT LISTADA UL O EL INDICADO EN DIAGRAMA UNIFILAR. CABLE CONTRA HUMEDAD EN EXTERIORES VER REFERENCIA. IGUAL O SUPERIOR A REFERENCIA:\nNAC= {NAC}\nVOCEO= {VOCEO}\nEXTERIORES= WEST PENN AQ225' },
        { id: 'nc3', on: true, capa: 'FA-24VDC', txt: 'CIRCUITO DE 24VDC PERMANENTES, 2x16 AWG SÓLIDO, SIN PANTALLA, ESPECIFICACIÓN NEC/UL=FPLR, FORRO COLOR ROJO, 300V, IGUAL O SUPERIOR A REFERENCIA, EN TUBERÍA EMT LISTADA UL (VER TABLA CANALIZACIONES). O EL INDICADO EN DIAGRAMA UNIFILAR. CABLE CONTRA HUMEDAD EN EXTERIORES VER REFERENCIA. IGUAL O SUPERIOR A REFERENCIA:\n24VDC= {24VDC}\nEXTERIORES= WEST PENN AQ225' },
        { id: 'nc4', on: false, capa: 'FA-TELEFONO', txt: 'LAZO DE TELÉFONOS' },
        { id: 'nc5', on: false, capa: 'FA-RED', txt: 'CIRCUITO DE RED O COMUNICACIÓN, 4x16 AWG SÓLIDO, CON PANTALLA, ESPECIFICACIÓN NEC/UL=FPLR, FORRO COLOR ROJO, IGUAL O SUPERIOR A REFERENCIA, EN TUBERÍA EMT LISTADA UL (VER TABLA CANALIZACIONES), UN PAR PARA DATOS, UN PAR PARA AUDIO. O EL INDICADO EN DIAGRAMA UNIFILAR. CABLE CONTRA HUMEDAD EN EXTERIORES VER REFERENCIA. IGUAL O SUPERIOR A REFERENCIA:\nRED COBRE= {SLC}\nRED FO= VER PLANOS DE ITS\nEXTERIORES= WEST PENN AQ225' }
      ],
      gen: [
        g('Panel con circuito dedicado 120 VAC/20 A mediante interruptor aprobado con opción de bloqueo, de acuerdo con NFPA 72 §10.6.5.4.'),
        g('Baterías con capacidad para {tEspera} h en espera y {tAlarma} min en alarma (NFPA 72 §10.6.7.2.1.2); prever espacio para ampliación no menor de 20 %.'),
        g('Se debe contemplar un módulo aislador por cada nivel y cada 25 dispositivos por lazo.'),
        g('Los sensores y módulos con doble conexión se conectan al SLC y a un lazo de 24 VDC; los parlantes con estrobo, a un NAC y a un lazo de voceo (o a un lazo NAC+Voceo en la misma tubería).'),
        g('RFL: resistencia de fin de línea en los circuitos de notificación y de zona.'),
        g('Cantidades y especificaciones de los módulos según planos de planta; símbolos según NFPA 170 (2018), cap. 8.')
      ]
    };
  }

  /* ======================= DIAGRAMA UNIFILAR (DU) ======================= */
  function dibujarDU(d, ctx, x0, yTop) {
    var P = ctx.proy, cx = ctx.cx, Calc = ctx.Calc, cd = Calc.caida(cx, P), RP = Calc.proyecto(cx, P);
    var niveles = P.niveles.length ? P.niveles : ['NIVEL 1'];
    var equipos = P.paneles.concat(P.fuentes);
    var ORD = ['SLC', 'IDC', 'NAC', 'NAC+VOCEO', 'IDNAC', 'VOCEO', '24VDC'];
    var NO = (P.notasDU && P.notasDU.facp && P.notasDU.gen) ? P.notasDU : notasDUBase();
    if (!NO.cab) NO = Object.assign({}, NO, { cab: notasDUBase().cab });
    var notasF = NO.facp.filter(function (x) { return x.on; });
    var MARG = notasF.length ? 190 : 0, xL = x0;
    x0 += MARG;
    var pr0 = P.params || {}, tE = Calc.num(pr0.tEspera) || 24, tA = Calc.num(pr0.tAlarma) || 15;
    var facp0 = P.paneles[0], dFacp = facp0 && (facp0.filas || []).map(function (f) { return cx.disp[f.disp]; }).filter(function (q) { return q && q.tag === 'FACP'; })[0];
    var facpRef = dFacp ? ((cx.fabricantes[dFacp.fabricante] || {}).nombre || '') + ' ' + dFacp.modelo : ((cx.fabricantes && cx.fabricantes[P.fabricante]) ? cx.fabricantes[P.fabricante].nombre : '');
    function cabDe(tipo) {
      var c = P.caida.circuitos.filter(function (z) { return z.tipo === tipo && z.cable && cx.cables[z.cable]; })[0], cab = c ? cx.cables[c.cable] : null;
      return cab ? (cab.fabricante + ' ' + cab.modelo).toUpperCase() : (tipo === 'VOCEO' ? 'BELDEN 5220FL' : 'BELDEN 5220UL');
    }
    function sust(t) { return String(t || '').replace(/\{(SLC|IDC|NAC|VOCEO|NAC\+VOCEO|24VDC)\}/g, function (m, t1) { return cabDe(t1); }).replace(/\{tEspera\}/g, tE).replace(/\{tAlarma\}/g, tA).replace(/\{facpRef\}/g, facpRef.trim()); }
    var ROW = 27, PAD = 16, ESC = 1.35, PASO = 24;
    var circs = {}, res = {};
    P.caida.circuitos.forEach(function (c, i) { circs[c.id] = c; res[c.id] = cd.circuitos[i]; });
    function eqDe(id) { return equipos.filter(function (e) { return e.id === id; })[0]; }
    function origen(c) { return c.alim && eqDe(c.alim) ? c.alim : c.fuente; }   // el montante sale del equipo que alimenta el lazo
    function idxNivel(n) { return niveles.indexOf(n); }
    function nivelDe(c) {
      if (idxNivel(c.nivel) >= 0) return c.nivel;
      var e = eqDe(c.fuente); return e && idxNivel(e.nivel) >= 0 ? e.nivel : niveles[0];
    }

    /* ---- dispositivos por lazo (principal y de alimentación 24 V) y sin lazo asignado ---- */
    var porLazo = {}, sinLazo = {}, usados = [], numDe = {}, anunc = [], nNum = 0;
    function sumar(lista, dsp, cant) {
      var g = lista.filter(function (x) { return x.dsp.id === dsp.id; })[0];
      if (g) g.cant += cant; else lista.push({ dsp: dsp, cant: cant });
    }
    equipos.forEach(function (eq) {
      (eq.filas || []).forEach(function (f) {
        var dsp = cx.disp[f.disp], cant = Calc.num(f.cant);
        if (!dsp || !cant || /^(FACP|TRP|OTRO)$/.test(dsp.tag)) return;
        if (dsp.tag === 'ANN') { anunc.push({ dsp: dsp, cant: cant, nivel: f.zona || eq.nivel || '' }); }
        else if (f.circ && circs[f.circ]) { sumar(porLazo[f.circ] = porLazo[f.circ] || [], dsp, cant); }
        else {
          var nv = idxNivel(f.zona) >= 0 ? f.zona : (idxNivel(eq.nivel) >= 0 ? eq.nivel : niveles[0]), t = Calc.tipoLazoDe(dsp);
          sinLazo[nv] = sinLazo[nv] || {};
          sumar(sinLazo[nv][t] = sinLazo[nv][t] || [], dsp, cant);
        }
        if (Calc.tipoLazo2De(dsp) && f.circ2 && circs[f.circ2]) sumar(porLazo[f.circ2] = porLazo[f.circ2] || [], dsp, cant);
        var cl = claveSimb(dsp);
        if (!numDe[cl]) numDe[cl] = ++nNum;
        if (usados.indexOf(dsp.id) < 0) usados.push(dsp.id);
      });
    });

    /* ---- filas de cada nivel: un renglón por lazo (y uno por tipo para lo que no tiene lazo) ---- */
    var filas = {};
    niveles.forEach(function (n) { filas[n] = []; });
    P.caida.circuitos.forEach(function (c) { filas[nivelDe(c)].push({ c: c, g: porLazo[c.id] || [], tipo: c.tipo }); });
    niveles.forEach(function (n) {
      Object.keys(sinLazo[n] || {}).forEach(function (t) { filas[n].push({ c: null, g: sinLazo[n][t], tipo: t }); });
      filas[n].sort(function (a, b) { return ORD.indexOf(a.tipo) - ORD.indexOf(b.tipo); });
    });
    var nEqNiv = niveles.map(function (n) { return equipos.filter(function (e, ie) { return e !== P.paneles[0] && Math.max(0, idxNivel(e.nivel)) === idxNivel(n); }).length; });
    var alto = niveles.map(function (n, i) { return Math.max(Math.max(1, filas[n].length) * ROW, nEqNiv[i] * 30) + PAD; });
    var total = alto.reduce(function (a, b) { return a + b; }, 0);
    var yNiv0 = yTop - 70 - total;               // base del nivel más bajo
    var yb = [], acc = yNiv0;
    niveles.forEach(function (n, i) { yb.push(acc); acc += alto[i]; });
    function yFila(i, k) { return yb[i] + alto[i] - 8 - (k + 0.5) * ROW; }

    /* ---- FACP (abajo) ---- */
    var fx = x0, fw = 190, fh = 96, fy = yNiv0 - 28 - fh;
    var facp = P.paneles[0];

    /* ---- montantes: uno por equipo y tipo de circuito ---- */
    var llaves = [], posL = {};
    P.caida.circuitos.forEach(function (c) { var k = origen(c) + '|' + c.tipo; if (llaves.indexOf(k) < 0) llaves.push(k); });
    llaves.sort(function (a, b) {
      var A = a.split('|'), B = b.split('|');
      return equipos.indexOf(eqDe(A[0])) - equipos.indexOf(eqDe(B[0])) || ORD.indexOf(A[1]) - ORD.indexOf(B[1]);
    });
    var xR0 = x0 + 215, xR = {};
    llaves.forEach(function (k, i) { xR[k] = xR0 + i * 11; });
    var xChain = xR0 + Math.max(1, llaves.length) * 11 + 52;

    var maxCad = 5;
    Object.keys(filas).forEach(function (n) { filas[n].forEach(function (f) { maxCad = Math.max(maxCad, f.g.length); }); });
    var xEndCad = xChain + maxCad * PASO;
    var xInfo = xEndCad + 16, xEnd = xInfo + 150;

    d.T(xL, yTop, 'DU ALARMAS CONTRA INCENDIO', 7, 'FA-TEXTO');
    d.T(xL, yTop - 8, (P.nombre || '') + (P.numero ? ' · ' + P.numero : '') + (P.cliente ? ' · ' + P.cliente : ''), 3.4, 'FA-TEXTO');
    d.T(xL, yTop - 14, 'Una línea por lazo y nivel; cargas y caídas de tensión de la hoja de cálculo.', 2.4, 'FA-TEXTO');

    d.cortes = yb.slice();                       // la lámina puede cortarse en los separadores de nivel
    // separadores y nombres de nivel
    niveles.forEach(function (n, i) {
      d.L(x0 + 215 - 10, yb[i], xEnd, yb[i], 'FA-TABLA');
      d.T(xEnd, yb[i] + 3, String(n), 5, 'FA-TEXTO', 'r');
    });

    // cajas de equipos (transponder, fuente, amplificador) en el nivel donde están
    var stubs = {}, colEq = {};
    equipos.forEach(function (eq, ie) {
      if (eq === facp) return;
      var i = Math.max(0, idxNivel(eq.nivel)), n = (colEq[i] = (colEq[i] || 0) + 1) - 1;
      var bx = x0 + 22, by = yb[i] + alto[i] - 10 - n * 30 - 24, esAmpl = eq.tipo === 'AMP';
      var esFuente = P.fuentes.indexOf(eq) >= 0;
      d.R(bx, by, 80, 24, 'FA-SIMBOLOS');
      d.T(bx + 40, by + 15.5, eq.tag || '', 4.2, 'FA-TEXTO', 'c');
      d.T(bx + 40, by + 9.5, esAmpl ? 'AMPLIFICADOR DE VOCEO' : (esFuente ? 'FUENTE AUXILIAR ' + (Calc.num(eq.iMax) ? fmt(eq.iMax, 0) + ' A' : '') : 'TRANSPONDER'), 2.3, 'FA-TEXTO', 'c');
      var rr = (RP.paneles.concat(RP.fuentes).filter(function (x) { return (x.p || x.f) === eq; })[0] || {}).r;
      d.T(bx + 40, by + 4, rr && rr.bat && rr.bat.ah !== null ? 'Batería ' + fmt(rr.bat.ah, 1) + ' Ah' : '', 2.3, 'FA-TEXTO', 'c');
      stubs[eq.id] = { x: bx + 80, y: by + 20, n: 0 };
    });
    // FACP con módulos
    d.R(fx, fy, fw, fh, 'FA-SIMBOLOS');
    d.T(fx + 8, fy + fh - 18, 'FACP', 14, 'FA-TEXTO');
    var nSLC = Math.max(1, P.caida.circuitos.filter(function (c) { return c.fuente === (facp || {}).id && c.tipo === 'SLC'; }).length),
      nNAC = Math.max(1, P.caida.circuitos.filter(function (c) { return c.fuente === (facp || {}).id && /NAC/.test(c.tipo); }).length),
      nsl = Math.ceil(nSLC / 2), mods = Math.min(8, nsl + Math.ceil(nNAC / 2)), nmod = Math.max(mods, 6);
    var mw = Math.min(26, (fw - 20) / nmod), mx0 = fx + 10;
    for (var m = 0; m < nmod; m++) {
      d.R(mx0 + m * mw, fy + 24, mw, 40, 'FA-SIMBOLOS');
      d.T(mx0 + m * mw + mw / 2, fy + 52, m < nsl ? 'SLC' : 'NAC', 3, 'FA-TEXTO', 'c');
      [0.25, 0.5, 0.75].forEach(function (q) { d.R(mx0 + m * mw + mw * q - 0.9, fy + 60.5, 1.8, 1.8, 'FA-SIMBOLOS', true); });
    }
    d.T(fx + fw / 2, fy + 8, (facp ? facp.tag : 'FACP') + ' · ' + ((cx.fabricantes && cx.fabricantes[P.fabricante]) ? cx.fabricantes[P.fabricante].nombre : ''), 2.8, 'FA-TEXTO', 'c');
    if (facp) stubs[facp.id] = { x: fx + fw, y: fy + fh - 8, n: 0, paso: 6 };

    /* ---- orden de los montantes con el menor número de cruces ----
     * Un renglón cruza los montantes que están a su derecha y cubren su altura; la salida de un equipo cruza los que están a su izquierda. */
    var rowsList = [];
    niveles.forEach(function (n, i) {
      filas[n].forEach(function (f, k) {
        if (!f.c) return;
        var key = origen(f.c) + '|' + f.c.tipo, y = yFila(i, k);
        rowsList.push({ key: key, y: y });
        if (f.c.clase === 'A' && f.tipo !== '24VDC') rowsList.push({ key: key, y: y - 12.6 });
      });
    });
    function y0s(orden) {
      var cnt = {}, r = {};
      orden.forEach(function (k) {
        var id = k.split('|')[0], st = stubs[id] || { x: fx + fw, y: fy + fh - 8, paso: 6 }, n = cnt[id] || 0;
        r[k] = st.y - n * (st.paso || 4); cnt[id] = n + 1;
      });
      return r;
    }
    function spans(orden) {
      var y0 = y0s(orden), sp = {};
      orden.forEach(function (k) { sp[k] = { y0: y0[k], min: y0[k] - 2.4, max: y0[k] }; });
      rowsList.forEach(function (r) { var s = sp[r.key]; if (s) { s.min = Math.min(s.min, r.y); s.max = Math.max(s.max, r.y); } });
      return sp;
    }
    function costo(orden) {
      var sp = spans(orden), pos = {}, c = 0;
      orden.forEach(function (k, i) { pos[k] = i; });
      rowsList.forEach(function (r) {
        orden.forEach(function (k2) { if (k2 !== r.key && pos[k2] > pos[r.key] && sp[k2].min < r.y && r.y < sp[k2].max) c++; });
      });
      orden.forEach(function (k) {
        orden.forEach(function (k2) { if (k2 !== k && pos[k2] < pos[k] && sp[k2].min < sp[k].y0 && sp[k].y0 < sp[k2].max) c++; });
      });
      return c;
    }
    var mejorC = costo(llaves);
    for (var it = 0; it < 60; it++) {
      var mejora = false;
      for (var q = 0; q + 1 < llaves.length; q++) {
        var cand = llaves.slice(); var tmp = cand[q]; cand[q] = cand[q + 1]; cand[q + 1] = tmp;
        var cc = costo(cand);
        if (cc < mejorC) { llaves = cand; mejorC = cc; mejora = true; }
      }
      if (!mejora) break;
    }
    llaves.forEach(function (k, i) { xR[k] = xR0 + i * 11; });
    var info = spans(llaves);

    // línea horizontal que salta (con un arco) los montantes que cruza
    function hLinea(xa, xb, y, capa, kk) {
      var cr = llaves.filter(function (k2) { return k2 !== kk && xR[k2] > xa + 2.5 && xR[k2] < xb - 2.5 && info[k2].min < y - 0.01 && info[k2].max > y + 0.01; })
        .map(function (k2) { return xR[k2]; }).sort(function (a, b) { return a - b; });
      var x = xa, R = 1.5;
      cr.forEach(function (cxx) {
        d.L(x, y, cxx - R, y, capa);
        var pts = [];
        for (var t = 0; t <= 6; t++) { var a = Math.PI - Math.PI * t / 6; pts.push([cxx + R * Math.cos(a), y + R * Math.sin(a)]); }
        d.P(pts, false, capa); x = cxx + R;
      });
      d.L(x, y, xb, y, capa);
    }

    // salida de cada montante desde su equipo
    llaves.forEach(function (k) {
      var st = stubs[k.split('|')[0]] || { x: fx + fw, y: fy + fh - 8 }, capa = CAPA_DE_TIPO[k.split('|')[1]];
      hLinea(st.x, xR[k], info[k].y0, capa, k);
    });
    var claseA = {};   // montantes que llevan lazos clase A: tienen además su montante de retorno

    /* ---- renglones de lazo ---- */
    niveles.forEach(function (n, i) {
      filas[n].forEach(function (f, k) {
        var y = yFila(i, k), c = f.c, capa = CAPA_DE_TIPO[f.tipo] || 'FA-SLC', key = c ? origen(c) + '|' + c.tipo : null;
        var xs = key ? xR[key] : xChain - 30, xFin = xEndCad, esA = !!c && c.clase === 'A' && f.tipo !== '24VDC';
        hLinea(xs, xFin, y, capa, key);
        d.P([[xs, y], [xs + 3.2, y + 1.6], [xs + 3.2, y - 1.6]], true, capa, true);
        d.T(xChain - 4, y + 2, c ? c.circuito + (esA ? ' (clase A)' : '') : '(sin lazo asignado)', 2.8, c ? capa : 'FA-ALERTA', 'r');
        f.g.forEach(function (it, j) {
          var x = xChain + j * PASO + PASO / 2, sid = simboloDe(it.dsp), cb = caja(SIM[sid] || SIM.FA001), esc = Math.min(ESC, 11 / Math.max(cb.w, cb.h)), top = cb.h * esc / 2;
          d.S(sid, x, y, esc, 'FA-SIMBOLOS');
          d.C(x, y + top + 4.6, 2.2, 'FA-TEXTO'); d.L(x, y + top + 2.4, x, y + top, 'FA-TEXTO');
          d.T(x, y + top + 3.8, numDe[claveSimb(it.dsp)], 2.2, 'FA-TEXTO', 'c');
          d.T(x, y - top - 3.4, '×' + it.cant, 2.4, 'FA-TEXTO', 'c');
        });
        if (!f.g.length && c) d.T(xChain + 4, y + 1, 'sin dispositivos asignados', 2.4, 'FA-ALERTA');
        if (esA) {
          // clase A: el circuito regresa al panel por un segundo camino (retorno por un montante paralelo)
          var yr = y - 12.6, xb = xFin + 5, xr = xR[key] + 3.6;
          d.P([[xFin, y], [xb, y], [xb, yr]], false, capa);
          hLinea(xr, xb, yr, capa, key);
          d.P([[xr + 3.6, yr], [xr + 6.8, yr + 1.5], [xr + 6.8, yr - 1.5]], true, capa, true);
          (claseA[key] = claseA[key] || []).push(yr);
        } else if (/NAC|VOCEO|IDC/.test(f.tipo) && f.tipo !== '24VDC') { d.R(xFin + 2, y - 2.6, 10, 5.2, 'FA-SIMBOLOS'); d.T(xFin + 7, y - 1, 'RFL', 2.4, 'FA-TEXTO', 'c'); }
        if (c) {
          var r = res[c.id], cab = c.cable ? cx.cables[c.cable] : null, nd = r ? r.n : 0;
          d.T(xInfo, y + 2.2, nd + ' disp. · ' + (r && r.iMa !== null ? fmt(r.iMa, 0) + ' mA' : 'sin corriente') + (c.long ? ' · ' + fmt(c.long, 0) + ' m' : '') + (cab ? ' · ' + cab.modelo + ' ' + cab.awg + ' AWG' : '') + (esA ? ' · Clase A' : (f.tipo === '24VDC' ? '' : ' · Clase B')), 2.4, 'FA-TEXTO');
          d.T(xInfo, y - 2.2, r && r.caida !== null ? 'ΔV ' + fmt(r.caida, 2) + ' V → ' + fmt(r.vDisp, 2) + ' V en el último dispositivo · ' + r.estado : (r && r.estado ? r.estado : 'falta cable o longitud'),
            2.4, r && /ERROR|INCOMPLETO/.test(r.estado || '') ? 'FA-ALERTA' : 'FA-TEXTO');
        }
      });
    });
    // montantes verticales (y su retorno cuando hay lazos clase A)
    llaves.forEach(function (k) {
      var capa = CAPA_DE_TIPO[k.split('|')[1]], s = info[k];
      d.L(xR[k], s.min, xR[k], s.max, capa);
      d.T(xR[k], s.max + 4, (k.split('|')[1] === '24VDC' ? '24 VDC' : k.split('|')[1]), 2.2, capa, 'c', 90);
      if (claseA[k]) {
        var xr = xR[k] + 3.6, ysR = claseA[k].concat([s.y0 - 2.4]);
        d.L(xr, Math.min.apply(null, ysR), xr, Math.max.apply(null, ysR), capa);
        var st = stubs[k.split('|')[0]] || { x: fx + fw };
        d.L(st.x, s.y0 - 2.4, xr, s.y0 - 2.4, capa);
        d.P([[st.x + 3.4, s.y0 - 2.4], [st.x + 6.6, s.y0 - 0.9], [st.x + 6.6, s.y0 - 3.9]], true, capa, true);
      }
    });

    /* ---- anunciadores remotos (bajo el FACP) ---- */
    var ya = fy - 6;
    anunc.forEach(function (a, i) {
      d.S('FA013', fx + 8, ya - i * 12 - 4, 1.1, 'FA-SIMBOLOS');
      d.L(fx + 18, ya - i * 12 - 4, fx + 26, ya - i * 12 - 4, 'FA-TEXTO');
      d.T(fx + 28, ya - i * 12 - 5.2, 'ANUNCIADOR REMOTO ×' + a.cant + (a.nivel ? ' · ' + a.nivel : '') + ' — ' + (a.dsp.modelo || a.dsp.tag), 2.6, 'FA-TEXTO');
    });

    /* ---- notas junto al FACP (editables): texto a la izquierda con flecha al panel ---- */
    if (notasF.length) {
      var nx = xL + MARG - 16, ny = fy + fh + 30, hayItems = NO.facp.some(function (q) { return q.on && q.grupo === 'i'; }), letra = 0, ne = 0;
      notasF.forEach(function (q) {
        if (q.grupo === 'h' && !hayItems) return;
        var txt = sust(q.txt), esItem = q.grupo === 'i';
        if (esItem) txt = String.fromCharCode(65 + letra++) + '. ' + txt;
        var lin = partir(txt, 2.5, MARG - 26);
        lin.forEach(function (l, k) { d.T(nx - (esItem ? 4 : 0), ny - k * 3.5, l, 2.5, 'FA-TEXTO', 'r'); });
        if (!esItem) {
          var ya = Math.max(fy + 8, Math.min(fy + fh - 8, ny + 1)), xe = nx + 3 + (ne++) * 1.1;
          d.L(nx + 2, ny + 1, xe, ny + 1, 'FA-TEXTO'); if (Math.abs(ya - (ny + 1)) > 0.1) d.L(xe, ny + 1, xe, ya, 'FA-TEXTO');
          d.L(xe, ya, fx - 1, ya, 'FA-TEXTO'); d.P([[fx, ya], [fx - 3.4, ya + 1.2], [fx - 3.4, ya - 1.2]], true, 'FA-TEXTO', true);
        }
        ny -= lin.length * 3.5 + 3.5;
      });
    }

    /* ---- tablas a la derecha ---- */
    var lx = xEnd + 24, ly = yTop - 4, lw = 235;
    function tit(yy, t) { d.R(lx, yy - 12, lw, 12, 'FA-TABLA'); d.T(lx + lw / 2, yy - 8.2, t, 3.4, 'FA-TEXTO', 'c'); return yy - 12; }
    var yy = tit(ly, 'SIMBOLOGÍA DE ALARMAS CONTRA INCENDIO (CDCLH-001S · NFPA 170)');
    var itemsL = itemsLeyenda(ctx, usados.map(function (id) { return cx.disp[id]; }), numDe, false);
    yy = dibujarLeyenda(d, lx, yy, lw, itemsL);
    if (!itemsL.length) { d.R(lx, yy - 14, lw, 14, 'FA-TABLA'); d.T(lx + 4, yy - 8, 'Asigne dispositivos a los niveles en las pestañas de cada panel.', 2.6, 'FA-TEXTO'); yy -= 14; }

    yy = tit(yy - 10, 'CABLEADO SISTEMA ALARMAS CONTRA INCENDIO');
    NO.cab.filter(function (q) { return q.on; }).forEach(function (q) {
      var lin = [];
      sust(q.txt).split('\n').forEach(function (par) { partir(par, 2.3, lw - 38).forEach(function (l) { lin.push(l); }); });
      var al = lin.length * 3.4 + 5;
      d.R(lx, yy - al, lw, al, 'FA-TABLA'); d.L(lx + 30, yy, lx + 30, yy - al, 'FA-TABLA');
      d.L(lx + 3, yy - 5, lx + 27, yy - 5, q.capa || 'FA-TEXTO');
      lin.forEach(function (l, k) { d.T(lx + 33, yy - 5 - k * 3.4, l, 2.3, 'FA-TEXTO'); });
      yy -= al;
    });

    // resumen de lazos (de la hoja de caída de tensión)
    yy = tit(yy - 10, 'RESUMEN DE LAZOS (CAÍDA DE TENSIÓN)');
    var cl = [['LAZO', 34], ['EQUIPO', 28], ['NIVEL', 34], ['DISP.', 16], ['I (mA)', 22], ['V DISP. (V)', 28], ['ESTADO', 73]], xx = lx;
    d.R(lx, yy - 6, lw, 6, 'FA-TABLA');
    cl.forEach(function (c) { d.T(xx + 1.5, yy - 4.2, c[0], 2.1, 'FA-TEXTO'); xx += c[1]; if (xx < lx + lw - 1) d.L(xx, yy, xx, yy - 6, 'FA-TABLA'); });
    yy -= 6;
    P.caida.circuitos.forEach(function (c) {
      var r = res[c.id], e = eqDe(c.fuente), vals = [c.circuito, e ? e.tag : '', c.nivel || '', String(r.n), r.iMa === null ? '—' : fmt(r.iMa, 0), fmt(r.vDisp, 2), r.estado || '—'];
      d.R(lx, yy - 6, lw, 6, 'FA-TABLA'); xx = lx;
      cl.forEach(function (cc, j) {
        var mx = Math.floor((cc[1] - 2) / (2.1 * 0.62)), t = vals[j]; if (t.length > mx) t = t.slice(0, mx - 1) + '…';
        d.T(xx + 1.5, yy - 4.2, t, 2.1, j === 6 && /ERROR|INCOMPLETO/.test(t) ? 'FA-ALERTA' : 'FA-TEXTO'); xx += cc[1];
        if (xx < lx + lw - 1) d.L(xx, yy, xx, yy - 6, 'FA-TABLA');
      });
      yy -= 6;
    });

    // baterías por equipo
    yy = tit(yy - 10, 'BATERÍAS (NFPA 72 §10.6.7)');
    var cb2 = [['EQUIPO', 34], ['NIVEL', 34], ['I ESP. (A)', 28], ['I ALM. (A)', 28], ['Ah REQ.', 27], ['BAT. (Ah)', 24], ['ESTADO', 60]];
    d.R(lx, yy - 6, lw, 6, 'FA-TABLA'); xx = lx;
    cb2.forEach(function (c) { d.T(xx + 1.5, yy - 4.2, c[0], 2.1, 'FA-TEXTO'); xx += c[1]; if (xx < lx + lw - 1) d.L(xx, yy, xx, yy - 6, 'FA-TABLA'); });
    yy -= 6;
    RP.paneles.concat(RP.fuentes).forEach(function (x) {
      var e = x.p || x.f, r = x.r, vals = [e.tag || '', e.nivel || '', fmt(r.iEsp, 3), fmt(r.iAlm, 3), fmt(r.bat.ahReq, 2), r.bat.ah === null ? '—' : fmt(r.bat.ah, 1), r.estado];
      d.R(lx, yy - 6, lw, 6, 'FA-TABLA'); xx = lx;
      cb2.forEach(function (cc, j) {
        d.T(xx + 1.5, yy - 4.2, vals[j], 2.1, j === 6 && r.estado !== 'OK' ? 'FA-ALERTA' : 'FA-TEXTO'); xx += cc[1];
        if (xx < lx + lw - 1) d.L(xx, yy, xx, yy - 6, 'FA-TABLA');
      });
      yy -= 6;
    });

    // notas del sistema
    yy = tit(yy - 10, 'NOTAS SISTEMA ALARMAS CONTRA INCENDIO');
    NO.gen.filter(function (q) { return q.on; }).map(function (q) { return sust(q.txt); }).forEach(function (t, i) {
      var lin = partir((i + 1) + '. ' + t, 2.3, lw - 6), al = lin.length * 3.5 + 4;
      d.R(lx, yy - al, lw, al, 'FA-TABLA');
      lin.forEach(function (l, k) { d.T(lx + 3, yy - 5 - k * 3.5, l, 2.3, 'FA-TEXTO'); });
      yy -= al;
    });
    return { ancho: lx + lw, yFin: Math.min(yy, fy - anunc.length * 12) };
  }

  /* Lámina de simbología: todas las filas de la CDCLH-001S (salvo las apagadas) con los modelos del catálogo */
  function dibujarSimb(d, ctx, x0, yTop) {
    var P = ctx.proy, lw = 300, y = yTop;
    d.T(x0, y, 'SIMBOLOGÍA DE ALARMAS CONTRA INCENDIO', 6, 'FA-TEXTO');
    d.T(x0, y - 8, (P.nombre || '') + (P.numero ? ' · ' + P.numero : '') + ' · ' + (global.Simbologia ? global.Simbologia.fuente : '') + ' · símbolos NFPA 170 (2018) cap. 8', 3, 'FA-TEXTO');
    y -= 16;
    var devs = dispositivosUsados(ctx), numDe = {}, n = 0;
    devs.forEach(function (q) { var c = claveSimb(q); if (!numDe[c]) numDe[c] = ++n; });
    d.R(x0, y - 12, lw, 12, 'FA-TABLA'); d.T(x0 + lw / 2, y - 8.2, 'SIMBOLOGÍA — se marcan con número los que usa este proyecto', 3.4, 'FA-TEXTO', 'c'); y -= 12;
    y = dibujarLeyenda(d, x0, y, lw, itemsLeyenda(ctx, devs, numDe, true));
    d.T(x0, y - 6, 'FABRICANTES ACEPTADOS: NOTIFIER, SIMPLEX, EST, BOSCH, HOCHIKI, FIRE LITE, GAMEWELL. ALGUNOS DE LOS ELEMENTOS DE ESTA SIMBOLOGÍA PODRÍAN NO APLICAR EN ESTE PROYECTO.', 2.4, 'FA-TEXTO');
    return { ancho: lw, yFin: y - 10 };
  }

  /* ======================= láminas completas ======================= */
  function lamina(tipo, ctx) {
    var M = ctx.proy.matriz || matrizBase();
    var d = new Dib(0, 0), r;
    if (tipo === 'du') r = dibujarDU(d, ctx, 20, 700);
    else if (tipo === 'matriz') r = dibujarMatriz(d, M, 20, 700);
    else if (tipo === 'simb') r = dibujarSimb(d, ctx, 20, 700);
    else r = dibujarCalculos(d, ctx, 20, 700);
    // dimensiones de la hoja: ajustadas al contenido (para pegar en láminas); origen (0,0) abajo-izquierda
    var minY = 1e9, maxX = 0;
    d.e.forEach(function (e) {
      var ys = e.k === 'L' ? [e.a[1], e.a[3]] : e.k === 'C' ? [e.a[1] - e.a[2]] : e.k === 'P' ? e.p.map(function (q) { return q[1]; }) : [e.a[1]];
      ys.forEach(function (v) { minY = Math.min(minY, v); });
      var xs = e.k === 'L' ? [e.a[0], e.a[2]] : e.k === 'C' ? [e.a[0] + e.a[2]] : e.k === 'P' ? e.p.map(function (q) { return q[0]; }) : [e.a[0] + (e.k === 'T' ? Dib.prototype.ancho.call(d, e.t, e.h) : 0)];
      xs.forEach(function (v) { maxX = Math.max(maxX, v); });
    });
    var dy = 20 - minY; // desplazar para que el mínimo quede en y=20
    d.cortes = (d.cortes || []).map(function (c) { return c + dy; });
    d.e.forEach(function (e) {
      if (e.k === 'P') e.p.forEach(function (q) { q[1] += dy; });
      else if (e.k === 'L') { e.a[1] += dy; e.a[3] += dy; } else e.a[1] += dy;
    });
    d.w = Math.ceil(maxX + 20); d.h = Math.ceil(700 + dy + 20);
    return d;
  }

  /* ======================= IMPORTAR LA MATRIZ (Excel / Word / PDF / CSV) ======================= */
  var RX_MARCA = /^\s*(x|✓|✔|✗|■|●|•)\s*(\(\s*\d+\s*\))?\s*$/i;
  function limpiar(s) { return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* grid: arreglo de filas (arreglos de texto). Devuelve una matriz o null. */
  function matrizDeGrid(grid) {
    grid = grid.map(function (f) { return f.map(limpiar); });
    var filasMarca = [];
    grid.forEach(function (f, i) { if (f.filter(function (c) { return RX_MARCA.test(c); }).length >= 1) filasMarca.push(i); });
    if (filasMarca.length < 2) return null;
    // el bloque de datos: la racha más larga de filas con marcas (permite filas sin marcas por medio)
    var ini = filasMarca[0], fin = filasMarca[filasMarca.length - 1];
    var colsMarca = {};
    for (var i = ini; i <= fin; i++) grid[i].forEach(function (c, j) { if (RX_MARCA.test(c)) colsMarca[j] = 1; });
    var cm = Object.keys(colsMarca).map(Number).sort(function (a, b) { return a - b; });
    if (cm.length < 2) return null;
    // encabezado: fila previa con más celdas de texto
    var hi = -1, mejor = 0;
    for (var k = ini - 1; k >= Math.max(0, ini - 6); k--) {
      var n = grid[k].filter(function (c, j) { return c && cm.indexOf(j) >= 0; }).length;
      if (n > mejor) { mejor = n; hi = k; }
    }
    var cabecera = hi >= 0 ? grid[hi] : [];
    // columna de acción: la de textos más largos fuera de las columnas de marcas
    var largo = {}, colNota = -1;
    for (var r = ini; r <= fin; r++) grid[r].forEach(function (c, j) {
      if (cm.indexOf(j) >= 0 || !c) return;
      largo[j] = (largo[j] || 0) + c.length;
    });
    var ca = Object.keys(largo).map(Number).sort(function (a, b) { return largo[b] - largo[a]; })[0];
    if (ca === undefined) ca = 0;
    Object.keys(largo).map(Number).forEach(function (j) {
      if (j === ca) return;
      var todoNum = true, alguno = false;
      for (var r2 = ini; r2 <= fin; r2++) { var c = grid[r2][j]; if (c) { alguno = true; if (!/^\(?\d+\)?(\s*,\s*\(?\d+\)?)*$/.test(c)) todoNum = false; } }
      if ((alguno && todoNum) || /note|nota/i.test(cabecera[j] || '')) colNota = j;
    });
    var entradas = cm.map(function (j, i) { return { id: 'e' + (i + 1), nombre: cabecera[j] || ('Entrada ' + (i + 1)) }; });
    var salidas = [];
    for (var r3 = ini; r3 <= fin; r3++) {
      var f = grid[r3], texto = f[ca] || '';
      if (!texto && !f.some(function (c) { return RX_MARCA.test(c); })) continue;
      var mk = {};
      cm.forEach(function (j, i) { if (RX_MARCA.test(f[j] || '')) mk['e' + (i + 1)] = 'X' + ((limpiar(f[j]).match(/\(\s*\d+\s*\)/) || [''])[0].replace(/\s+/g, '')); });
      salidas.push({ id: 's' + (salidas.length + 1), texto: texto, nota: colNota >= 0 ? (f[colNota] || '') : '', marcas: mk });
    }
    // notas generales (encima del encabezado) y notas numeradas (debajo de los datos)
    var generales = [], notas = [];
    for (var a = 0; a < (hi >= 0 ? hi : ini); a++) { var t = grid[a].filter(Boolean)[0]; if (t && t.length > 25 && !/^general notes/i.test(t)) generales.push(t.replace(/^[•\-\*]\s*/, '')); }
    for (var b = fin + 1; b < grid.length; b++) { var u = grid[b].filter(Boolean)[0]; if (u && !/^notes?\s*\/|^notas?\b/i.test(u)) notas.push(u); }
    var titulo = (grid.slice(0, 3).map(function (f) { return f.filter(Boolean)[0]; }).filter(Boolean)[0]) || 'Matriz de entradas / salidas';
    return { titulo: titulo.length < 60 ? titulo : 'Matriz de entradas / salidas', subtitulo: '', generales: generales, entradas: entradas, salidas: salidas, notas: notas };
  }

  function gridDeTabla(t) {
    var g = [];
    [].forEach.call(t.querySelectorAll('tr'), function (tr) {
      var fila = []; [].forEach.call(tr.children, function (td) {
        var cs = +td.getAttribute('colspan') || 1; fila.push(td.textContent); for (var i = 1; i < cs; i++) fila.push('');
      }); g.push(fila);
    });
    return g;
  }

  function cargarScript(url) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { no(new Error('No se pudo cargar ' + url + ' (se requiere conexión a Internet)')); };
      document.head.appendChild(s);
    });
  }
  var LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  };
  function leerBuffer(f) {
    return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsArrayBuffer(f); });
  }

  function importarArchivo(file) {
    var nom = file.name.toLowerCase(), ext = nom.slice(nom.lastIndexOf('.') + 1);
    if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'csv') {
      return (global.XLSX ? Promise.resolve() : cargarScript(LIBS.xlsx)).then(function () { return leerBuffer(file); }).then(function (buf) {
        var wb = global.XLSX.read(buf, { type: 'array' }), mejor = null;
        wb.SheetNames.forEach(function (n) {
          var m = matrizDeGrid(global.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }));
          if (m && (!mejor || m.salidas.length > mejor.salidas.length)) mejor = m;
        });
        return mejor;
      });
    }
    if (ext === 'docx') {
      return (global.mammoth ? Promise.resolve() : cargarScript(LIBS.mammoth)).then(function () { return leerBuffer(file); }).then(function (buf) {
        return global.mammoth.convertToHtml({ arrayBuffer: buf });
      }).then(function (res) {
        var doc = new DOMParser().parseFromString(res.value, 'text/html'), mejor = null;
        [].forEach.call(doc.querySelectorAll('table'), function (t) {
          var m = matrizDeGrid(gridDeTabla(t));
          if (m && (!mejor || m.salidas.length > mejor.salidas.length)) mejor = m;
        });
        if (mejor && !mejor.notas.length) { // notas numeradas en párrafos fuera de la tabla
          [].forEach.call(doc.querySelectorAll('p'), function (p) { var t = limpiar(p.textContent); if (/^\(\d+\)\s*\S/.test(t)) mejor.notas.push(t); });
        }
        return mejor;
      });
    }
    if (ext === 'pdf') {
      return (global.pdfjsLib ? Promise.resolve() : cargarScript(LIBS.pdf)).then(function () {
        global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return leerBuffer(file);
      }).then(function (buf) { return global.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (pdf) {
        var ps = []; for (var i = 1; i <= pdf.numPages; i++) ps.push(pdf.getPage(i).then(function (p) { return p.getTextContent(); }));
        return Promise.all(ps);
      }).then(function (pags) {
        var mejor = null;
        pags.forEach(function (tc) {
          var m = matrizDePdf(tc.items.map(function (it) { return { s: it.str, x: it.transform[4], y: it.transform[5], vert: Math.abs(it.transform[1]) > Math.abs(it.transform[0]) }; }));
          if (m && (!mejor || m.salidas.length > mejor.salidas.length)) mejor = m;
        });
        return mejor;
      });
    }
    return Promise.reject(new Error('Formato no soportado: use .xlsx, .xls, .csv, .docx o .pdf'));
  }

  /* PDF: se reconstruye una rejilla a partir de la posición de los textos (mejor esfuerzo; revise el resultado en pantalla) */
  function matrizDePdf(items) {
    items = items.filter(function (i) { return limpiar(i.s); });
    var marcas = items.filter(function (i) { return RX_MARCA.test(i.s); });
    if (marcas.length < 4) return null;
    // columnas por agrupación de x de las marcas
    var xs = marcas.map(function (m) { return m.x; }).sort(function (a, b) { return a - b; }), cols = [];
    xs.forEach(function (x) { var c = cols[cols.length - 1]; if (c && x - c.max < 9) { c.max = x; c.sum += x; c.n++; } else cols.push({ min: x, max: x, sum: x, n: 1 }); });
    cols.forEach(function (c) { c.x = c.sum / c.n; });
    var yMarcas = marcas.map(function (m) { return m.y; });
    var yMax = Math.max.apply(null, yMarcas), yMin = Math.min.apply(null, yMarcas);
    // filas: agrupar por y
    var filasY = []; items.filter(function (i) { return i.y <= yMax + 8 && i.y >= yMin - 8; }).sort(function (a, b) { return b.y - a.y; }).forEach(function (i) {
      var f = filasY[filasY.length - 1]; if (f && Math.abs(f.y - i.y) < 5) f.items.push(i); else filasY.push({ y: i.y, items: [i] });
    });
    // textos de acción por fila: los que quedan a la izquierda de la primera columna de marcas
    var xPrimera = cols[0].min - 12, grid = [];
    // encabezado: textos (normalmente verticales) por encima de la primera fila, asignados a la columna más cercana
    var nombres = cols.map(function () { return []; });
    items.filter(function (i) { return i.y > yMax + 8 && i.x > xPrimera; }).forEach(function (i) {
      var k = 0, dm = 1e9; cols.forEach(function (c, j) { var dd = Math.abs(c.x - i.x); if (dd < dm) { dm = dd; k = j; } });
      if (dm < 14) nombres[k].push(i);
    });
    var cabecera = nombres.map(function (l) { return l.sort(function (a, b) { return a.vert ? a.y - b.y : b.y - a.y; }).map(function (i) { return i.s; }).join(' '); });
    var marca = filasY.map(function (f) {
      var fila = [limpiar(f.items.filter(function (i) { return i.x < xPrimera; }).sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s; }).join(' '))];
      cols.forEach(function (c) {
        var it = f.items.filter(function (i) { return Math.abs(i.x - c.x) < 9 && RX_MARCA.test(i.s); })[0];
        fila.push(it ? it.s : '');
      });
      return fila;
    });
    grid.push([''].concat(cabecera), []);
    marca.forEach(function (f) { grid.push(f); });
    // continuar el texto de acciones partido en varias líneas: filas sin marcas se unen a la anterior con marcas
    var datos = [];
    grid.slice(2).forEach(function (f) {
      var hay = f.slice(1).some(Boolean);
      if (hay || !datos.length) datos.push(f.slice()); else datos[datos.length - 1][0] = limpiar(datos[datos.length - 1][0] + ' ' + f[0]);
    });
    var g2 = [grid[0]].concat(datos);
    var m = matrizDeGrid(g2);
    if (!m) return null;
    // notas: líneas debajo de la tabla que empiezan por (n)
    var abajo = items.filter(function (i) { return i.y < yMin - 12 && i.x < xPrimera + 30; }).sort(function (a, b) { return b.y - a.y || a.x - b.x; }), lineas = [];
    abajo.forEach(function (i) { var l = lineas[lineas.length - 1]; if (l && Math.abs(l.y - i.y) < 4) l.t += ' ' + i.s; else lineas.push({ y: i.y, t: i.s }); });
    var notas = []; lineas.forEach(function (l) { var t = limpiar(l.t); if (/^\(\d+\)/.test(t)) notas.push(t); else if (notas.length && t) notas[notas.length - 1] += ' ' + t; });
    m.notas = notas;
    return m;
  }

  /* ======================= LÁMINAS 1100 × 750 mm CON CAJETÍN SINERGIA =======================
   * Geometría tomada del bloque «D-01-2 SINERGIA CAJETÍN 1100X750» (parche-cajetin-1100x750): hoja de 1100 × 750.05 mm, marco interior a
   * 51.81 mm del borde izquierdo y 13.1 mm del inferior, tira de cajetín de 127 mm a la derecha; área de dibujo 911 × 724 mm. Origen abajo-izquierda. */
  var SW = 1100, SH = 750.05, AREA = { x0: 51.8138, x1: 963.0, y0: 13.1, y1: 737.0 }, SEP = 100;
  var AW = AREA.x1 - AREA.x0, AH = AREA.y1 - AREA.y0;
  function TP(x, y) { return [x + 70.2656, y - 12.5]; }
  var CAJ_LINEAS = [
    [-70.2656, 762.55, -70.2656, 12.5, 0.7], [1029.7344, 762.55, -70.2656, 762.55, 0.7], [1029.7344, 12.5, 1029.7344, 762.55, 0.7], [-70.2656, 12.5, 1029.7344, 12.5, 0.7],
    [1019.7344, 749.5, -18.4518, 749.5], [1019.7344, 25.6, -18.4518, 25.6], [1019.7344, 749.5, 1019.7344, 25.6], [-18.4518, 749.5, -18.4518, 25.6],
    [956.2344, 35.6, 956.2344, 25.6], [1000.4345, 169.4145, 1000.4345, 151.4145], [979.6285, 169.4145, 979.6285, 151.4145], [921.9751, 169.4145, 921.9751, 151.4145],
    [892.7344, 169.4145, 892.7344, 25.6], [892.7344, 169.4145, 892.7344, 749.5],
    [1019.7344, 35.6, 892.7344, 35.6], [1019.7344, 75.9158, 892.7344, 75.9158], [1019.7344, 169.4145, 892.7344, 169.4145], [1019.7344, 163.4145, 892.7344, 163.4145],
    [1019.7344, 157.4145, 892.7344, 157.4145], [1019.7344, 102.5547, 892.7344, 102.5547], [1019.7344, 151.4145, 892.7344, 151.4145]
  ];
  var LOGO = { x: 927.4649, y: 108.8879, w: 57.7, h: 37.2 };

  /* cajetín de una lámina sobre el dibujo h (Dib de 1100 × 750), desplazado ox */
  function cajetinEn(h, dat, ox, conLogoTexto) {
    CAJ_LINEAS.forEach(function (l) { var a = TP(l[0], l[1]), b = TP(l[2], l[3]); h.L(ox + a[0], a[1], ox + b[0], b[1], 'FA-CAJETIN', l[4] || 0); });
    function tx(x, y, alto, t) { if (!t) return; var p = TP(x, y); h.T(ox + p[0], p[1] - alto, String(t).toUpperCase(), alto, 'FA-CAJETIN'); }
    tx(899.1136, 167.9448, 3.0, '# Rev.'); tx(927.4339, 167.9448, 3.0, 'Fecha y Descripción'); tx(985.0803, 167.9448, 3.0, 'Dibujo'); tx(1002.6143, 167.9448, 3.0, 'Aprob.');
    tx(899.1136, 162.2, 2.8, dat.rev); tx(927.4339, 162.2, 2.8, [dat.fecha, dat.desc].filter(Boolean).join('  ')); tx(985.0803, 162.2, 2.8, dat.dibujo);
    tx(895.894, 99.4052, 3.0, 'Contenido');
    partir(dat.titulo, 3.0, 36).slice(0, 2).forEach(function (l, i) { tx(899.5859, 94.2 - i * 4.4, 3.0, l); });
    if (dat.hoja) tx(899.5859, 94.2 - 2 * 4.4, 3.0, dat.hoja);
    tx(895.8175, 72.2345, 3.0, 'Información de registro público:');
    tx(895.8175, 61.2004, 3.0, 'Propietario:'); if (dat.propietario) tx(895.8175 + 12 * 2.3 + 3, 61.2004, 3.0, dat.propietario);
    tx(895.8175, 51.6708, 3.0, 'Plano de catastro:'); tx(895.8175, 42.7882, 3.0, 'Citas folio Real:');
    tx(895.894, 31.4918, 3.0, 'Lámina'); tx(918.0, 31.3438, 3.0, dat.lamina); tx(959.5, 31.4918, 3.0, dat.fecha);
    if (conLogoTexto) { var lg = TP(LOGO.x, LOGO.y); h.T(ox + lg[0] + 2, lg[1] + 22, 'SINERGIA', 9, 'FA-CAJETIN'); h.T(ox + lg[0] + 2, lg[1] + 10, 'INGENIERÍA', 9, 'FA-CAJETIN'); }
  }

  /* recorta el segmento a la franja [yb, ya] (ya > yb); devuelve null si queda fuera */
  function recorta(x1, y1, x2, y2, ya, yb) {
    var t0 = 0, t1 = 1, dy = y2 - y1;
    if (dy === 0) return (y1 > ya || y1 < yb) ? null : [x1, y1, x2, y2];
    var ta = (ya - y1) / dy, tb = (yb - y1) / dy, lo = Math.min(ta, tb), hi = Math.max(ta, tb);
    t0 = Math.max(t0, lo); t1 = Math.min(t1, hi);
    if (t0 >= t1) return null;
    return [x1 + (x2 - x1) * t0, y1 + dy * t0, x1 + (x2 - x1) * t1, y1 + dy * t1];
  }

  /* reparte el dibujo en láminas (de arriba hacia abajo) cortando donde d.cortes lo permite; una sola escala para todas */
  function repartirDib(d) {
    var esc = Math.min(1, AW / d.w), tope = AH / esc, cortes = (d.cortes || []).slice(), partes = [], ini = d.h;
    var fin = 0;
    while (ini - fin > 1) {
      var fn;
      if (ini - fin <= tope) fn = fin;
      else {
        var c = cortes.filter(function (v) { return v < ini - 0.3 * tope && v >= ini - tope; });
        fn = c.length ? Math.min.apply(null, c) : ini - tope;
      }
      partes.push([ini, fn]); ini = fn;
    }
    return { esc: esc, partes: partes };
  }

  /* arma las láminas: cada una es un Dib de 1100 × 750 (origen en 0) con cajetín y su parte del dibujo */
  function hojas(tipo, ctx, extra) {
    var d = lamina(tipo, ctx), R = repartirDib(d), P = ctx.proy, n = R.partes.length;
    var titulos = { du: 'Diagrama unifilar de alarma contra incendio', matriz: 'Matriz de alarma contra incendio', calc: 'Cálculos de baterías y caída de tensión', simb: 'Simbología de alarma contra incendio' };
    var cod = { du: 'AI-01', matriz: 'AI-02', calc: 'AI-03', simb: 'AI-04' }[tipo];
    var salida = [];
    R.partes.forEach(function (pr, i) {
      var ya = pr[0], yb = pr[1], h = new Dib(SW, SH), esc = R.esc;
      var dat = Object.assign({ lamina: n > 1 ? cod.replace(/\d+$/, '') + ('0' + (parseInt(cod.slice(-2), 10) + i)).slice(-2) : cod, titulo: titulos[tipo], hoja: n > 1 ? 'Hoja ' + (i + 1) + ' de ' + n : '',
        rev: P.revision && P.revision !== '0' ? P.revision : 'A', fecha: P.fecha || '', desc: 'Emisión para revisión', dibujo: 'SI', propietario: P.cliente || '' }, (extra && extra.datos) || {});
      cajetinEn(h, dat, 0, !!(extra && extra.logoTexto));
      function X(x) { return AREA.x0 + x * esc; }
      function Y(y) { return AREA.y1 - (ya - y) * esc; }
      d.e.forEach(function (e) {
        if (e.k === 'L') { var s = recorta(e.a[0], e.a[1], e.a[2], e.a[3], ya, yb); if (s) h.L(X(s[0]), Y(s[1]), X(s[2]), Y(s[3]), e.c); }
        else if (e.k === 'C') { if (e.a[1] <= ya && e.a[1] > yb) h.C(X(e.a[0]), Y(e.a[1]), e.a[2] * esc, e.c); }
        else if (e.k === 'T') { if (e.a[1] <= ya && e.a[1] > yb) h.T(X(e.a[0]), Y(e.a[1]), e.t, e.h * esc, e.c, e.al, e.r); }
        else if (e.k === 'P') {
          if (e.f) { var cy = e.p.reduce(function (a, q) { return a + q[1]; }, 0) / e.p.length; if (cy <= ya && cy > yb) h.P(e.p.map(function (q) { return [X(q[0]), Y(q[1])]; }), e.z, e.c, true); }
          else {
            var m = e.p.length, lim = e.z ? m : m - 1;
            for (var k = 0; k < lim; k++) {
              var a = e.p[k], b = e.p[(k + 1) % m], s2 = recorta(a[0], a[1], b[0], b[1], ya, yb);
              if (s2) h.L(X(s2[0]), Y(s2[1]), X(s2[2]), Y(s2[3]), e.c);
            }
          }
        }
      });
      salida.push(h);
    });
    return { hojas: salida, esc: R.esc, partes: R.partes };
  }

  /* DXF con todas las láminas en espacio modelo, una al lado de otra (separación de 100 mm) */
  function dxfHojas(tipo, ctx) {
    var H = hojas(tipo, ctx, { logoTexto: true }), todo = new Dib(H.hojas.length * (SW + SEP), SH);
    H.hojas.forEach(function (h, i) {
      var ox = i * (SW + SEP);
      h.e.forEach(function (e) {
        var c = JSON.parse(JSON.stringify(e));
        if (c.k === 'L') { c.a[0] += ox; c.a[2] += ox; } else if (c.k === 'C' || c.k === 'T') c.a[0] += ox; else if (c.k === 'P') c.p.forEach(function (q) { q[0] += ox; });
        todo.e.push(c);
      });
    });
    return aDXF(todo);
  }

  /* HTML imprimible: una página de 1100 × 750 mm por lámina, con el logo real */
  function htmlHojas(tipo, ctx, urlLogo, titulo) {
    var H = hojas(tipo, ctx), lg = TP(LOGO.x, LOGO.y);
    var logo = urlLogo ? '<image href="' + xml(urlLogo) + '" x="' + (lg[0]).toFixed(2) + '" y="' + (SH - (lg[1] + LOGO.h)).toFixed(2) + '" width="' + LOGO.w + '" height="' + LOGO.h + '" preserveAspectRatio="xMidYMid meet"/>' : '';
    var pag = H.hojas.map(function (h) {
      var s = aSVG(h).replace('style="background:#fff"', 'style="display:block;background:#fff;font-family:Century Gothic,Montserrat,Arial,sans-serif" width="' + SW + 'mm" height="' + SH + 'mm"');
      return '<div class="pag">' + s.replace('</svg>', logo + '</svg>') + '</div>';
    }).join('');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + xml(titulo || 'Lámina') + '</title><style>@page{size:' + SW + 'mm ' + SH + 'mm;margin:0}' +
      'html,body{margin:0;padding:0;background:#fff}.pag{width:' + SW + 'mm;height:' + (SH - 0.1) + 'mm;overflow:hidden;page-break-after:always;break-after:page}.pag:last-child{page-break-after:auto;break-after:auto}' +
      '@media screen{body{background:#888}.pag{margin:8px auto;background:#fff}}</style></head><body>' + pag + '</body></html>';
  }

  /* ---------- API ---------- */
  global.Lamina = {
    hojas: hojas, dxfHojas: dxfHojas, htmlHojas: htmlHojas, notasDUBase: notasDUBase,
    refAuto: function (rowId, ctx) { var r = global.Simbologia && global.Simbologia.porId(rowId); if (!r) return ''; var dv = dispositivosUsados(ctx).filter(function (q) { return global.Simbologia.filaDe(q) === r; }); return refAuto(r, dv, ctx.proy, ctx.cx); },
    usaFila: function (rowId, ctx) { var r = global.Simbologia && global.Simbologia.porId(rowId); return !!r && dispositivosUsados(ctx).some(function (q) { return global.Simbologia.filaDe(q) === r; }); },
    Dib: Dib, SIM: SIM, simboloDe: simboloDe, caja: caja, lamina: lamina, aSVG: aSVG, aDXF: aDXF,
    matrizBase: matrizBase, importarArchivo: importarArchivo, matrizDeGrid: matrizDeGrid,
    CAPAS: CAPAS
  };
})(window);
