/* Motor de cálculo — réplica de las fórmulas de Cálculo_baterías_Alarmas.xlsx
 *   BAT_FACP / BAT_TRP  → Calc.panel      (NFPA 72:2022 §10.6.7, UL 864)
 *   CALC_FUENTE_AUX     → Calc.fuente
 *   CALC_CAIDA_TENSION  → Calc.circuito   (carga concentrada)
 *   RESUMEN_PANELES / MEMORIA_CALCULO → Calc.proyecto
 * Funciones puras: no tocan el DOM ni el almacenamiento. */
(function (global) {
  'use strict';


  /* Tipos de lazo / salida de un panel (SLC, NAC, IDNAC, 24 VDC, voceo, IDC) */
  var TIPOS_LAZO = ['SLC', 'NAC', 'IDNAC', '24VDC', 'VOCEO', 'NAC+VOCEO', 'IDC', 'TEL'];
  // tipo de lazo que le corresponde a un dispositivo según la columna «circuito» del catálogo
  var LAZO_DE_CIRCUITO = { 'SLC': 'SLC', 'NAC': 'NAC', 'IDNAC': 'IDNAC', 'FUENTE AUX': '24VDC', 'VOCEO': 'VOCEO', 'NAC+VOCEO': 'NAC+VOCEO', 'IDC': 'IDC', 'ZONA': 'IDC' };
  // tipos de lazo en los que puede ir cada tipo de dispositivo (si no figura, no se valida)
  var LAZOS_PERMITIDOS = { 'SLC': ['SLC'], 'NAC': ['NAC', 'NAC+VOCEO'], 'IDNAC': ['IDNAC'], 'FUENTE AUX': ['24VDC', 'NAC'], 'VOCEO': ['VOCEO', 'NAC', 'NAC+VOCEO'], 'NAC+VOCEO': ['NAC+VOCEO'], 'IDC': ['IDC'], 'ZONA': ['IDC'] };

  /* Dispositivos con doble conexión (p. ej. base sonora o haz de luz): van a un SLC y además a un lazo de 24 VDC (campo «circuito2» del catálogo).
   * Para ellos el lazo principal es siempre SLC y la corriente del catálogo se carga al lazo de 24 VDC. */
  function tipoLazoDe(d) {
    if (!d) return 'NAC';
    if (/^J(-PH)?$/.test(d.tag || '')) return 'TEL';           // jack y teléfono de bomberos: lazo de teléfonos
    if (d.circuito2 === '24VDC') return 'SLC';                 // con alimentación a 24 V se direcciona por SLC
    if (d.circuito === 'NAC+VOCEO') return 'NAC';              // parlante + estrobo: el estrobo va al NAC y el parlante al voceo
    return LAZO_DE_CIRCUITO[d.circuito] || 'NAC';
  }
  /* Segundo lazo del dispositivo: «circuito2» del catálogo (24VDC, VOCEO, NAC…) o VOCEO para los de circuito NAC+VOCEO */
  function tipoLazo2De(d) {
    if (!d) return null;
    if (d.circuito2) return LAZO_DE_CIRCUITO[d.circuito2] || d.circuito2;
    return d.circuito === 'NAC+VOCEO' ? 'VOCEO' : null;
  }
  // NAC + voceo pueden ir juntos en un solo lazo «NAC+VOCEO» (misma tubería): en ese caso no hace falta un segundo lazo
  function parNacVoceo(d) { var a = tipoLazoDe(d), b = tipoLazo2De(d); return (a === 'NAC' && b === 'VOCEO') || (a === 'VOCEO' && b === 'NAC'); }

  var PARAMS_DEF = {
    tEspera: 24,       // h — §10.6.7.2.1
    tAlarma: 15,       // min — 5 (alarma) · 15 (voceo/EVACS)
    fs: 0.2,           // factor de seguridad por envejecimiento
    vNominal: 24,      // V
    pctFinVida: 0.85,  // tensión de fuente a fin de vida de batería (UL 864)
    vMin: 16,          // V mínima de dispositivo (UL 1971/464)
    iMaxNac: 2.4       // A — 80 % de la capacidad del NAC
  };

  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function indexar(lista) {
    var m = {};
    (lista || []).forEach(function (x) { m[x.id] = x; });
    return m;
  }

  function preparar(cat) {
    return {
      raw: cat,
      fabricantes: indexar(cat.fabricantes),
      disp: indexar(cat.dispositivos),
      cables: indexar(cat.cables),
      baterias: (cat.baterias || []).filter(function (b) { return num(b.ah) !== null; })
        .slice().sort(function (a, b) { return num(a.ah) - num(b.ah); })
    };
  }

  function dispositivosDe(cx, fabId) {
    return (cx.raw.dispositivos || []).filter(function (d) { return !fabId || d.fabricante === fabId; });
  }

  /* Parámetro efectivo: el del panel/fuente si está definido, si no el del proyecto */
  function param(obj, proy, k) {
    var v = num(obj && obj[k]);
    if (v !== null) return v;
    var p = num(proy && proy.params && proy.params[k]);
    return p !== null ? p : PARAMS_DEF[k];
  }

  /* Una fila de dispositivos (columnas D…K de BAT_xxx / CALC_FUENTE_AUX) */
  function fila(cx, f) {
    var d = f.disp ? cx.disp[f.disp] : null;
    var cant = num(f.cant);
    var iEspU = num(f.iEsp) !== null ? num(f.iEsp) : (d ? num(d.iEspera) : null);
    var iAlmU = num(f.iAlm) !== null ? num(f.iAlm) : (d ? num(d.iAlarma) : null);
    var r = {
      d: d,
      tag: d ? d.tag : '',
      descripcion: d ? d.descripcion : '',
      circuito: d ? d.circuito : '',
      iEspU: iEspU, iAlmU: iAlmU,
      iEspT: cant !== null && iEspU !== null ? cant * iEspU / 1000 : null,
      iAlmT: cant !== null && iAlmU !== null ? cant * iAlmU / 1000 : null,
      editado: num(f.iEsp) !== null || num(f.iAlm) !== null,
      aviso: '', nivel: ''
    };
    var vacia = !f.disp && cant === null;
    if (!vacia) {
      if (!f.disp) { r.aviso = 'Elija el modelo'; r.nivel = 'error'; }
      else if (!d) { r.aviso = 'El modelo ya no está en el catálogo'; r.nivel = 'error'; }
      else if (iEspU === null || iAlmU === null) { r.aviso = 'Corriente sin definir: digítela en la fila'; r.nivel = 'error'; }
      else if (cant === null || cant <= 0) { r.aviso = 'Digite la cantidad'; r.nivel = 'warn'; }
    }
    return r;
  }

  /* Bloque «CÁLCULO DE CAPACIDAD DE BATERÍA» + selección de batería estándar.
   * Excel: si Ah requerido supera la mayor batería de BD_BATERIAS, la fórmula devolvía la menor (error silencioso);
   * aquí se marca «excede» para que el usuario lo vea. */
  function bateria(cx, iEsp, iAlm, tEsp, tAlmMin, fs) {
    var ahEsp = iEsp * tEsp;
    var ahAlm = iAlm * tAlmMin / 60;
    var ahCalc = ahEsp + ahAlm;
    var ahReq = ahCalc * (1 + fs);
    var sel = null;
    for (var i = 0; i < cx.baterias.length; i++) {
      if (num(cx.baterias[i].ah) >= ahReq - 1e-9) { sel = cx.baterias[i]; break; }
    }
    return {
      iEsp: iEsp, iAlm: iAlm, tEsp: tEsp, tAlmMin: tAlmMin, fs: fs,
      ahEsp: ahEsp, ahAlm: ahAlm, ahCalc: ahCalc, ahReq: ahReq,
      bateria: sel,
      ah: sel ? num(sel.ah) : null,
      referencia: sel ? [sel.refSimplex, sel.refNotifier].filter(Boolean).join(' / ') : '—',
      excede: !sel && cx.baterias.length > 0,
      estado: sel ? 'OK' : 'REVISAR'
    };
  }

  function mapaCircuitos(proy) {
    var m = {};
    ((proy && proy.caida && proy.caida.circuitos) || []).forEach(function (c) { m[c.id] = c; });
    return m;
  }

  /* Equipos que pueden alimentar lazos de otros equipos: fuentes auxiliares y amplificadores (lista «fuentes» del proyecto), por id */
  function alimentadores(proy) { var m = {}; (proy.paneles || []).concat(proy.fuentes || []).forEach(function (f) { m[f.id] = f; }); return m; }
  /* Lazo al que se carga la corriente de una fila: con doble conexión a 24 V, el lazo de 24 V; si no, el lazo principal */
  function lazoCorriente(d, f, circs) {
    if (d && tipoLazo2De(d) === '24VDC') return (f.circ2 && circs[f.circ2]) || null;
    return (f.circ && circs[f.circ]) || null;
  }
  /* Equipo (fuente auxiliar o amplificador) que carga con la corriente de la fila, según el campo «alim» (alimentado por) del lazo.
   * Sin «alim», si el lazo pertenece a una fuente/amplificador, es ese. A un amplificador solo van los dispositivos de voceo. */
  function duenoCarga(d, f, circs, alims) {
    var c = d ? lazoCorriente(d, f, circs) : null;
    if (!c) return null;
    if (c.alim && alims[c.alim]) return alims[c.alim];            // asignación explícita: se cargan todos los dispositivos del lazo
    var e = alims[c.fuente] || null;                              // por defecto, el equipo dueño del lazo (a un amplificador solo van los de voceo)
    if (e && e.tipo === 'AMP' && d.circuito !== 'VOCEO') return null;
    return e;
  }

  function sumarFilas(cx, filas, circs, dueno) {
    var res = (filas || []).map(function (f) {
      var r = fila(cx, f);
      var ef = dueno && r.d ? duenoCarga(r.d, f, circs, dueno.amps) : null;
      if (ef && ef.id !== dueno.id) { r.aCargoDe = ef; r.aviso = 'Se carga ' + (ef.tipo === 'AMP' ? 'al amplificador ' : (/^(FACP|TRP)$/.test(ef.tipo) ? 'al panel ' : 'a la fuente ')) + (ef.tag || ''); r.nivel = 'info'; return r; }
      // el dispositivo debe ir en un lazo de su tipo (un detector SLC no va en un NAC)
      if (f.circ && !r.aviso) {
        var c = circs && circs[f.circ];
        if (!c) { r.aviso = 'El lazo asignado ya no existe'; r.nivel = 'warn'; }
        else if (r.d && tipoLazo2De(r.d)) {
          if (!(c.tipo === tipoLazoDe(r.d) || (parNacVoceo(r.d) && c.tipo === 'NAC+VOCEO'))) { r.aviso = 'Va conectado a un lazo de ' + tipoLazoDe(r.d) + ' (y a uno de ' + tipoLazo2De(r.d) + '); este lazo es ' + c.tipo; r.nivel = 'warn'; }
        }
        else if (r.d && tipoLazoDe(r.d) === 'TEL' && c.tipo !== 'TEL') { r.aviso = 'Es jack / teléfono de bomberos y el lazo es ' + c.tipo + ' (use un lazo de teléfonos)'; r.nivel = 'warn'; }
        else if (r.d && !tipoLazo2De(r.d) && LAZOS_PERMITIDOS[r.d.circuito] && LAZOS_PERMITIDOS[r.d.circuito].indexOf(c.tipo) < 0) {
          r.aviso = 'Es de tipo ' + r.d.circuito + ' y el lazo es ' + c.tipo; r.nivel = 'warn';
        }
      }
      // doble conexión: el segundo lazo también debe existir y ser del tipo correcto (salvo NAC + voceo en un solo lazo combinado)
      if (r.d && tipoLazo2De(r.d) && f.circ && !r.aviso) {
        var c1 = circs && circs[f.circ], t2 = tipoLazo2De(r.d), c2 = f.circ2 && circs && circs[f.circ2];
        if (!(parNacVoceo(r.d) && c1 && c1.tipo === 'NAC+VOCEO')) {
          if (!f.circ2) { r.aviso = 'Asigne también el lazo de ' + t2 + (t2 === '24VDC' ? ' (alimentación)' : ''); r.nivel = 'warn'; }
          else if (!c2) { r.aviso = 'El lazo de ' + t2 + ' asignado ya no existe'; r.nivel = 'warn'; }
          else if (c2.tipo !== t2) { r.aviso = 'El segundo lazo debe ser de ' + t2 + ' y este es ' + c2.tipo; r.nivel = 'warn'; }
        }
      }
      return r;
    });
    var iEsp = 0, iAlm = 0, errores = 0;
    res.forEach(function (r) {
      if (r.aCargoDe) return;
      iEsp += r.iEspT || 0;
      iAlm += r.iAlmT || 0;
      if (r.nivel === 'error') errores++;
    });
    return { filas: res, iEsp: iEsp, iAlm: iAlm, errores: errores };
  }

  /* Hoja BAT_FACP / BAT_TRP */
  function panel(cx, p, proy) {
    var s = sumarFilas(cx, p.filas, mapaCircuitos(proy), { id: p.id, amps: alimentadores(proy) });
    // dispositivos de otros equipos (otros niveles) conectados a lazos de este panel: se cargan a su batería
    var ext = cargaExterna(cx, proy, p);
    s.cargado = ext; s.iEsp += ext.iEsp; s.iAlm += ext.iAlm;
    s.bat = bateria(cx, s.iEsp, s.iAlm, param(p, proy, 'tEspera'), param(p, proy, 'tAlarma'), param(p, proy, 'fs'));
    s.estado = s.errores ? 'REVISAR' : s.bat.estado;
    return s;
  }

  /* Corriente de los dispositivos de OTROS equipos cuyos lazos tienen a este equipo como «alimentado por» */
  function cargaExterna(cx, proy, f) {
    var circs = mapaCircuitos(proy), alims = alimentadores(proy), ext = { iEsp: 0, iAlm: 0, n: 0 };
    (proy.paneles || []).concat(proy.fuentes || []).forEach(function (eq) {
      if (eq === f) return;
      (eq.filas || []).forEach(function (fl) {
        var rr = fila(cx, fl);
        if (!rr.d) return;
        var e = duenoCarga(rr.d, fl, circs, alims);
        if (!e || e.id !== f.id) return;
        ext.iEsp += rr.iEspT || 0; ext.iAlm += rr.iAlmT || 0; ext.n += num(fl.cant) || 0;
      });
    });
    return ext;
  }

  /* Hoja CALC_FUENTE_AUX: el consumo propio de la fuente se suma a espera y alarma; límite 80 % de I máx */
  function fuente(cx, f, proy) {
    var s = sumarFilas(cx, f.filas, mapaCircuitos(proy), { id: f.id, amps: alimentadores(proy) });
    var iPropia = num(f.iPropia) || 0;
    s.iEspDisp = s.iEsp;
    s.iAlmDisp = s.iAlm;
    s.iMax = num(f.iMax);
    if (f.tipo === 'AMP') {
      // Amplificador de voceo: lo que va por sus lazos de voceo (parlantes de cualquier panel) se carga aquí.
      // Alarma = consumo propio + carga de voceo; I máx. (ficha, plena potencia) es la capacidad y, si no hay parlantes asignados, la carga de diseño.
      var ext = cargaExterna(cx, proy, f);
      var carga = s.iAlm + ext.iAlm;
      s.cargaVoceo = carga; s.nVoceo = ext.n; s.cargado = ext;
      s.iEsp += ext.iEsp + iPropia;
      var usaFicha = carga === 0 && s.iMax !== null;
      s.iAlm = (usaFicha ? s.iMax : carga) + iPropia;
      s.iPermitida = s.iMax;
      s.okCorriente = s.iMax === null ? null : s.iAlm <= s.iMax + 1e-9;
      s.verificacion = s.okCorriente === false ? 'ERROR: EXCEDE LA CAPACIDAD DEL AMPLIFICADOR'
        : (usaFicha ? 'Sin parlantes asignados: usa I máx. de ficha' : (carga === 0 ? 'Asigne parlantes a un lazo de voceo de este amplificador' : 'Carga de voceo ' + (Math.round(carga * 1000)) + ' mA'));
    } else {
      var extF = cargaExterna(cx, proy, f);
      s.cargado = extF;
      s.iEsp += iPropia + extF.iEsp;
      s.iAlm += iPropia + extF.iAlm;
      s.iPermitida = s.iMax !== null ? 0.8 * s.iMax : null;
      s.okCorriente = s.iPermitida === null ? null : s.iAlm <= s.iPermitida + 1e-9;
      s.verificacion = s.okCorriente === null ? 'Defina I máx de la fuente'
        : (s.okCorriente ? 'OK' : 'ERROR: EXCEDE 80% DE LA FUENTE');
    }
    s.bat = bateria(cx, s.iEsp, s.iAlm, param(f, proy, 'tEspera'), param(f, proy, 'tAlarma'), param(f, proy, 'fs'));
    s.estado = (s.errores || s.okCorriente === false) ? 'REVISAR' : s.bat.estado;
    return s;
  }

  function parametrosCaida(proy) {
    var vNom = param(null, proy, 'vNominal');
    var pct = param(null, proy, 'pctFinVida');
    return { vNominal: vNom, vFuente: vNom * pct, vMin: param(null, proy, 'vMin'), iMaxNac: param(null, proy, 'iMaxNac') };
  }

  /* Carga de cada lazo = Σ (cantidad × corriente de alarma) de los dispositivos asignados a él (en mA) */
  function cargasLazos(cx, proy) {
    var mapa = {}, circs = mapaCircuitos(proy);
    (proy.paneles || []).concat(proy.fuentes || []).forEach(function (eq) {
      (eq.filas || []).forEach(function (f) {
        if (!f.circ && !f.circ2) return;
        var r = fila(cx, f), cant = num(f.cant);
        if (!r.d || !cant) return;
        var t2 = tipoLazo2De(r.d), lz = f.circ, soloCuenta = null;
        if (t2) {
          var c1 = circs[f.circ];
          if (parNacVoceo(r.d) && c1 && c1.tipo === 'NAC+VOCEO') lz = f.circ;                      // un solo lazo combinado: todo ahí
          else if (t2 === '24VDC') { lz = f.circ2; soloCuenta = f.circ; }                          // la corriente (24 V) va al lazo de alimentación; el SLC solo cuenta el dispositivo
          else { lz = f.circ; soloCuenta = f.circ2; }                                              // NAC + voceo por separado: la corriente en el lazo principal; el otro solo cuenta
        }
        if (soloCuenta) { var ms = mapa[soloCuenta] || (mapa[soloCuenta] = { n: 0, iMa: 0, sinI: 0, bases: false, notif: false }); ms.n += cant; }
        if (!lz) return;
        var m = mapa[lz] || (mapa[lz] = { n: 0, iMa: 0, sinI: 0, bases: false, notif: false });
        m.n += cant;
        if (r.iAlmU === null) m.sinI += 1; else m.iMa += cant * r.iAlmU;
        var tag = r.d.tag || '';
        if (/^(SB|CO\+SB)/.test(tag)) m.bases = true;
        if (/^(ST|AV|SPK)/.test(tag)) m.notif = true;
      });
    });
    return mapa;
  }

  function circuito(cx, c, carga, pc) {
    carga = carga || { n: 0, iMa: 0, sinI: 0, bases: false, notif: false };
    var otros = num(c.otros);
    var hayDatos = carga.n > 0 || otros !== null;
    var r = { n: carga.n, iDisp: carga.iMa, iMa: null, rKm: null, rLazo: null, vFuente: pc.vFuente, caida: null, vDisp: null, pct: null, estado: '', comentario: '' };
    if (hayDatos) r.iMa = carga.iMa + (otros || 0);
    var cab = c.cable ? cx.cables[c.cable] : null;
    if (cab) r.rKm = num(cab.rKm);
    var L = num(c.long);
    if (L !== null && r.rKm !== null) r.rLazo = 2 * L / 1000 * r.rKm;
    if (r.iMa !== null && r.rLazo !== null) {
      r.caida = r.iMa / 1000 * r.rLazo;
      r.vDisp = pc.vFuente - r.caida;
      r.pct = r.caida / pc.vFuente;
      var excI = r.iMa > pc.iMaxNac * 1000 + 1e-9;
      if (r.vDisp >= pc.vMin && !excI) r.estado = 'OK';
      else r.estado = excI ? 'ERROR: I > I MÁX NAC' : 'ERROR: V < V MÍN';
      if (carga.bases && carga.notif) r.comentario = 'NO COMBINAR BASES AUDIBLES CON NAC';
      else if (r.estado !== 'OK') r.comentario = 'AUMENTE CALIBRE, REDUZCA DISTANCIA O DIVIDA EL CIRCUITO';
    } else if (hayDatos || c.cable || L !== null) {
      r.estado = 'INCOMPLETO';
      r.comentario = !hayDatos ? 'Asigne dispositivos al lazo (o digite OTROS en mA)' : (!cab ? 'Seleccione el cable' : 'Digite la longitud');
    }
    if (carga.sinI > 0) {
      r.estado = 'INCOMPLETO';
      r.comentario = 'Hay dispositivos del lazo sin corriente definida: la corriente real es mayor';
    }
    return r;
  }

  function caida(cx, proy) {
    var cd = proy.caida || {};
    var pc = parametrosCaida(proy);
    var cargas = cargasLazos(cx, proy);
    var res = (cd.circuitos || []).map(function (c) { return circuito(cx, c, cargas[c.id], pc); });
    var totalMa = 0, errores = 0;
    res.forEach(function (r) {
      totalMa += r.iMa || 0;
      if (r.estado.indexOf('ERROR') === 0) errores++;
    });
    return { params: pc, circuitos: res, totalA: totalMa / 1000, errores: errores };
  }

  /* Resumen de cantidades de dispositivos por TAG (equivalente al «resumen» de la memoria) */
  function resumenDispositivos(cx, proy) {
    var cols = (proy.paneles || []).concat(proy.fuentes || []);
    var mapa = {};
    cols.forEach(function (eq, j) {
      (eq.filas || []).forEach(function (f) {
        var d = cx.disp[f.disp];
        var cant = num(f.cant);
        if (!d || !cant) return;
        var k = d.id;
        if (!mapa[k]) mapa[k] = { disp: d, cant: cols.map(function () { return 0; }), total: 0 };
        mapa[k].cant[j] += cant;
        mapa[k].total += cant;
      });
    });
    var filas = Object.keys(mapa).map(function (k) { return mapa[k]; });
    filas.sort(function (a, b) {
      return (a.disp.circuito || '').localeCompare(b.disp.circuito || '') || (a.disp.tag || '').localeCompare(b.disp.tag || '');
    });
    return { columnas: cols, filas: filas };
  }

  function proyecto(cx, proy) {
    var paneles = (proy.paneles || []).map(function (p) { return { p: p, r: panel(cx, p, proy) }; });
    var fuentes = (proy.fuentes || []).map(function (f) { return { f: f, r: fuente(cx, f, proy) }; });
    var tot = { iEsp: 0, iAlm: 0, ahReq: 0 };
    paneles.forEach(function (x) { tot.iEsp += x.r.iEsp; tot.iAlm += x.r.iAlm; tot.ahReq += x.r.bat.ahReq; });
    return {
      paneles: paneles, fuentes: fuentes, totalPaneles: tot,
      caida: caida(cx, proy),
      dispositivos: resumenDispositivos(cx, proy)
    };
  }

  global.Calc = {
    TIPOS_LAZO: TIPOS_LAZO,
    tipoLazoDe: tipoLazoDe,
    tipoLazo2De: tipoLazo2De,
    parNacVoceo: parNacVoceo,
    alimentadores: alimentadores,
    PARAMS_DEF: PARAMS_DEF,
    num: num,
    preparar: preparar,
    dispositivosDe: dispositivosDe,
    param: param,
    fila: fila,
    bateria: bateria,
    panel: panel,
    fuente: fuente,
    caida: caida,
    circuito: circuito,
    proyecto: proyecto
  };
})(window);
