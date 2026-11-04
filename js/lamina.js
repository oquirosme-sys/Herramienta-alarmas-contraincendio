/* Láminas de alarma contra incendio: diagrama unifilar (DU), matriz de entradas/salidas y cálculos.
 * Un solo modelo de dibujo (líneas, polilíneas, círculos, textos; mm; Y hacia arriba) se muestra como SVG en pantalla
 * y se exporta como DXF (capas FA-*) para pegarlo en las láminas del proyecto. Símbolos: NFPA 170 cap. 8 (js/simbolos-nfpa170.js). */
(function (global) {
  'use strict';

  /* ---------- capas (nombre → color AutoCAD / color en pantalla) ---------- */
  var CAPAS = {
    'FA-MARCO': [7, '#111'], 'FA-TEXTO': [7, '#111'], 'FA-SIMBOLOS': [7, '#111'], 'FA-TABLA': [7, '#111'],
    'FA-SLC': [3, '#1b9e3a'], 'FA-NAC': [30, '#a0522d'], 'FA-IDNAC': [6, '#a02c8f'], 'FA-VOCEO': [5, '#1f3bd1'],
    'FA-24VDC': [1, '#d11f1f'], 'FA-IDC': [4, '#0a9fb0'], 'FA-ENCABEZADO': [5, '#1f4e79'], 'FA-ALERTA': [1, '#c00000'], 'FA-TEXTO-BLANCO': [7, '#fff']
  };
  var CAPA_DE_TIPO = { SLC: 'FA-SLC', NAC: 'FA-NAC', IDNAC: 'FA-IDNAC', VOCEO: 'FA-VOCEO', '24VDC': 'FA-24VDC', IDC: 'FA-IDC' };

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
    [/^SD-DUCTO|^RTS/, 'FA133'], [/^SDH-C/, 'FA132'], [/^SDT/, 'FA079'], [/^CO\+SB/, 'FA127'], [/^CO/, 'FA127'], [/^SDH/, 'FA132'],
    [/^BH/, 'FA130'], [/^EM/, 'FA118'], [/^AIM/, 'FA064'], [/^AOM/, 'FA066'], [/^ZAM|^ISO/, 'FA067'], [/^RLY/, 'FA088'],
    [/^SS/, 'FA100'], [/^WF/, 'FA090'], [/^VS/, 'FA104'], [/^SB/, 'FA134'],
    [/^ST-C-WRF/, 'FA157'], [/^ST-WRF/, 'FA158'], [/^SPK\+ST-C/, 'FA154'], [/^SPK\+ST/, 'FA155'], [/^SPK/, 'FA151'],
    [/^ST-C/, 'FA154'], [/^ST-P/, 'FA155'], [/^AV-C/, 'FA142'], [/^AV-P/, 'FA142'],
    [/^J-PH/, 'FA163'], [/^J/, 'FA166']
  ];
  function simboloDe(d) {
    var tag = (d && d.tag) || '';
    for (var i = 0; i < SIM_TAG.length; i++) if (SIM_TAG[i][0].test(tag)) return SIM_TAG[i][1];
    return 'FA001';
  }

  /* ---------- modelo de dibujo ---------- */
  function Dib(w, h) { this.w = w; this.h = h; this.e = []; }
  Dib.prototype = {
    L: function (x1, y1, x2, y2, capa) { this.e.push({ k: 'L', a: [x1, y1, x2, y2], c: capa || 'FA-TEXTO' }); return this; },
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
      if (e.k === 'L') o.push('<line x1="' + e.a[0].toFixed(2) + '" y1="' + (H - e.a[1]).toFixed(2) + '" x2="' + e.a[2].toFixed(2) + '" y2="' + (H - e.a[3]).toFixed(2) + '" stroke="' + c + '"/>');
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
      if (e.k === 'L') { g(0, 'LINE'); g(8, e.c); g(10, n(e.a[0])); g(20, n(e.a[1])); g(30, 0); g(11, n(e.a[2])); g(21, n(e.a[3])); g(31, 0); }
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

  /* ======================= DIAGRAMA UNIFILAR (DU) ======================= */
  function dibujarDU(d, ctx, x0, yTop) {
    var P = ctx.proy, cx = ctx.cx, Calc = ctx.Calc;
    var niveles = P.niveles.length ? P.niveles : ['NIVEL 1'];
    var pitch = Math.max(56, Math.min(72, 600 / niveles.length)), slot = pitch / 3, ESC = 1.35;
    var yBase = yTop - 60 - niveles.length * pitch; // fila del nivel más bajo
    var xR = { SLC: x0 + 215, NAC: x0 + 229, IDNAC: x0 + 229, VOCEO: x0 + 243, '24VDC': x0 + 257, IDC: x0 + 215 };
    var SLOT = { SLC: 0, IDC: 0, NAC: 1, IDNAC: 1, VOCEO: 2, '24VDC': 2 };
    var xChain = x0 + 285, paso = 24;
    var circs = {}; P.caida.circuitos.forEach(function (c) { circs[c.id] = c; });
    var usados = [], numDe = {}; // leyenda
    // dispositivos por nivel y línea
    var porNivel = {};
    P.paneles.concat(P.fuentes).forEach(function (eq) {
      (eq.filas || []).forEach(function (f) {
        var dsp = cx.disp[f.disp], cant = Calc.num(f.cant);
        if (!dsp || !cant) return;
        if (/^(FACP|TRP|OTRO)$/.test(dsp.tag)) return;
        var nv = f.zona || eq.nivel || niveles[0], c = f.circ ? circs[f.circ] : null, tipo = c ? c.tipo : Calc.tipoLazoDe(dsp);
        if (SLOT[tipo] === undefined) tipo = 'SLC';
        var L = (porNivel[nv] = porNivel[nv] || {}), key = SLOT[tipo];
        var lista = (L[key] = L[key] || []), g = lista.filter(function (x) { return x.dsp.id === dsp.id; })[0];
        if (g) g.cant += cant; else lista.push({ dsp: dsp, cant: cant, tipo: tipo });
        if (usados.indexOf(dsp.id) < 0) { usados.push(dsp.id); numDe[dsp.id] = usados.length; }
      });
    });
    var maxCad = 6; Object.keys(porNivel).forEach(function (nv) { Object.keys(porNivel[nv]).forEach(function (k) { maxCad = Math.max(maxCad, porNivel[nv][k].length); }); });
    var xEnd = xChain + maxCad * paso + 12;
    d.T(x0, yTop, 'DU ALARMAS CONTRA INCENDIO', 7, 'FA-TEXTO');
    d.T(x0, yTop - 8, (P.nombre || '') + (P.numero ? ' · ' + P.numero : ''), 3.4, 'FA-TEXTO');
    // FACP con módulos de lazo
    var fx = x0, fy = yBase - 120, fw = 190, fh = 92;
    var nSLC = Math.max(1, P.caida.circuitos.filter(function (c) { return c.tipo === 'SLC'; }).length),
      nNAC = Math.max(1, P.caida.circuitos.filter(function (c) { return c.tipo === 'NAC' || c.tipo === 'IDNAC'; }).length),
      mods = Math.min(8, Math.ceil(nSLC / 2) + Math.ceil(nNAC / 2));
    d.R(fx, fy, fw, fh, 'FA-SIMBOLOS');
    d.T(fx + 8, fy + fh - 18, 'FACP', 14, 'FA-TEXTO');
    var mw = Math.min(26, (fw - 20) / Math.max(mods, 6)), mx0 = fx + 10, nsl = Math.ceil(nSLC / 2);
    for (var i = 0; i < Math.max(mods, 6); i++) {
      var tipoM = i < Math.max(1, nsl) ? 'SLC' : 'NAC';
      d.R(mx0 + i * mw, fy + 24, mw, 40, 'FA-SIMBOLOS');
      d.T(mx0 + i * mw + mw / 2, fy + 52, tipoM, 3, 'FA-TEXTO', 'c');
      [0.25, 0.5, 0.75].forEach(function (q) { d.P([[mx0 + i * mw + mw * q - 0.9, fy + 60.5], [mx0 + i * mw + mw * q + 0.9, fy + 60.5], [mx0 + i * mw + mw * q + 0.9, fy + 62.3], [mx0 + i * mw + mw * q - 0.9, fy + 62.3]], true, 'FA-SIMBOLOS', true); });
    }
    d.T(fx + fw / 2, fy + 8, (P.paneles[0] ? P.paneles[0].tag : 'FACP') + ' · ' + ((cx.fabricantes && cx.fabricantes[P.fabricante]) ? cx.fabricantes[P.fabricante].nombre : ''), 2.8, 'FA-TEXTO', 'c');
    // montantes (risers)
    var yTopRiser = yBase + (niveles.length - 1) * pitch + 3 * slot;
    var tiposUsados = {};
    Object.keys(porNivel).forEach(function (nv) { Object.keys(porNivel[nv]).forEach(function (k) { porNivel[nv][k].forEach(function (g) { tiposUsados[g.tipo] = 1; }); }); });
    P.caida.circuitos.forEach(function (c) { tiposUsados[c.tipo] = 1; });
    var verRiser = ['SLC', 'NAC', 'VOCEO', '24VDC'].filter(function (t) { return tiposUsados[t] || (t === 'NAC' && tiposUsados.IDNAC); });
    verRiser.forEach(function (t, idx) {
      var yc = fy + fh - 10 - idx * 6;
      d.L(fx + fw, yc, xR[t], yc, CAPA_DE_TIPO[t]);
      d.L(xR[t], yc, xR[t], yTopRiser, CAPA_DE_TIPO[t]);
      d.T(xR[t], yTopRiser + 3, t === '24VDC' ? '24 VDC' : t, 2.6, CAPA_DE_TIPO[t], 'c');
    });
    // filas por nivel (el primero de la lista queda abajo)
    niveles.forEach(function (nv, i) {
      var y = yBase + i * pitch, L = porNivel[nv] || {};
      d.L(x0 + 275, y - slot * 0.8, xEnd, y - slot * 0.8, 'FA-TEXTO');
      d.T(xEnd, y - slot * 0.8 + 2, String(nv), 3.6, 'FA-TEXTO', 'r');
      // transponder / panel del nivel
      P.paneles.forEach(function (p, pi) {
        if (p.nivel === nv && pi > 0) { d.S('FA018', x0 + 262, y, 1.6, 'FA-SIMBOLOS'); d.T(x0 + 262, y + 8, p.tag || 'TRP', 2.4, 'FA-TEXTO', 'c'); }
      });
      [0, 1, 2].forEach(function (k) {
        var g = L[k] || [], yy = y + k * slot;
        if (!g.length) return;
        var tipoK = g[0].tipo, capa = CAPA_DE_TIPO[tipoK] || 'FA-SLC', xr = xR[tipoK] !== undefined ? xR[tipoK] : xR.SLC;
        var xFin = xChain + g.length * paso;
        d.L(xr, yy, xFin, yy, capa);
        g.forEach(function (it, j) {
          var xs = xChain + j * paso + paso / 2, sid = simboloDe(it.dsp), s = ESC;
          var cb = caja(SIM[sid] || SIM.FA001), esc = Math.min(ESC, 11 / Math.max(cb.w, cb.h));
          d.S(sid, xs, yy, esc, 'FA-SIMBOLOS');
          var top = cb.h * esc / 2;
          d.C(xs, yy + top + 4.6, 2.2, 'FA-TEXTO'); d.L(xs, yy + top + 2.4, xs, yy + top, 'FA-TEXTO');
          d.T(xs, yy + top + 3.8, numDe[it.dsp.id], 2.2, 'FA-TEXTO', 'c');
          d.T(xs, yy - top - 3.4, '×' + it.cant, 2.4, 'FA-TEXTO', 'c');
        });
      });
    });
    // leyenda y tablas a la derecha
    var lx = xEnd + 30, ly = yTop - 4, lw = 235;
    d.R(lx, ly - 12, lw, 12, 'FA-TABLA'); d.T(lx + lw / 2, ly - 8.2, 'SIMBOLOGÍA DE ALARMAS CONTRA INCENDIO (NFPA 170)', 3.4, 'FA-TEXTO', 'c');
    var yy = ly - 12;
    usados.forEach(function (id) {
      var dsp = cx.disp[id], sid = simboloDe(dsp), cb = caja(SIM[sid] || SIM.FA001), esc = Math.min(1.4, 12 / Math.max(cb.w, cb.h));
      var fab = cx.fabricantes && cx.fabricantes[dsp.fabricante] ? cx.fabricantes[dsp.fabricante].nombre : '';
      var lin = partir((dsp.tipo ? dsp.tipo + ' — ' : '') + (dsp.descripcion || ''), 2.3, lw - 80), alto = Math.max(15, lin.length * 3.5 + 4);
      d.R(lx, yy - alto, lw, alto, 'FA-TABLA'); d.L(lx + 24, yy, lx + 24, yy - alto, 'FA-TABLA'); d.L(lx + lw - 52, yy, lx + lw - 52, yy - alto, 'FA-TABLA');
      d.S(sid, lx + 12, yy - alto / 2, esc, 'FA-SIMBOLOS');
      d.C(lx + 4, yy - 4, 2.2, 'FA-TEXTO'); d.T(lx + 4, yy - 4.8, numDe[id], 2.2, 'FA-TEXTO', 'c');
      lin.forEach(function (t, k) { d.T(lx + 26, yy - 5 - k * 3.5, t, 2.3, 'FA-TEXTO'); });
      d.T(lx + lw - 50, yy - 5, 'REFERENCIA ' + fab, 2, 'FA-TEXTO'); d.T(lx + lw - 50, yy - 9, dsp.modelo && dsp.modelo !== '—' ? dsp.modelo : (dsp.tag || ''), 2.3, 'FA-TEXTO');
      yy -= alto;
    });
    if (!usados.length) { d.R(lx, yy - 14, lw, 14, 'FA-TABLA'); d.T(lx + 4, yy - 8, 'Asigne dispositivos a los niveles en las pestañas de cada panel.', 2.6, 'FA-TEXTO'); yy -= 14; }
    // cableado
    yy -= 10;
    d.R(lx, yy - 12, lw, 12, 'FA-TABLA'); d.T(lx + lw / 2, yy - 8.2, 'CABLEADO SISTEMA ALARMAS CONTRA INCENDIO', 3.4, 'FA-TEXTO', 'c'); yy -= 12;
    var vistos = {};
    P.caida.circuitos.forEach(function (c) {
      var cab = c.cable ? cx.cables[c.cable] : null, k = c.tipo + '|' + (cab ? cab.id : '');
      if (vistos[k]) return; vistos[k] = 1;
      d.R(lx, yy - 11, lw, 11, 'FA-TABLA'); d.L(lx + 30, yy, lx + 30, yy - 11, 'FA-TABLA');
      d.L(lx + 4, yy - 5.5, lx + 26, yy - 5.5, CAPA_DE_TIPO[c.tipo] || 'FA-TEXTO');
      d.T(lx + 33, yy - 4.5, (c.tipo === '24VDC' ? '24 VDC' : c.tipo) + ': ' + (cab ? cab.conductores + ' conductores ' + (cab.pantalla === 'SI' ? 'con pantalla ' : '') + cab.listado + ' ' + cab.awg + ' AWG' : 'cable sin definir'), 2.3, 'FA-TEXTO');
      d.T(lx + 33, yy - 8.5, cab ? 'Ref.: ' + cab.fabricante + ' ' + cab.modelo : '', 2.3, 'FA-TEXTO');
      yy -= 11;
    });
    // notas del sistema
    yy -= 10;
    d.R(lx, yy - 12, lw, 12, 'FA-TABLA'); d.T(lx + lw / 2, yy - 8.2, 'NOTAS SISTEMA ALARMAS CONTRA INCENDIO', 3.4, 'FA-TEXTO', 'c'); yy -= 12;
    var pr = P.params || {}, tE = Calc.num(pr.tEspera) || 24, tA = Calc.num(pr.tAlarma) || 15;
    var notas = [
      'Panel con circuito dedicado 120 VAC/20 A mediante interruptor aprobado con opción de bloqueo, de acuerdo con NFPA 72 §10.6.5.4.',
      'Baterías con capacidad para ' + tE + ' h en espera y ' + tA + ' min en alarma (NFPA 72 §10.6.7.2.1.2); prever espacio para ampliación no menor de 20 %.',
      'Se debe contemplar un módulo aislador por cada nivel y cada 25 dispositivos por lazo.',
      'Cantidades y especificaciones de los módulos según planos de planta; símbolos según NFPA 170 (2018), cap. 8.'
    ];
    notas.forEach(function (t, i) {
      var lin = partir((i + 1) + '. ' + t, 2.3, lw - 6), alto = lin.length * 3.5 + 4;
      d.R(lx, yy - alto, lw, alto, 'FA-TABLA');
      lin.forEach(function (l, k) { d.T(lx + 3, yy - 5 - k * 3.5, l, 2.3, 'FA-TEXTO'); });
      yy -= alto;
    });
    return { ancho: lx + lw, yFin: Math.min(yy, fy) };
  }

  /* ======================= láminas completas ======================= */
  function lamina(tipo, ctx) {
    var M = ctx.proy.matriz || matrizBase();
    var d = new Dib(0, 0), r;
    if (tipo === 'du') r = dibujarDU(d, ctx, 20, 700);
    else if (tipo === 'matriz') r = dibujarMatriz(d, M, 20, 700);
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

  /* ---------- API ---------- */
  global.Lamina = {
    Dib: Dib, SIM: SIM, simboloDe: simboloDe, caja: caja, lamina: lamina, aSVG: aSVG, aDXF: aDXF,
    matrizBase: matrizBase, importarArchivo: importarArchivo, matrizDeGrid: matrizDeGrid,
    CAPAS: CAPAS
  };
})(window);
