/* Interfaz — Cálculo de baterías para alarma contra incendio.
 * Estructura de pestañas (reemplaza las hojas del Excel):
 *   Proyecto            → datos generales, parámetros NFPA 72, niveles, lista de paneles y fuentes
 *   <TAG de panel>      → una pestaña por panel / transponder (BAT_FACP_xx, BAT_TRP_xx)
 *   <TAG de fuente>     → una pestaña por fuente auxiliar (CALC_FUENTE_AUX)
 *   Caída de tensión    → CALC_CAIDA_TENSION
 *   Memoria de cálculo  → MEMORIA_CALCULO + RESUMEN_PANELES (imprimible)
 *   Administración      → BD_DISPOSITIVOS, BD_CABLES, BD_BATERIAS (solo administrador; hojas ocultas del Excel) */
(function () {
  'use strict';

  var S = {
    cat: null, cx: null, proy: null, lista: [],
    tab: 'proyecto', adminSub: 'dispositivos',
    adminFiltro: { fab: '', q: '' },
    pintor: null, importModo: 'proyecto',
    tGuardar: null, tGuardarCat: null
  };

  var vista = document.getElementById('vista');
  var tabsEl = document.getElementById('tabs');

  /* ======================= utilidades ======================= */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(v, d) {
    if (v === null || v === undefined || v === '' || !isFinite(v)) return '—';
    d = d === undefined ? 2 : d;
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtN(v) { return v === null || v === undefined ? '' : v; }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function porId(lista, id) { for (var i = 0; i < (lista || []).length; i++) if (lista[i].id === id) return lista[i]; return null; }
  function badge(estado) {
    if (!estado) return '<span class="badge pend">—</span>';
    var cls = estado === 'OK' ? 'ok' : (estado.indexOf('ERROR') === 0 || estado === 'REVISAR' ? 'error' : 'warn');
    return '<span class="badge ' + cls + '">' + esc(estado) + '</span>';
  }
  function out(clave, html) {
    var els = vista.querySelectorAll('[data-out="' + clave + '"]');
    for (var i = 0; i < els.length; i++) els[i].innerHTML = html;
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function descargar(nombre, datos) {
    var blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre.replace(/[\\/:*?"<>|]+/g, '_');
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* Diálogo genérico: devuelve los valores del formulario o null si se cancela */
  function dialogo(op) {
    var dlg = document.getElementById('dlg');
    document.getElementById('dlgTitulo').textContent = op.titulo || '';
    document.getElementById('dlgCuerpo').innerHTML = op.html || '';
    var ok = document.getElementById('dlgOk');
    ok.textContent = op.ok || 'Aceptar';
    ok.style.background = ok.style.borderColor = op.peligro ? 'var(--err)' : '';
    document.getElementById('dlgCancelar').hidden = op.soloOk === true;
    dlg.returnValue = '';
    dlg.showModal();
    var primero = dlg.querySelector('#dlgCuerpo input, #dlgCuerpo select');
    if (primero) primero.focus();
    return new Promise(function (res) {
      dlg.addEventListener('close', function h() {
        dlg.removeEventListener('close', h);
        if (dlg.returnValue !== 'ok') return res(null);
        var datos = {};
        dlg.querySelectorAll('#dlgCuerpo [name]').forEach(function (el) { datos[el.name] = el.value; });
        res(datos);
      });
    });
  }
  function confirmar(titulo, texto, ok) {
    return dialogo({ titulo: titulo, html: '<p>' + texto + '</p>', ok: ok || 'Eliminar', peligro: true })
      .then(function (r) { return r !== null; });
  }

  /* ======================= modelo ======================= */
  function buscarDisp(fab, modelo, tag) {
    var d = (S.cat.dispositivos || []).filter(function (x) {
      return x.fabricante === fab && (!modelo || x.modelo === modelo) && (!tag || x.tag === tag);
    })[0];
    return d ? d.id : '';
  }

  function categoriasDefault(fab) {
    var tags = ['AV-P 15cd', 'AV-P 30cd', 'AV-P 75cd', 'AV-P 110cd'];
    var res = tags.map(function (t) { return buscarDisp(fab, null, t) || buscarDisp(fab, null, t.replace('AV-P', 'ST-P')); });
    res.push(buscarDisp(fab, null, 'SB'));
    return res;
  }

  function nuevoProyecto(nombre) {
    var fab = (S.cat.fabricantes[0] || {}).id || '';
    return {
      id: uid('p'), nombre: nombre || 'Proyecto nuevo', numero: '', cliente: '', ubicacion: '',
      elaboro: '', reviso: '', empresa: 'Sinergia Ingeniería', fecha: hoy(), revision: '0',
      fabricante: fab, normativa: 'NFPA 72:2022 · UL 864 · NEC (NFPA 70) Art. 760',
      params: clonar(Calc.PARAMS_DEF),
      niveles: [], paneles: [], fuentes: [],
      caida: { categorias: categoriasDefault(fab), circuitos: [] }
    };
  }

  function normalizar(p) {
    p.params = Object.assign(clonar(Calc.PARAMS_DEF), p.params || {});
    p.niveles = p.niveles || [];
    p.paneles = p.paneles || [];
    p.fuentes = p.fuentes || [];
    p.caida = p.caida || {};
    p.caida.categorias = p.caida.categorias || categoriasDefault(p.fabricante);
    p.caida.circuitos = p.caida.circuitos || [];
    p.paneles.concat(p.fuentes).forEach(function (e) { e.filas = e.filas || []; });
    return p;
  }

  function nuevaFila(fab, zona) {
    return { id: uid('r'), fab: fab || S.proy.fabricante, disp: '', zona: zona || '', cant: null, iEsp: null, iAlm: null, obs: '' };
  }

  function tagLibre(base) {
    var usados = S.proy.paneles.concat(S.proy.fuentes).map(function (e) { return e.tag; });
    if (usados.indexOf(base) < 0) return base;
    for (var i = 2; i < 999; i++) if (usados.indexOf(base + '-' + i) < 0) return base + '-' + i;
    return base;
  }

  function nivelCorto(nivel) {
    var n = String(nivel || '').toUpperCase().trim();
    var m = n.match(/^(S[OÓ]TANO|NIVEL|PISO|N|S)\s*-?\s*(\d+)/);
    if (m) return (m[1].charAt(0) === 'S' ? 'S' : 'N') + m[2];
    return n.replace(/\s+/g, '').slice(0, 6);
  }

  function nuevoPanel(tipo, nivel) {
    var P = S.proy;
    var nFacp = P.paneles.filter(function (x) { return x.tipo === 'FACP'; }).length;
    var tag = tipo === 'FACP' ? tagLibre('FACP-' + ('0' + (nFacp + 1)).slice(-2))
      : tagLibre('TRP-' + (nivel ? nivelCorto(nivel) : ('0' + (P.paneles.length + 1)).slice(-2)));
    var f = nuevaFila(P.fabricante, nivel);
    f.disp = buscarDisp(P.fabricante, null, tipo);
    f.cant = f.disp ? 1 : null;
    f.obs = '(consumo propio del equipo)';
    return { id: uid('pn'), tag: tag, tipo: tipo, nivel: nivel || '', descripcion: '', tEspera: null, tAlarma: null, fs: null, filas: [f] };
  }

  function nuevaFuente(nivel) {
    var P = S.proy;
    return {
      id: uid('fu'), tag: tagLibre('RPS-' + ('0' + (P.fuentes.length + 1)).slice(-2)), nivel: nivel || '',
      panelId: (P.paneles[0] || {}).id || '', descripcion: '', iMax: 8, iPropia: 0.145,
      tEspera: null, tAlarma: null, fs: null, filas: []
    };
  }

  function nuevoCircuito() {
    return { id: uid('c'), fuente: (S.proy.paneles[0] || {}).id || '', circuito: '', desc: '', q: [null, null, null, null, null], otros: null, cable: buscarCable('5220UL'), long: null };
  }
  function buscarCable(modelo) {
    var c = (S.cat.cables || []).filter(function (x) { return x.modelo === modelo; })[0];
    return c ? c.id : '';
  }

  /* Proyecto de ejemplo con los mismos datos del Excel original (sirve para verificar resultados) */
  function proyectoEjemplo() {
    var p = nuevoProyecto('Proyecto de ejemplo (Excel)');
    var prev = S.proy;
    S.proy = p;
    p.fabricante = 'simplex';
    p.niveles = ['SÓTANO 2', 'NIVEL 1', 'NIVEL 3', 'NIVEL 6', 'NIVEL 9'];
    var facp = nuevoPanel('FACP', 'NIVEL 1');
    facp.descripcion = 'Panel principal';
    facp.filas[0].disp = buscarDisp('simplex', '4010ES', 'FACP');
    facp.filas[0].cant = 14;
    p.paneles.push(facp);
    ['SÓTANO 2', 'NIVEL 3', 'NIVEL 6', 'NIVEL 9'].forEach(function (n) {
      var t = nuevoPanel('TRP', n);
      t.filas[0].disp = buscarDisp('simplex', '4100-9600', 'TRP');
      p.paneles.push(t);
    });
    var rps = nuevaFuente('NIVEL 1');
    rps.panelId = facp.id;
    var fr = nuevaFila('simplex', 'HABITACIONES N2');
    fr.disp = buscarDisp('simplex', '4906-9151', 'ST-P 110cd');
    fr.cant = 20;
    fr.obs = '(fila de ejemplo — reemplazar)';
    rps.filas.push(fr);
    p.fuentes.push(rps);
    var c1 = nuevoCircuito();
    c1.fuente = facp.id; c1.circuito = 'NAC 1'; c1.desc = 'Parqueo — ejemplo'; c1.q = [5, 8, null, null, null]; c1.long = 150;
    var c2 = nuevoCircuito();
    c2.fuente = facp.id; c2.circuito = 'SLC 1'; c2.desc = 'Lazo detección N1-N3 — ejemplo'; c2.otros = 1500; c2.long = 350;
    p.caida.circuitos.push(c1, c2);
    S.proy = prev;
    return p;
  }

  function equipo(ref) {
    var t = ref.split(':');
    return porId(t[0] === 'p' ? S.proy.paneles : S.proy.fuentes, t[1]);
  }
  function nombreEquipo(id) {
    var e = porId(S.proy.paneles, id) || porId(S.proy.fuentes, id);
    return e ? e.tag : (id ? '(eliminado)' : '');
  }

  /* ======================= guardado ======================= */
  var REMOTO = !!Store.remoto;
  var ESPERA_GUARDADO = REMOTO ? 900 : 400;

  function msgError(e) { return (e && (e.message || e.error_description)) || String(e); }

  function estadoGuardado(estado) {
    var el = document.getElementById('estadoGuardado');
    var donde = REMOTO ? ' en Supabase' : '';
    el.textContent = estado === 'error' ? '● Sin guardar' : (estado ? '● Guardando…' : '● Guardado' + donde);
    el.title = REMOTO ? 'Los datos se guardan en la base de datos Supabase' : 'Los datos se guardan en este navegador';
    el.classList.toggle('dirty', !!estado);
  }
  function proyectoCambiado() {
    estadoGuardado(true);
    clearTimeout(S.tGuardar);
    S.tGuardar = setTimeout(guardarYa, ESPERA_GUARDADO);
  }
  function guardarYa() {
    clearTimeout(S.tGuardar);
    S.tGuardar = null;
    if (S.enConflicto) return Promise.resolve();
    return Store.saveProyecto(S.proy).then(function (res) {
      if (res === 'conflicto') return resolverConflicto();
      if (!res) toast('⚠ No se pudo guardar (almacenamiento lleno o bloqueado)');
      return Store.listarProyectos().then(function (l) {
        S.lista = l;
        estadoGuardado(false);
        renderSelector();
      });
    }).catch(function (e) {
      estadoGuardado('error');
      toast('⚠ Error al guardar: ' + msgError(e));
    });
  }

  /* Otro usuario guardó el mismo proyecto mientras se editaba (solo en modo Supabase) */
  function resolverConflicto() {
    S.enConflicto = true;
    estadoGuardado('error');
    return dialogo({
      titulo: 'El proyecto fue modificado por otro usuario',
      html: '<p style="margin:0">Mientras editaba, otra persona guardó cambios en <b>' + esc(S.proy.nombre) + '</b>.</p>' +
        '<label class="campo"><span>¿Qué desea hacer?</span><select name="op">' +
        '<option value="copia">Guardar mis cambios como un proyecto nuevo (copia)</option>' +
        '<option value="recargar">Descartar mis cambios y cargar la versión del otro usuario</option></select></label>',
      ok: 'Continuar', soloOk: true
    }).then(function (r) {
      S.enConflicto = false;
      if (r && r.op === 'recargar') {
        Store.olvidarVersion(S.proy.id);
        return Store.getProyecto(S.proy.id).then(function (p) {
          if (p) return abrirProyecto(p, S.tab);
          toast('El proyecto fue eliminado por el otro usuario');
        });
      }
      var c = clonar(S.proy);
      c.id = uid('p');
      c.nombre = (c.nombre || '') + ' (mi versión)';
      return abrirProyecto(c, S.tab).then(function () { toast('Sus cambios quedaron en «' + c.nombre + '»'); });
    });
  }

  function catalogoCambiado(tabla) {
    S.cx = Calc.preparar(S.cat);
    S.tablasSucias = S.tablasSucias || {};
    if (tabla) S.tablasSucias[tabla] = 1; else S.tablasSucias.todas = 1;
    estadoGuardado(true);
    clearTimeout(S.tGuardarCat);
    S.tGuardarCat = setTimeout(guardarCatalogo, ESPERA_GUARDADO);
  }
  function guardarCatalogo() {
    clearTimeout(S.tGuardarCat);
    var sucias = S.tablasSucias || {};
    S.tablasSucias = {};
    var tablas = sucias.todas ? null : Object.keys(sucias);
    return Store.saveCatalogo(S.cat, tablas).then(function () { estadoGuardado(false); }).catch(function (e) {
      estadoGuardado('error');
      toast('⚠ No se pudo guardar el catálogo: ' + msgError(e));
    });
  }

  /* ======================= barra superior ======================= */
  function renderSelector() {
    var sel = document.getElementById('selProyecto');
    sel.innerHTML = S.lista.map(function (p) {
      var et = (p.numero ? p.numero + ' · ' : '') + (p.nombre || '(sin nombre)');
      var tit = p.actualizado ? 'Actualizado ' + new Date(p.actualizado).toLocaleString() + (p.editor ? ' por ' + p.editor : '') : '';
      return '<option value="' + esc(p.id) + '"' + (S.proy && p.id === S.proy.id ? ' selected' : '') + ' title="' + esc(tit) + '">' + esc(et) + '</option>';
    }).join('');
  }

  function renderAdminBtn() {
    if (REMOTO) {
      var pf = Auth.perfil() || {};
      var u = Auth.usuario();
      document.getElementById('btnAdmin').classList.toggle('on', Auth.esAdmin());
      document.getElementById('lblAdmin').textContent = u ? (pf.nombre || u.email) + (Auth.esAdmin() ? ' · admin' : '') : 'Sin sesión';
      document.querySelector('#btnAdmin span').textContent = '👤';
      document.getElementById('btnAdmin').title = u ? u.email + ' — clic para opciones de sesión' : '';
      return;
    }
    var on = Auth.esAdmin();
    document.getElementById('btnAdmin').classList.toggle('on', on);
    document.getElementById('lblAdmin').textContent = on ? 'Admin activo · salir' : 'Administrador';
    document.querySelector('#btnAdmin span').textContent = on ? '🔓' : '🔒';
  }

  /* ======================= pestañas ======================= */
  function estadoEquipo(r, eq) {
    var conDatos = (eq.filas || []).some(function (f) { return f.disp || Calc.num(f.cant) !== null; });
    if (!conDatos) return 'pend';
    return r.estado === 'OK' ? 'ok' : 'error';
  }

  function renderTabs() {
    var P = S.proy, h = [];
    function tab(id, label, sub, dot, extra) {
      h.push('<button class="tab' + (S.tab === id ? ' activa' : '') + (extra || '') + '" role="tab" data-tab="' + esc(id) + '">' +
        (dot ? '<span class="tab-dot ' + dot + '"></span>' : '') + esc(label) +
        (sub ? ' <span class="tab-sub">' + esc(sub) + '</span>' : '') + '</button>');
    }
    tab('proyecto', 'Proyecto');
    if (P.paneles.length) h.push('<span class="tab-sep"></span>');
    P.paneles.forEach(function (p) { tab('p:' + p.id, p.tag || '(sin TAG)', p.nivel, estadoEquipo(Calc.panel(S.cx, p, P), p)); });
    if (P.fuentes.length) h.push('<span class="tab-sep"></span>');
    P.fuentes.forEach(function (f) { tab('f:' + f.id, f.tag || '(sin TAG)', 'fuente aux.', estadoEquipo(Calc.fuente(S.cx, f, P), f)); });
    h.push('<span class="tab-sep"></span>');
    var cd = Calc.caida(S.cx, P);
    tab('caida', 'Caída de tensión', '', P.caida.circuitos.length ? (cd.errores ? 'error' : 'ok') : 'pend');
    tab('memoria', 'Memoria de cálculo');
    if (Auth.esAdmin()) tab('admin', '⚙ Administración', '', '', ' admin');
    tabsEl.innerHTML = h.join('');
  }

  function irA(tab) {
    S.tab = tab;
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    renderTabs();
    renderVista();
  }

  function renderVista() {
    var y = window.scrollY;
    S.pintor = null;
    var t = S.tab;
    if (t === 'admin' && !Auth.esAdmin()) t = S.tab = 'proyecto';
    if ((t.indexOf('p:') === 0 || t.indexOf('f:') === 0) && !equipo(t)) t = S.tab = 'proyecto';
    if (t === 'proyecto') vistaProyecto();
    else if (t.indexOf('p:') === 0 || t.indexOf('f:') === 0) vistaEquipo(t);
    else if (t === 'caida') vistaCaida();
    else if (t === 'memoria') vistaMemoria();
    else if (t === 'admin') vistaAdmin();
    if (S.pintor) S.pintor();
    window.scrollTo(0, y);
  }

  /* ======================= campos ======================= */
  function attrs(o) {
    return Object.keys(o).filter(function (k) { return o[k] !== undefined && o[k] !== null && o[k] !== false; }).map(function (k) {
      return o[k] === true ? k : k + '="' + esc(o[k]) + '"';
    }).join(' ');
  }
  /* Campo con etiqueta enlazado al modelo: b = {o, id, k, t, eq} */
  function campo(label, b, valor, extra) {
    extra = extra || {};
    var a = Object.assign({ 'data-o': b.o, 'data-id': b.id, 'data-k': b.k, 'data-t': b.t, 'data-eq': b.eq, 'data-re': b.re }, extra.attrs || {});
    var v = b.t === 'pct' && valor !== null && valor !== undefined && valor !== '' ? +(valor * 100).toFixed(4) : fmtN(valor);
    var ctl;
    if (extra.opciones) {
      ctl = '<select ' + attrs(a) + '>' + extra.opciones + '</select>';
    } else {
      a.type = extra.type || (b.t ? 'number' : 'text');
      if (a.type === 'number') a.step = 'any';
      a.value = v;
      ctl = '<input ' + attrs(a) + '>';
    }
    return '<label class="campo"' + (extra.span ? ' style="grid-column: span ' + extra.span + '"' : '') + '><span>' + esc(label) + '</span>' + ctl +
      (extra.ayuda ? '<small>' + extra.ayuda + '</small>' : '') + '</label>';
  }
  function opts(lista, sel, vacio) {
    var h = vacio !== undefined ? '<option value="">' + esc(vacio) + '</option>' : '';
    var hay = false;
    lista.forEach(function (x) {
      var v = typeof x === 'object' ? x.v : x, l = typeof x === 'object' ? x.l : x;
      if (v === sel) hay = true;
      h += '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(l) + '</option>';
    });
    if (sel && !hay) h += '<option value="' + esc(sel) + '" selected>' + esc(sel) + '</option>';
    return h;
  }
  function optsFabricantes(sel) {
    return opts(S.cat.fabricantes.map(function (f) { return { v: f.id, l: f.nombre }; }), sel);
  }
  function optsNiveles(sel) {
    return opts(S.proy.niveles, sel, '— nivel —');
  }
  function optsModelo(fab, sel) {
    var grupos = {}, orden = [];
    Calc.dispositivosDe(S.cx, fab).forEach(function (d) {
      var g = d.circuito || 'OTROS';
      if (!grupos[g]) { grupos[g] = []; orden.push(g); }
      grupos[g].push(d);
    });
    var h = '<option value="">— modelo —</option>';
    orden.forEach(function (g) {
      h += '<optgroup label="' + esc(g) + '">' + grupos[g].map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (d.id === sel ? ' selected' : '') + ' title="' + esc(d.descripcion) + '">' +
          esc(etiquetaDisp(d)) + '</option>';
      }).join('') + '</optgroup>';
    });
    if (sel && !S.cx.disp[sel]) h += '<option value="' + esc(sel) + '" selected>(no está en el catálogo)</option>';
    else if (sel && S.cx.disp[sel].fabricante !== fab) {
      var d = S.cx.disp[sel];
      h += '<option value="' + esc(sel) + '" selected>' + esc(etiquetaDisp(d)) + '</option>';
    }
    return h;
  }
  /* Etiqueta del dispositivo en las listas: código (modelo/referencia) + descripción */
  function etiquetaDisp(d) {
    var cod = d.modelo && d.modelo !== '—' ? d.modelo : '';
    var desc = d.descripcion || d.tag || '';
    return cod && desc ? cod + ' — ' + desc : (cod || desc);
  }
  function optsDispTodos(sel) {
    var h = '<option value="">— sin modelo (0 mA) —</option>';
    S.cat.fabricantes.forEach(function (f) {
      var l = Calc.dispositivosDe(S.cx, f.id);
      if (!l.length) return;
      h += '<optgroup label="' + esc(f.nombre) + '">' + l.map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (d.id === sel ? ' selected' : '') + '>' + esc(etiquetaDisp(d)) + ' (' + fmt(d.iAlarma, 0) + ' mA)</option>';
      }).join('') + '</optgroup>';
    });
    return h;
  }
  function optsCables(sel) {
    return opts(S.cat.cables.map(function (c) {
      return { v: c.id, l: c.fabricante + ' ' + c.modelo + ' (' + c.awg + ' AWG · ' + c.listado + ')' };
    }), sel, '— cable —');
  }
  function optsEquipos(sel) {
    var l = S.proy.paneles.map(function (p) { return { v: p.id, l: p.tag + (p.nivel ? ' · ' + p.nivel : '') }; })
      .concat(S.proy.fuentes.map(function (f) { return { v: f.id, l: f.tag + ' (fuente)' }; }));
    var h = opts(l, null, '— fuente / panel —');
    if (sel) h = h.replace('value="' + esc(sel) + '"', 'value="' + esc(sel) + '" selected');
    if (sel && !porId(S.proy.paneles, sel) && !porId(S.proy.fuentes, sel)) h += '<option value="' + esc(sel) + '" selected>(eliminado)</option>';
    return h;
  }

  /* ======================= vista: Proyecto ======================= */
  function vistaProyecto() {
    var P = S.proy, pp = P.params;
    var B = function (k, t, re) { return { o: 'proy', k: k, t: t, re: re }; };
    var Bp = function (k, t) { return { o: 'params', k: k, t: t }; };
    var h = [];
    h.push('<div class="encabezado"><div><h2>' + esc(P.nombre || 'Proyecto') + '</h2>' +
      '<div class="sub">Datos generales, parámetros de cálculo, niveles y equipos. Cada panel y fuente auxiliar crea su propia pestaña.</div></div>' +
      '<div class="acciones"><button class="btn" data-act="ir" data-tab="memoria">Ver memoria de cálculo →</button></div></div>');

    h.push('<div class="grid-2col"><div>');
    // Información
    h.push('<section class="card"><div class="card-h"><h3>Información del proyecto</h3><span class="nota">Celdas verdes = entrada manual</span></div><div class="card-b"><div class="grid c4">' +
      campo('Nombre del proyecto', B('nombre', null, 'sel'), P.nombre, { span: 2 }) +
      campo('N.º de proyecto', B('numero', null, 'sel'), P.numero) +
      campo('Revisión', B('revision'), P.revision) +
      campo('Cliente', B('cliente'), P.cliente, { span: 2 }) +
      campo('Ubicación', B('ubicacion'), P.ubicacion) +
      campo('Fecha', B('fecha'), P.fecha, { type: 'date' }) +
      campo('Elaboró', B('elaboro'), P.elaboro) +
      campo('Revisó', B('reviso'), P.reviso) +
      campo('Empresa', B('empresa'), P.empresa) +
      campo('Fabricante principal', B('fabricante'), P.fabricante, { opciones: optsFabricantes(P.fabricante), ayuda: 'Valor inicial de filas nuevas' }) +
      campo('Normativa', B('normativa'), P.normativa, { span: 4 }) +
      '</div></div></section>');
    h.push('</div><div>');
    // Parámetros
    h.push('<section class="card"><div class="card-h"><h3>Parámetros NFPA 72</h3><span class="nota">Aplican a todos los equipos salvo que el equipo los cambie</span></div><div class="card-b"><div class="grid c2">' +
      campo('Tiempo de espera (h)', Bp('tEspera', 'num'), pp.tEspera, { ayuda: '§10.6.7.2.1: 24 h' }) +
      campo('Tiempo de alarma (min)', Bp('tAlarma', 'num'), pp.tAlarma, { ayuda: '5 min alarma · 15 min voceo/EVACS', attrs: { list: 'dl-talarma' } }) +
      campo('Factor de seguridad (%)', Bp('fs', 'pct'), pp.fs, { ayuda: 'Envejecimiento de baterías (fichas de fabricante)' }) +
      campo('Tensión nominal (V)', Bp('vNominal', 'num'), pp.vNominal) +
      campo('Fuente a fin de vida (%)', Bp('pctFinVida', 'pct'), pp.pctFinVida, { ayuda: '<span data-out="vfuente"></span>' }) +
      campo('V mínima de dispositivo (V)', Bp('vMin', 'num'), pp.vMin, { ayuda: 'UL 1971/464 típico 16–33 V' }) +
      campo('I máx. por circuito NAC (A)', Bp('iMaxNac', 'num'), pp.iMaxNac, { ayuda: '80 % de la capacidad del NAC' }) +
      '</div><datalist id="dl-talarma"><option value="5"><option value="15"></datalist></div></section>');
    h.push('</div></div>');

    // Niveles
    h.push('<section class="card"><div class="card-h"><h3>Niveles del edificio</h3><span class="nota">Se usan para ubicar paneles y como «Nivel / zona» de los dispositivos</span></div><div class="card-b">' +
      '<div class="chips">' + (P.niveles.length ? P.niveles.map(function (n, i) {
        return '<span class="chip">' + esc(n) + '<button title="Quitar nivel" data-act="nivel-del" data-i="' + i + '">✕</button></span>';
      }).join('') : '<span class="muted" style="color:var(--ink-3)">Sin niveles definidos.</span>') + '</div>' +
      '<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">' +
      '<input class="in" id="inNivel" placeholder="Ej.: SÓTANO 2, SÓTANO 1, NIVEL 1, NIVEL 2" style="max-width:420px">' +
      '<button class="btn" data-act="nivel-add">Agregar</button>' +
      '<button class="btn" data-act="niveles-rango">Agregar rango…</button>' +
      '<button class="btn btn-primary" data-act="trp-por-nivel" title="Crea un panel por cada nivel que todavía no tiene">Crear un panel/transponder por nivel</button>' +
      '</div><small style="color:var(--ink-3); display:block; margin-top:6px">Separe varios niveles con coma. El primer panel creado será el FACP; los siguientes, transponders (TRP).</small></div></section>');

    // Paneles
    h.push('<section class="card"><div class="card-h"><h3>Paneles y transponders</h3>' +
      '<div style="display:flex; gap:6px"><button class="btn btn-sm" data-act="panel-add" data-tipo="FACP">+ FACP</button><button class="btn btn-sm btn-primary" data-act="panel-add" data-tipo="TRP">+ Transponder</button></div></div>' +
      '<div class="card-b flush tabla-wrap">');
    if (!P.paneles.length) {
      h.push('<div class="vacio">Todavía no hay paneles. Agregue el FACP y los transponders (cada uno calcula su propia batería).</div>');
    } else {
      h.push('<table class="t"><thead><tr><th>TAG</th><th>Tipo</th><th>Nivel / ubicación</th><th>Descripción</th><th class="num">Disp.</th><th class="num">I espera (A)</th><th class="num">I alarma (A)</th><th class="num">Ah requerido</th><th class="num">Batería (Ah)</th><th>Estado</th><th></th></tr></thead><tbody>');
      P.paneles.forEach(function (p) {
        var b = function (k) { return 'data-o="panel" data-id="' + esc(p.id) + '" data-k="' + k + '"'; };
        h.push('<tr><td><input class="in w-sm" ' + b('tag') + ' data-re="tabs" value="' + esc(p.tag) + '"></td>' +
          '<td><select class="in w-sm" ' + b('tipo') + ' data-re="tabs">' + opts(['FACP', 'TRP'], p.tipo) + '</select></td>' +
          '<td><select class="in w-md" ' + b('nivel') + ' data-re="tabs">' + optsNiveles(p.nivel) + '</select></td>' +
          '<td><input class="in w-md" ' + b('descripcion') + ' value="' + esc(p.descripcion) + '"></td>' +
          '<td class="calc num" data-out="n:' + p.id + '"></td><td class="calc num" data-out="ie:' + p.id + '"></td><td class="calc num" data-out="ia:' + p.id + '"></td>' +
          '<td class="calc num" data-out="ah:' + p.id + '"></td><td class="calc num" data-out="bat:' + p.id + '"></td><td data-out="est:' + p.id + '"></td>' +
          '<td style="white-space:nowrap"><button class="btn btn-sm" data-act="ir" data-tab="p:' + esc(p.id) + '">Abrir →</button>' +
          '<button class="btn-icon" title="Duplicar" data-act="panel-dup" data-id="' + esc(p.id) + '">⧉</button>' +
          '<button class="btn-icon del" title="Eliminar" data-act="panel-del" data-id="' + esc(p.id) + '">✕</button></td></tr>');
      });
      h.push('</tbody><tfoot><tr><td colspan="5">TOTAL SISTEMA</td><td class="num" data-out="tot-ie"></td><td class="num" data-out="tot-ia"></td><td class="num" data-out="tot-ah"></td><td colspan="3"></td></tr></tfoot></table>');
    }
    h.push('</div></section>');

    // Fuentes
    h.push('<section class="card"><div class="card-h"><h3>Fuentes de poder auxiliares</h3><button class="btn btn-sm btn-primary" data-act="fuente-add">+ Fuente auxiliar</button></div><div class="card-b flush tabla-wrap">');
    if (!P.fuentes.length) {
      h.push('<div class="vacio">Sin fuentes auxiliares (NAC expander / bases sonoras). Agregue una si el proyecto la requiere.</div>');
    } else {
      h.push('<table class="t"><thead><tr><th>TAG</th><th>Nivel</th><th>Alimentada desde</th><th class="num">I máx. (A)</th><th class="num">I propia (A)</th><th class="num">I alarma (A)</th><th>Verificación 80 %</th><th class="num">Ah requerido</th><th class="num">Batería (Ah)</th><th>Estado</th><th></th></tr></thead><tbody>');
      P.fuentes.forEach(function (f) {
        var b = function (k, t) { return 'data-o="fuente" data-id="' + esc(f.id) + '" data-k="' + k + '"' + (t ? ' data-t="' + t + '" type="number" step="any"' : ''); };
        h.push('<tr><td><input class="in w-sm" ' + b('tag') + ' data-re="tabs" value="' + esc(f.tag) + '"></td>' +
          '<td><select class="in w-md" ' + b('nivel') + '>' + optsNiveles(f.nivel) + '</select></td>' +
          '<td><select class="in w-sm" ' + b('panelId') + '>' + opts(P.paneles.map(function (p) { return { v: p.id, l: p.tag }; }), f.panelId, '—') + '</select></td>' +
          '<td><input class="in w-xs" ' + b('iMax', 'num') + ' value="' + fmtN(f.iMax) + '"></td>' +
          '<td><input class="in w-xs" ' + b('iPropia', 'num') + ' value="' + fmtN(f.iPropia) + '"></td>' +
          '<td class="calc num" data-out="ia:' + f.id + '"></td><td data-out="ver:' + f.id + '"></td>' +
          '<td class="calc num" data-out="ah:' + f.id + '"></td><td class="calc num" data-out="bat:' + f.id + '"></td><td data-out="est:' + f.id + '"></td>' +
          '<td style="white-space:nowrap"><button class="btn btn-sm" data-act="ir" data-tab="f:' + esc(f.id) + '">Abrir →</button>' +
          '<button class="btn-icon" title="Duplicar" data-act="fuente-dup" data-id="' + esc(f.id) + '">⧉</button>' +
          '<button class="btn-icon del" title="Eliminar" data-act="fuente-del" data-id="' + esc(f.id) + '">✕</button></td></tr>');
      });
      h.push('</tbody></table>');
    }
    h.push('</div></section>');
    vista.innerHTML = h.join('');

    S.pintor = function () {
      var R = Calc.proyecto(S.cx, P);
      out('vfuente', '= ' + fmt(R.caida.params.vFuente, 2) + ' V de fuente degradada');
      R.paneles.forEach(function (x) {
        var id = x.p.id;
        out('n:' + id, (x.p.filas || []).reduce(function (s, f) { return s + (Calc.num(f.cant) || 0); }, 0));
        out('ie:' + id, fmt(x.r.iEsp, 3));
        out('ia:' + id, fmt(x.r.iAlm, 3));
        out('ah:' + id, fmt(x.r.bat.ahReq, 2));
        out('bat:' + id, x.r.bat.ah !== null ? fmt(x.r.bat.ah, 1) : '<span class="aviso error">excede BD</span>');
        out('est:' + id, badge(x.r.estado));
      });
      out('tot-ie', fmt(R.totalPaneles.iEsp, 3));
      out('tot-ia', fmt(R.totalPaneles.iAlm, 3));
      out('tot-ah', fmt(R.totalPaneles.ahReq, 2));
      R.fuentes.forEach(function (x) {
        var id = x.f.id;
        out('ia:' + id, fmt(x.r.iAlm, 3));
        out('ver:' + id, badge(x.r.verificacion));
        out('ah:' + id, fmt(x.r.bat.ahReq, 2));
        out('bat:' + id, x.r.bat.ah !== null ? fmt(x.r.bat.ah, 1) : '<span class="aviso error">excede BD</span>');
        out('est:' + id, badge(x.r.estado));
      });
    };
  }

  /* ======================= vista: Panel / Fuente ======================= */
  function vistaEquipo(ref) {
    var esF = ref.charAt(0) === 'f';
    var eq = equipo(ref), P = S.proy;
    var o = esF ? 'fuente' : 'panel';
    var B = function (k, t, re) { return { o: o, id: eq.id, k: k, t: t, re: re }; };
    var pp = P.params;
    var h = [];
    var titulo = esF ? 'Fuente auxiliar ' + eq.tag : (eq.tipo === 'FACP' ? 'Panel ' : 'Transponder ') + eq.tag;
    h.push('<div class="encabezado"><div><h2>' + esc(titulo) + (eq.nivel ? ' · ' + esc(eq.nivel) : '') + '</h2>' +
      '<div class="sub">' + (esF ? 'Cálculo de fuente de poder auxiliar (NAC expander / bases sonoras) — NFPA 72:2022'
        : 'Cálculo de baterías — NFPA 72:2022 §10.6.7. Cada panel/transponder calcula su propia batería (respalda solo su carga local).') + '</div></div>' +
      '<div class="acciones"><button class="btn" data-act="ir" data-tab="proyecto">← Proyecto</button>' +
      '<button class="btn btn-danger" data-act="' + o + '-del" data-id="' + esc(eq.id) + '">Eliminar ' + (esF ? 'fuente' : 'panel') + '</button></div></div>');

    // Datos del equipo
    h.push('<section class="card"><div class="card-h"><h3>Datos del equipo</h3><span class="nota">Parámetros vacíos = se usa el valor del proyecto (en gris)</span></div><div class="card-b"><div class="grid c4">' +
      campo(esF ? 'Fuente / TAG' : 'Panel / TAG', B('tag', null, 'tabs'), eq.tag) +
      (esF ? campo('Alimentada desde', B('panelId'), eq.panelId, { opciones: opts(P.paneles.map(function (p) { return { v: p.id, l: p.tag }; }), eq.panelId, '—') })
        : campo('Tipo', B('tipo', null, 'tabs'), eq.tipo, { opciones: opts([{ v: 'FACP', l: 'FACP — panel principal' }, { v: 'TRP', l: 'TRP — transponder' }], eq.tipo) })) +
      campo('Nivel / ubicación', B('nivel', null, 'tabs'), eq.nivel, { opciones: optsNiveles(eq.nivel) }) +
      campo('Descripción', B('descripcion'), eq.descripcion) +
      campo('Tiempo de espera (h)', B('tEspera', 'num'), eq.tEspera, { attrs: { placeholder: pp.tEspera } }) +
      campo('Tiempo de alarma (min)', B('tAlarma', 'num'), eq.tAlarma, { attrs: { placeholder: pp.tAlarma, list: 'dl-talarma' }, ayuda: '5 min alarma · 15 min voceo/EVACS' }) +
      campo('Factor de seguridad (%)', B('fs', 'pct'), eq.fs, { attrs: { placeholder: +(pp.fs * 100).toFixed(2) } }) +
      (esF ? campo('I máx. fuente (A) — ficha', B('iMax', 'num'), eq.iMax, { ayuda: 'Ej.: Notifier FCPS-24S8 = 8 A. Se limita al 80 %' }) +
        campo('I propia de la fuente (A)', B('iPropia', 'num'), eq.iPropia, { ayuda: 'Se suma en espera y en alarma' }) : '') +
      '</div><datalist id="dl-talarma"><option value="5"><option value="15"></datalist></div></section>');

    // Dispositivos
    h.push('<section class="card"><div class="card-h"><h3>Dispositivos conectados</h3>' +
      '<span class="nota">Flujo: 1) Fabricante → 2) Modelo → 3) Nivel/zona y cantidad. ' + (esF ? '' : 'Incluya el consumo del panel/transponder como primera fila. ') +
      'Las corrientes unitarias vienen del catálogo; si digita un valor, reemplaza el de catálogo (amarillo).</span></div>' +
      '<div class="card-b flush tabla-wrap"><table class="t"><thead><tr><th class="idx">#</th><th>Fabricante</th><th>Modelo / descripción</th><th>TAG</th><th>Nivel / zona</th>' +
      '<th class="num">Cant.</th><th class="num">I espera unit. (mA)</th><th class="num">I espera total (A)</th><th class="num">I alarma unit. (mA)</th><th class="num">I alarma total (A)</th><th>Observación</th><th></th><th></th></tr></thead><tbody>');
    eq.filas.forEach(function (f, i) { h.push(filaHTML(ref, f, i)); });
    if (!eq.filas.length) h.push('<tr><td colspan="13" class="vacio">Sin dispositivos. Use «+ Fila» para comenzar.</td></tr>');
    h.push('</tbody><tfoot><tr><td colspan="7" style="text-align:right">TOTALES' + (esF ? ' (incluye consumo propio de la fuente)' : '') + ':</td>' +
      '<td class="num" data-out="tot-ie"></td><td></td><td class="num" data-out="tot-ia"></td><td colspan="3"></td></tr></tfoot></table></div>' +
      '<div class="card-b" style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--line)">' +
      '<button class="btn btn-primary btn-sm" data-act="fila-add" data-n="1">+ Fila</button><button class="btn btn-sm" data-act="fila-add" data-n="5">+ 5 filas</button>' +
      '<button class="btn btn-sm" data-act="filas-limpiar">Quitar filas vacías</button></div>' +
      '<datalist id="dl-niveles">' + P.niveles.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></section>');

    // Cálculo de batería
    h.push('<div class="grid-2col"><section class="card"><div class="card-h"><h3>Cálculo de capacidad de batería</h3><span class="nota">NFPA 72:2022 §10.6.7 / UL 864</span></div>' +
      '<div class="card-b" data-out="bateria"></div></section><div>');
    if (esF) h.push('<section class="card"><div class="card-h"><h3>Verificación de capacidad de la fuente</h3></div><div class="card-b" data-out="verif"></div></section>');
    h.push('<div class="ayuda"><b>Configuración:</b> 2 baterías de 12 V en serie = 24 VDC. Verifique dimensiones contra el gabinete y la capacidad máxima del cargador ' +
      (esF ? 'de la fuente' : 'del panel') + ' según ficha. La selección toma la capacidad estándar inmediata superior del catálogo de baterías.</div></div></div>');
    vista.innerHTML = h.join('');

    S.pintor = function () {
      var r = esF ? Calc.fuente(S.cx, eq, P) : Calc.panel(S.cx, eq, P);
      eq.filas.forEach(function (f, i) {
        var x = r.filas[i];
        out('tag:' + f.id, esc(x.tag));
        out('desc:' + f.id, esc(x.descripcion));
        out('ie:' + f.id, x.iEspT === null ? '' : fmt(x.iEspT, 4));
        out('ia:' + f.id, x.iAlmT === null ? '' : fmt(x.iAlmT, 4));
        out('av:' + f.id, x.aviso ? '<span class="aviso ' + x.nivel + '" title="' + esc(x.aviso) + '">' + (x.nivel === 'error' ? '❌ ' : '⚠ ') + esc(x.aviso) + '</span>' : '');
        var tr = vista.querySelector('tr[data-fila="' + f.id + '"]');
        if (tr) {
          tr.classList.toggle('aviso-error', x.nivel === 'error');
          tr.querySelectorAll('[data-k="iEsp"],[data-k="iAlm"]').forEach(function (inp) { inp.classList.toggle('editado', inp.value.trim() !== ''); });
        }
      });
      out('tot-ie', fmt(r.iEsp, 4));
      out('tot-ia', fmt(r.iAlm, 4));
      out('bateria', bloqueBateria(r.bat, r.errores));
      if (esF) {
        out('verif', '<div class="calc-lista">' +
          '<div>I total en alarma (A)</div><div class="v">' + fmt(r.iAlm, 3) + '</div><div class="u">A</div>' +
          '<div>I máx. permitida = 80 % × I máx</div><div class="v">' + fmt(r.iPermitida, 3) + '</div><div class="u">A</div>' +
          '<div>Verificación de corriente</div><div class="v" style="grid-column: span 2">' + badge(r.verificacion) + '</div></div>');
      }
      renderTabs();
    };
  }

  function filaHTML(ref, f, i) {
    var d = S.cx.disp[f.disp];
    var b = function (k, t) { return 'data-o="fila" data-eq="' + esc(ref) + '" data-id="' + esc(f.id) + '" data-k="' + k + '"' + (t ? ' data-t="' + t + '"' : ''); };
    return '<tr data-fila="' + esc(f.id) + '"><td class="idx">' + (i + 1) + '</td>' +
      '<td><select class="in w-sm" ' + b('fab') + ' data-re="vista">' + optsFabricantes(f.fab) + '</select></td>' +
      '<td><select class="in w-xl" ' + b('disp') + ' data-re="vista">' + optsModelo(f.fab, f.disp) + '</select></td>' +
      '<td class="calc" data-out="tag:' + f.id + '"></td>' +
      '<td><input class="in w-sm" list="dl-niveles" ' + b('zona') + ' value="' + esc(f.zona) + '"></td>' +
      '<td><input class="in w-xs" type="number" min="0" step="1" ' + b('cant', 'num') + ' value="' + fmtN(f.cant) + '"></td>' +
      '<td><input class="in w-xs" type="number" step="any" ' + b('iEsp', 'num') + ' value="' + fmtN(f.iEsp) + '" placeholder="' + (d ? fmtN(d.iEspera) : '') + '"></td>' +
      '<td class="calc num" data-out="ie:' + f.id + '"></td>' +
      '<td><input class="in w-xs" type="number" step="any" ' + b('iAlm', 'num') + ' value="' + fmtN(f.iAlm) + '" placeholder="' + (d ? fmtN(d.iAlarma) : '') + '"></td>' +
      '<td class="calc num" data-out="ia:' + f.id + '"></td>' +
      '<td><input class="in w-md" ' + b('obs') + ' value="' + esc(f.obs) + '"></td>' +
      '<td data-out="av:' + f.id + '"></td>' +
      '<td style="white-space:nowrap"><button class="btn-icon" title="Duplicar fila" data-act="fila-dup" data-id="' + esc(f.id) + '">⧉</button>' +
      '<button class="btn-icon del" title="Eliminar fila" data-act="fila-del" data-id="' + esc(f.id) + '">✕</button></td></tr>';
  }

  function bloqueBateria(b, errores) {
    var fila = function (l, v, u, f) {
      return '<div>' + l + '</div><div class="v">' + v + '</div><div class="u">' + (u || '') + '</div>' + (f ? '<div class="f">' + f + '</div>' : '');
    };
    var h = '<div class="calc-lista">' +
      fila('Corriente total en espera', fmt(b.iEsp, 4), 'A') +
      fila('Tiempo de espera', fmt(b.tEsp, 1), 'h') +
      fila('Capacidad en espera', fmt(b.ahEsp, 3), 'Ah', 'Ah_espera = I_espera × t_espera') +
      fila('Corriente total en alarma', fmt(b.iAlm, 4), 'A') +
      fila('Tiempo de alarma', fmt(b.tAlmMin / 60, 4), 'h', fmt(b.tAlmMin, 0) + ' min ÷ 60') +
      fila('Capacidad en alarma', fmt(b.ahAlm, 3), 'Ah', 'Ah_alarma = I_alarma × t_alarma') +
      fila('Capacidad calculada', fmt(b.ahCalc, 3), 'Ah') +
      fila('Factor de seguridad', fmt(b.fs * 100, 0), '%') +
      fila('<b>Capacidad mínima requerida</b>', '<b>' + fmt(b.ahReq, 3) + '</b>', 'Ah', 'Ah_req = (Ah_espera + Ah_alarma) × (1 + FS)') +
      '</div>';
    if (b.bateria) {
      h += '<div class="resultado' + (errores ? ' error' : '') + '"><div class="grande">' + fmt(b.ah, 1) + ' <small>Ah</small></div>' +
        '<div class="det">Batería seleccionada (estándar) · <b>2 × 12 V</b><br>Referencia Simplex / Notifier-PS: <b>' + esc(b.referencia) + '</b>' +
        (b.bateria.obs ? '<br>' + esc(b.bateria.obs) : '') +
        (errores ? '<br><span class="aviso error">❌ Hay ' + errores + ' fila(s) con error en la tabla de dispositivos.</span>' : '') + '</div></div>';
    } else {
      h += '<div class="resultado error"><div class="grande">—</div><div class="det"><b>REVISAR:</b> la capacidad requerida excede la mayor batería del catálogo. ' +
        'Divida la carga (fuente/transponder adicional) o use un cargador externo listado.</div></div>';
    }
    return h;
  }

  /* ======================= vista: Caída de tensión ======================= */
  function vistaCaida() {
    var P = S.proy, cd = P.caida, pp = P.params;
    var Bp = function (k, t) { return { o: 'params', k: k, t: t }; };
    var h = [];
    h.push('<div class="encabezado"><div><h2>Caída de tensión en lazos</h2><div class="sub">NAC / SLC / 24 VDC — método de carga concentrada al final del lazo (conservador, NFPA 72 Anexo A).</div></div>' +
      '<div class="acciones"><button class="btn" data-act="ir" data-tab="memoria">Ver memoria de cálculo →</button></div></div>');
    h.push('<div class="grid-2col"><section class="card"><div class="card-h"><h3>Parámetros globales</h3><span class="nota">Compartidos con la pestaña Proyecto</span></div><div class="card-b"><div class="grid c2">' +
      campo('Tensión nominal (V)', Bp('vNominal', 'num'), pp.vNominal) +
      campo('Fuente a fin de vida de batería (%)', Bp('pctFinVida', 'pct'), pp.pctFinVida, { ayuda: '<span data-out="vfuente"></span> — criterio UL 864' }) +
      campo('Tensión mínima de dispositivo (V)', Bp('vMin', 'num'), pp.vMin, { ayuda: 'Regulados UL 1971/464: típico 16–33 V' }) +
      campo('I máx. por circuito NAC (A)', Bp('iMaxNac', 'num'), pp.iMaxNac, { ayuda: 'Ej.: NAC de 3 A × 80 % = 2.4 A' }) +
      '</div></div></section>' +
      '<div class="ayuda"><b>Método:</b> I<sub>circuito</sub> = Σ(cantidad × mA unitario de ficha) + OTROS. R<sub>lazo</sub> = 2 × L × R(Ω/km)/1000. ' +
      'V<sub>disp</sub> = V<sub>fuente</sub> − I × R<sub>lazo</sub>. Aceptación: V<sub>disp</sub> ≥ V<sub>mín</sub> e I ≤ I máx. NAC.<br>' +
      'Para lazos SLC o 24 VDC digite la corriente total del lazo en la columna <b>OTROS (mA)</b>.</div></div>');

    h.push('<section class="card"><div class="card-h"><h3>Corrientes unitarias por categoría</h3><span class="nota">Seleccione el modelo de ficha de cada columna; el mA de alarma se carga solo</span></div><div class="card-b flush tabla-wrap"><table class="t"><thead><tr><th></th>' +
      Calc.CATEGORIAS.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody><tr><td class="muted">Modelo</td>' +
      Calc.CATEGORIAS.map(function (c, i) {
        return '<td><select class="in w-lg" data-o="caida" data-k="categorias.' + i + '">' + optsDispTodos(cd.categorias[i]) + '</select></td>';
      }).join('') + '</tr><tr><td class="muted">I alarma unit. (mA)</td>' +
      Calc.CATEGORIAS.map(function (c, i) { return '<td class="calc sel-cat" data-out="cu:' + i + '"></td>'; }).join('') + '</tr></tbody></table></div></section>');

    h.push('<section class="card"><div class="card-h"><h3>Circuitos</h3><span class="nota">Una sola tabla para todo el proyecto: use FUENTE / PANEL para identificar de dónde sale cada lazo</span></div>' +
      '<div class="card-b flush tabla-wrap"><table class="t"><thead><tr><th class="idx">#</th><th>Fuente / panel</th><th>Circuito</th><th>Nivel / descripción</th>' +
      [1, 2, 3, 4].map(function (n) { return '<th class="num">Cat. ' + n + '</th>'; }).join('') + '<th class="num">Base aud.</th><th class="num">Otros (mA)</th>' +
      '<th class="num">I circuito (mA)</th><th>Cable</th><th class="num">R (Ω/km)</th><th class="num">Long. ida (m)</th><th class="num">R lazo (Ω)</th>' +
      '<th class="num">Caída (V)</th><th class="num">V disp. (V)</th><th class="num">% caída</th><th>Estado</th><th>Comentario</th><th></th></tr></thead><tbody>');
    cd.circuitos.forEach(function (c, i) {
      var b = function (k, t) { return 'data-o="circ" data-id="' + esc(c.id) + '" data-k="' + k + '"' + (t ? ' data-t="' + t + '" type="number" step="any"' : ''); };
      h.push('<tr><td class="idx">' + (i + 1) + '</td>' +
        '<td><select class="in w-sm" ' + b('fuente') + '>' + optsEquipos(c.fuente) + '</select></td>' +
        '<td><input class="in w-sm" ' + b('circuito') + ' value="' + esc(c.circuito) + '" placeholder="NAC 1"></td>' +
        '<td><input class="in w-md" ' + b('desc') + ' value="' + esc(c.desc) + '"></td>' +
        [0, 1, 2, 3, 4].map(function (k) { return '<td><input class="in w-xs" min="0" ' + b('q.' + k, 'num') + ' value="' + fmtN((c.q || [])[k]) + '"></td>'; }).join('') +
        '<td><input class="in w-xs" min="0" ' + b('otros', 'num') + ' value="' + fmtN(c.otros) + '"></td>' +
        '<td class="calc num" data-out="i:' + c.id + '"></td>' +
        '<td><select class="in w-md" ' + b('cable') + '>' + optsCables(c.cable) + '</select></td>' +
        '<td class="calc num" data-out="r:' + c.id + '"></td>' +
        '<td><input class="in w-xs" min="0" ' + b('long', 'num') + ' value="' + fmtN(c.long) + '"></td>' +
        '<td class="calc num" data-out="rl:' + c.id + '"></td><td class="calc num" data-out="dv:' + c.id + '"></td>' +
        '<td class="calc num" data-out="vd:' + c.id + '"></td><td class="calc num" data-out="pc:' + c.id + '"></td>' +
        '<td data-out="es:' + c.id + '"></td><td class="desc" data-out="co:' + c.id + '"></td>' +
        '<td style="white-space:nowrap"><button class="btn-icon" title="Duplicar" data-act="circ-dup" data-id="' + esc(c.id) + '">⧉</button>' +
        '<button class="btn-icon del" title="Eliminar" data-act="circ-del" data-id="' + esc(c.id) + '">✕</button></td></tr>');
    });
    if (!cd.circuitos.length) h.push('<tr><td colspan="23" class="vacio">Sin circuitos. Use «+ Circuito» para comenzar.</td></tr>');
    h.push('</tbody><tfoot><tr><td colspan="10" style="text-align:right">TOTAL (A):</td><td class="num" data-out="tot"></td><td colspan="12" class="muted" style="font-weight:400">Verificar contra la capacidad total del panel / fuente</td></tr></tfoot></table></div>' +
      '<div class="card-b" style="display:flex; gap:8px; border-top:1px solid var(--line)"><button class="btn btn-primary btn-sm" data-act="circ-add" data-n="1">+ Circuito</button><button class="btn btn-sm" data-act="circ-add" data-n="5">+ 5 circuitos</button></div></section>');
    vista.innerHTML = h.join('');

    S.pintor = function () {
      var R = Calc.caida(S.cx, P);
      out('vfuente', '= ' + fmt(R.params.vFuente, 2) + ' V');
      R.unit.forEach(function (u, i) { out('cu:' + i, fmt(u, 1)); });
      cd.circuitos.forEach(function (c, i) {
        var r = R.circuitos[i];
        out('i:' + c.id, r.iMa === null ? '' : fmt(r.iMa, 1));
        out('r:' + c.id, r.rKm === null ? '' : fmt(r.rKm, 2));
        out('rl:' + c.id, r.rLazo === null ? '' : fmt(r.rLazo, 3));
        out('dv:' + c.id, r.caida === null ? '' : fmt(r.caida, 2));
        out('vd:' + c.id, r.vDisp === null ? '' : fmt(r.vDisp, 2));
        out('pc:' + c.id, r.pct === null ? '' : fmt(r.pct * 100, 1) + ' %');
        out('es:' + c.id, r.estado ? badge(r.estado) : '');
        out('co:' + c.id, esc(r.comentario));
      });
      out('tot', fmt(R.totalA, 3));
      renderTabs();
    };
  }

  /* ======================= vista: Memoria de cálculo ======================= */
  function vistaMemoria() {
    var P = S.proy, pp = P.params;
    var R = Calc.proyecto(S.cx, P);
    var vF = R.caida.params.vFuente;
    var detalle = S.memDetalle !== false;
    var h = [];
    h.push('<div class="encabezado no-print"><div><h2>Memoria de cálculo</h2><div class="sub">Resumen de todo el proyecto. Use «Imprimir / PDF» para emitirla.</div></div>' +
      '<div class="acciones"><label style="display:flex; align-items:center; gap:6px; font-size:13px"><input type="checkbox" id="chkDetalle"' + (detalle ? ' checked' : '') + '> Incluir detalle por equipo</label>' +
      '<button class="btn btn-primary" data-act="imprimir">Imprimir / PDF</button></div></div>');

    h.push('<article class="memoria">');
    h.push('<h1>MEMORIA DE CÁLCULO — SISTEMA DE DETECCIÓN Y ALARMA CONTRA INCENDIO</h1>' +
      '<div class="m-sub">Baterías secundarias, fuentes auxiliares y caída de tensión · NFPA 72:2022</div>');
    var fi = function (k, v) { return '<div>' + k + '</div><div>' + esc(v || '—') + '</div>'; };
    h.push('<div class="ficha">' + fi('PROYECTO', P.nombre) + fi('N.º PROYECTO', P.numero) + fi('CLIENTE', P.cliente) + fi('UBICACIÓN', P.ubicacion) +
      fi('ELABORÓ', P.elaboro) + fi('REVISÓ', P.reviso) + fi('EMPRESA', P.empresa) + fi('FECHA / REV.', (P.fecha || '') + ' · Rev. ' + (P.revision || '0')) +
      fi('NORMATIVA', P.normativa) + fi('PANELES', R.paneles.map(function (x) { return x.p.tag; }).join(', ')) + '</div>');

    h.push('<h2>1. Criterios normativos</h2><ul>' +
      '<li>NFPA 72:2022 §10.6.7.2.1(1): la fuente secundaria debe operar el sistema 24 horas en espera y luego 5 minutos en alarma.</li>' +
      '<li>NFPA 72:2022 §10.6.7.2.1(2): sistemas de voceo/EVACS: 24 horas en espera y 15 minutos a carga máxima conectada.</li>' +
      '<li>Parámetros usados en este proyecto: espera <b>' + fmt(pp.tEspera, 0) + ' h</b>, alarma <b>' + fmt(pp.tAlarma, 0) + ' min</b>, factor de seguridad <b>' + fmt(pp.fs * 100, 0) + ' %</b> (salvo indicación por equipo).</li>' +
      '<li>Factor de seguridad sobre la capacidad calculada: requisito de fichas de fabricante (Simplex, Notifier, Siemens) por envejecimiento de baterías.</li>' +
      '<li>Caída de tensión: todo dispositivo de notificación debe operar dentro de su rango listado (UL 1971/UL 464, típico 16–33 V regulado). El cálculo usa la tensión de fuente degradada a fin de vida de batería: <b>' +
      fmt(vF, 2) + ' V</b> (' + fmt(pp.pctFinVida * 100, 0) + ' % de ' + fmt(pp.vNominal, 0) + ' V, criterio UL 864).</li>' +
      '<li>Cableado y supervisión según NFPA 72 Cap. 12 y NEC Art. 760 (FPL/FPLR/FPLP).</li></ul>');

    h.push('<h2>2. Metodología de cálculo de baterías</h2><ul>' +
      '<li><span class="formula">Ah_espera = I_espera (A) × t_espera (h)</span> · <span class="formula">Ah_alarma = I_alarma (A) × t_alarma (h)</span></li>' +
      '<li><span class="formula">Ah_requerido = (Ah_espera + Ah_alarma) × (1 + FS)</span></li>' +
      '<li>Corrientes unitarias tomadas del catálogo de dispositivos (fichas de fabricante); verificar contra la revisión vigente del modelo/candela/tap de planos.</li>' +
      '<li>Selección automática: capacidad estándar inmediata superior del catálogo de baterías (2 × 12 V en serie = 24 VDC).</li>' +
      '<li>Cada panel/transponder calcula su propia batería: las baterías del transponder respaldan solo su carga local.</li></ul>');

    h.push('<h2>3. Metodología de caída de tensión (carga concentrada)</h2><ul>' +
      '<li><span class="formula">R_lazo = 2 × L × r</span>, con L = longitud de ida (m) y r = resistencia por conductor (Ω/m) de ficha del fabricante.</li>' +
      '<li><span class="formula">V_dispositivo = V_fuente − I_circuito × R_lazo</span>, con V_fuente = ' + fmt(vF, 2) + ' V.</li>' +
      '<li>Aceptación: V_dispositivo ≥ ' + fmt(pp.vMin, 1) + ' V e I_circuito ≤ ' + fmt(pp.iMaxNac, 2) + ' A (80 % de la corriente máxima del NAC/fuente).</li>' +
      '<li>El método de carga concentrada (toda la carga al final del circuito) es el más conservador aceptado por NFPA 72 (Anexo A).</li></ul>');

    // Resultados
    var errCaida = R.caida.errores;
    var revisar = R.paneles.filter(function (x) { return x.r.estado !== 'OK'; }).length + R.fuentes.filter(function (x) { return x.r.estado !== 'OK'; }).length;
    h.push('<h2>4. Resultados</h2><div class="kpis">' +
      '<div class="kpi"><div class="k">Ah requerido total (paneles)</div><div class="v">' + fmt(R.totalPaneles.ahReq, 2) + ' <small>Ah</small></div></div>' +
      '<div class="kpi"><div class="k">Paneles / transponders</div><div class="v">' + R.paneles.length + '</div></div>' +
      '<div class="kpi"><div class="k">Fuentes auxiliares</div><div class="v">' + R.fuentes.length + '</div></div>' +
      '<div class="kpi ' + (revisar ? 'error' : 'ok') + '"><div class="k">Equipos por revisar</div><div class="v">' + revisar + '</div></div>' +
      '<div class="kpi ' + (errCaida ? 'error' : 'ok') + '"><div class="k">Circuitos con error de caída</div><div class="v">' + errCaida + '</div></div></div>');

    h.push('<h3>4.1 Resumen de baterías por panel / transponder</h3>');
    if (!R.paneles.length) h.push('<p class="muted">Sin paneles.</p>');
    else {
      h.push('<div class="tabla-wrap"><table class="t"><thead><tr><th>TAG</th><th>Ubicación</th><th class="num">I espera (A)</th><th class="num">I alarma (A)</th><th class="num">t esp. (h)</th><th class="num">t alm. (min)</th>' +
        '<th class="num">Ah espera</th><th class="num">Ah alarma</th><th class="num">Ah requerido</th><th class="num">Batería (Ah)</th><th>Referencia</th><th>Estado</th></tr></thead><tbody>');
      R.paneles.forEach(function (x) {
        var b = x.r.bat;
        h.push('<tr><td><b>' + esc(x.p.tag) + '</b></td><td>' + esc(x.p.nivel) + '</td><td class="num">' + fmt(b.iEsp, 3) + '</td><td class="num">' + fmt(b.iAlm, 3) + '</td>' +
          '<td class="num">' + fmt(b.tEsp, 0) + '</td><td class="num">' + fmt(b.tAlmMin, 0) + '</td><td class="num">' + fmt(b.ahEsp, 2) + '</td><td class="num">' + fmt(b.ahAlm, 2) + '</td>' +
          '<td class="num"><b>' + fmt(b.ahReq, 2) + '</b></td><td class="num"><b>' + (b.ah !== null ? fmt(b.ah, 1) : '—') + '</b></td><td>' + esc(b.referencia) + '</td><td>' + badge(x.r.estado) + '</td></tr>');
      });
      h.push('</tbody><tfoot><tr><td colspan="2">TOTAL SISTEMA</td><td class="num">' + fmt(R.totalPaneles.iEsp, 3) + '</td><td class="num">' + fmt(R.totalPaneles.iAlm, 3) + '</td><td colspan="4"></td>' +
        '<td class="num">' + fmt(R.totalPaneles.ahReq, 2) + '</td><td colspan="3"></td></tr></tfoot></table></div>');
    }

    h.push('<h3>4.2 Fuentes de poder auxiliares</h3>');
    if (!R.fuentes.length) h.push('<p style="color:var(--ink-3)">El proyecto no incluye fuentes auxiliares.</p>');
    else {
      h.push('<div class="tabla-wrap"><table class="t"><thead><tr><th>TAG</th><th>Ubicación</th><th>Alimentada desde</th><th class="num">I espera (A)</th><th class="num">I alarma (A)</th><th class="num">80 % I máx (A)</th><th>Verificación</th>' +
        '<th class="num">Ah requerido</th><th class="num">Batería (Ah)</th><th>Referencia</th><th>Estado</th></tr></thead><tbody>');
      R.fuentes.forEach(function (x) {
        var b = x.r.bat;
        h.push('<tr><td><b>' + esc(x.f.tag) + '</b></td><td>' + esc(x.f.nivel) + '</td><td>' + esc(nombreEquipo(x.f.panelId)) + '</td><td class="num">' + fmt(x.r.iEsp, 3) + '</td><td class="num">' + fmt(x.r.iAlm, 3) + '</td>' +
          '<td class="num">' + fmt(x.r.iPermitida, 2) + '</td><td>' + badge(x.r.verificacion) + '</td><td class="num"><b>' + fmt(b.ahReq, 2) + '</b></td><td class="num"><b>' + (b.ah !== null ? fmt(b.ah, 1) : '—') + '</b></td>' +
          '<td>' + esc(b.referencia) + '</td><td>' + badge(x.r.estado) + '</td></tr>');
      });
      h.push('</tbody></table></div>');
    }

    h.push('<h3>4.3 Caída de tensión</h3>');
    var cds = P.caida.circuitos;
    if (!cds.length) h.push('<p style="color:var(--ink-3)">Sin circuitos registrados.</p>');
    else {
      h.push('<p style="font-size:12.5px; color:var(--ink-2)">Corrientes unitarias: ' + Calc.CATEGORIAS.map(function (c, i) {
        var d = S.cx.disp[P.caida.categorias[i]];
        return '<b>' + esc(c) + '</b> = ' + (d ? esc(d.tag + ' ' + d.modelo) + ' (' + fmt(R.caida.unit[i], 0) + ' mA)' : '—');
      }).join(' · ') + '</p>');
      h.push('<div class="tabla-wrap"><table class="t"><thead><tr><th>Fuente</th><th>Circuito</th><th>Descripción</th><th class="num">I (mA)</th><th>Cable</th><th class="num">L (m)</th><th class="num">R lazo (Ω)</th>' +
        '<th class="num">Caída (V)</th><th class="num">V disp. (V)</th><th class="num">%</th><th>Estado</th><th>Comentario</th></tr></thead><tbody>');
      cds.forEach(function (c, i) {
        var r = R.caida.circuitos[i], cab = S.cx.cables[c.cable];
        h.push('<tr><td>' + esc(nombreEquipo(c.fuente)) + '</td><td>' + esc(c.circuito) + '</td><td>' + esc(c.desc) + '</td><td class="num">' + fmt(r.iMa, 0) + '</td>' +
          '<td>' + (cab ? esc(cab.modelo + ' ' + cab.awg + ' AWG') : '—') + '</td><td class="num">' + fmt(Calc.num(c.long), 0) + '</td><td class="num">' + fmt(r.rLazo, 2) + '</td>' +
          '<td class="num">' + fmt(r.caida, 2) + '</td><td class="num"><b>' + fmt(r.vDisp, 2) + '</b></td><td class="num">' + (r.pct === null ? '—' : fmt(r.pct * 100, 1)) + '</td><td>' + badge(r.estado) + '</td><td class="desc">' + esc(r.comentario) + '</td></tr>');
      });
      h.push('</tbody><tfoot><tr><td colspan="3">TOTAL</td><td class="num">' + fmt(R.caida.totalA * 1000, 0) + '</td><td colspan="8"></td></tr></tfoot></table></div>');
    }

    // Resumen de dispositivos
    var RD = R.dispositivos;
    h.push('<h3>4.4 Resumen de dispositivos por equipo</h3>');
    if (!RD.filas.length) h.push('<p style="color:var(--ink-3)">Sin dispositivos registrados.</p>');
    else {
      h.push('<div class="tabla-wrap"><table class="t"><thead><tr><th>Circuito</th><th>TAG</th><th>Modelo</th><th>Descripción</th>' +
        RD.columnas.map(function (c) { return '<th class="num">' + esc(c.tag) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>');
      RD.filas.forEach(function (f) {
        h.push('<tr><td class="muted">' + esc(f.disp.circuito) + '</td><td><b>' + esc(f.disp.tag) + '</b></td><td>' + esc(f.disp.modelo) + '</td><td class="desc">' + esc(f.disp.descripcion) + '</td>' +
          f.cant.map(function (n) { return '<td class="num">' + (n || '') + '</td>'; }).join('') + '<td class="num"><b>' + f.total + '</b></td></tr>');
      });
      h.push('</tbody></table></div>');
    }

    // Observaciones automáticas
    var obs = [];
    R.paneles.forEach(function (x) {
      if (x.r.bat.excede) obs.push('<b>' + esc(x.p.tag) + '</b>: la capacidad requerida (' + fmt(x.r.bat.ahReq, 1) + ' Ah) excede la mayor batería del catálogo.');
      if (x.r.errores) obs.push('<b>' + esc(x.p.tag) + '</b>: ' + x.r.errores + ' fila(s) de dispositivos con error.');
      if (x.r.bat.bateria && x.r.bat.bateria.obs) obs.push('<b>' + esc(x.p.tag) + '</b>: batería ' + fmt(x.r.bat.ah, 1) + ' Ah — ' + esc(x.r.bat.bateria.obs) + '.');
    });
    R.fuentes.forEach(function (x) {
      if (x.r.okCorriente === false) obs.push('<b>' + esc(x.f.tag) + '</b>: la corriente de alarma excede el 80 % de la capacidad de la fuente.');
      if (x.r.bat.excede) obs.push('<b>' + esc(x.f.tag) + '</b>: la capacidad requerida excede la mayor batería del catálogo.');
      if (x.r.errores) obs.push('<b>' + esc(x.f.tag) + '</b>: ' + x.r.errores + ' fila(s) de dispositivos con error.');
    });
    R.caida.circuitos.forEach(function (r, i) {
      var c = cds[i];
      if (r.estado && r.estado !== 'OK') obs.push('<b>' + esc(nombreEquipo(c.fuente) + ' ' + (c.circuito || '#' + (i + 1))) + '</b>: ' + esc(r.estado) + (r.comentario ? ' — ' + esc(r.comentario) : '') + '.');
    });
    h.push('<h3>4.5 Observaciones</h3>' + (obs.length ? '<ul>' + obs.map(function (o) { return '<li>' + o + '</li>'; }).join('') + '</ul>' : '<p>Sin observaciones: todos los equipos y circuitos cumplen.</p>'));

    // Anexo detalle
    if (detalle && (R.paneles.length || R.fuentes.length)) {
      h.push('<h2>Anexo A. Detalle de cargas por equipo</h2>');
      R.paneles.map(function (x) { return { e: x.p, r: x.r, f: false }; }).concat(R.fuentes.map(function (x) { return { e: x.f, r: x.r, f: true }; })).forEach(function (x) {
        h.push('<h3>' + esc(x.e.tag) + (x.e.nivel ? ' · ' + esc(x.e.nivel) : '') + (x.f ? ' (fuente auxiliar)' : '') + '</h3>');
        h.push('<div class="tabla-wrap"><table class="t"><thead><tr><th>TAG</th><th>Modelo</th><th>Descripción</th><th>Nivel / zona</th><th class="num">Cant.</th><th class="num">I esp. unit. (mA)</th><th class="num">I esp. total (A)</th><th class="num">I alm. unit. (mA)</th><th class="num">I alm. total (A)</th></tr></thead><tbody>');
        x.e.filas.forEach(function (f, i) {
          var fr = x.r.filas[i], d = S.cx.disp[f.disp];
          if (!f.disp && Calc.num(f.cant) === null) return;
          h.push('<tr><td>' + esc(fr.tag) + '</td><td>' + esc(d ? d.modelo : '') + '</td><td class="desc">' + esc(fr.descripcion) + '</td><td>' + esc(f.zona) + '</td><td class="num">' + fmt(Calc.num(f.cant), 0) + '</td>' +
            '<td class="num">' + fmt(fr.iEspU, 2) + (Calc.num(f.iEsp) !== null ? '*' : '') + '</td><td class="num">' + fmt(fr.iEspT, 4) + '</td><td class="num">' + fmt(fr.iAlmU, 2) + (Calc.num(f.iAlm) !== null ? '*' : '') + '</td><td class="num">' + fmt(fr.iAlmT, 4) + '</td></tr>');
        });
        var b = x.r.bat;
        h.push('</tbody><tfoot><tr><td colspan="6">TOTALES' + (x.f ? ' (incl. consumo propio ' + fmt(Calc.num(x.e.iPropia) || 0, 3) + ' A)' : '') + '</td><td class="num">' + fmt(x.r.iEsp, 4) + '</td><td></td><td class="num">' + fmt(x.r.iAlm, 4) + '</td></tr></tfoot></table></div>');
        h.push('<p style="font-size:12.5px">Ah = ' + fmt(b.iEsp, 4) + ' A × ' + fmt(b.tEsp, 0) + ' h + ' + fmt(b.iAlm, 4) + ' A × ' + fmt(b.tAlmMin, 0) + '/60 h = ' + fmt(b.ahCalc, 3) + ' Ah; × (1 + ' + fmt(b.fs * 100, 0) + ' %) = <b>' +
          fmt(b.ahReq, 3) + ' Ah</b> → batería seleccionada <b>' + (b.ah !== null ? fmt(b.ah, 1) + ' Ah (' + esc(b.referencia) + ')' : 'EXCEDE CATÁLOGO') + '</b>.</p>');
      });
      h.push('<p style="font-size:11.5px; color:var(--ink-3)">* Corriente unitaria digitada manualmente (reemplaza el valor de catálogo).</p>');
    }

    h.push('<div class="nota-final"><b>NOTA:</b> Memoria de cálculo de ingeniería. Los valores de corriente de dispositivos y resistencia de cables provienen de fichas técnicas y deben verificarse contra la revisión vigente antes de construcción. ' +
      'Aprobación final: AHJ (Ingeniería de Bomberos de Costa Rica). Catálogo actualizado: ' + esc(S.cat.actualizado || '') + '.</div>');
    h.push('</article>');
    vista.innerHTML = h.join('');
  }

  /* ======================= vista: Administración ======================= */
  var COLS_ADMIN = {
    dispositivos: [
      { k: 'fabricante', l: 'Fabricante', tipo: 'fab' }, { k: 'modelo', l: 'Modelo / ref.', w: 'w-sm' }, { k: 'tag', l: 'TAG', w: 'w-sm' },
      { k: 'descripcion', l: 'Descripción', w: 'w-lg' }, { k: 'iEspera', l: 'I espera (mA)', t: 'num' }, { k: 'iAlarma', l: 'I alarma (mA)', t: 'num' },
      { k: 'circuito', l: 'Circuito', w: 'w-sm', list: 'dl-circuitos' }, { k: 'obs', l: 'Fuente / observación', w: 'w-lg' }
    ],
    cables: [
      { k: 'fabricante', l: 'Fabricante', w: 'w-sm' }, { k: 'modelo', l: 'Modelo', w: 'w-sm' }, { k: 'awg', l: 'AWG', t: 'num' }, { k: 'conductores', l: 'Cond.', t: 'num' },
      { k: 'pantalla', l: 'Pantalla', w: 'w-xs' }, { k: 'listado', l: 'Listado NEC/UL', w: 'w-sm' }, { k: 'rKm', l: 'R (Ω/km /cond.)', t: 'num' },
      { k: '_rm', l: 'R (Ω/m)', calc: function (x) { return fmt(Calc.num(x.rKm) / 1000, 5); } },
      { k: 'uso', l: 'Uso típico', w: 'w-md' }, { k: 'obs', l: 'Observación', w: 'w-lg' }
    ],
    baterias: [
      { k: 'ah', l: 'Capacidad (Ah)', t: 'num' }, { k: 'refSimplex', l: 'Ref. Simplex', w: 'w-sm' }, { k: 'refNotifier', l: 'Ref. Notifier / PS', w: 'w-md' },
      { k: 'refGenerica', l: 'Ref. genérica', w: 'w-sm' }, { k: 'obs', l: 'Observación', w: 'w-lg' }
    ],
    fabricantes: [{ k: 'nombre', l: 'Nombre del fabricante / marca', w: 'w-lg', re: 'all' }]
  };
  var SUBS = [
    { id: 'dispositivos', l: 'Dispositivos' }, { id: 'cables', l: 'Cables' }, { id: 'baterias', l: 'Baterías' },
    { id: 'fabricantes', l: 'Fabricantes / marcas' }
  ].concat(REMOTO ? [{ id: 'usuarios', l: 'Usuarios' }, { id: 'respaldo', l: 'Respaldo' }] : [{ id: 'respaldo', l: 'Respaldo y PIN' }]);

  function vistaAdmin() {
    var h = [];
    h.push('<div class="encabezado"><div><h2>Administración de catálogos</h2><div class="sub">Equivale a las hojas ocultas BD_DISPOSITIVOS, BD_CABLES y BD_BATERIAS del Excel. Los cambios aplican a todos los proyectos.</div></div></div>');
    h.push('<div class="alerta-admin">Modo administrador. Toda corriente y resistencia debe <b>verificarse contra la ficha vigente</b> del fabricante. ' +
      (REMOTO ? 'El catálogo se guarda en Supabase y lo comparten todos los usuarios.'
        : 'En esta fase el catálogo se guarda en este navegador; use «Respaldo» para exportarlo y compartirlo.') + '</div>');
    if (S.cat.sinSemilla) {
      h.push('<div class="alerta-admin" style="background:var(--err-bg); border-color:#f2b8b8; color:var(--err)"><b>La base de datos no tiene catálogo.</b> ' +
        'Se está mostrando el catálogo del Excel. <button class="btn btn-sm btn-primary" data-act="cat-semilla">Cargar catálogo base a Supabase</button></div>');
    }
    h.push('<div class="subtabs">' + SUBS.map(function (s) {
      var n = S.cat[s.id] ? ' (' + S.cat[s.id].length + ')' : '';
      return '<button class="subtab' + (S.adminSub === s.id ? ' activa' : '') + '" data-act="admin-sub" data-sub="' + s.id + '">' + s.l + n + '</button>';
    }).join('') + '</div>');

    var sub = S.adminSub;
    if (sub === 'respaldo') {
      h.push('<section class="card"><div class="card-h"><h3>Respaldo del catálogo</h3><span class="nota">Actualizado: ' + esc(S.cat.actualizado || '—') + '</span></div><div class="card-b" style="display:flex; gap:8px; flex-wrap:wrap">' +
        '<button class="btn" data-act="cat-exportar">Exportar catálogo (.json)</button>' +
        '<button class="btn" data-act="cat-importar">Importar catálogo (.json)</button>' +
        '<button class="btn btn-danger" data-act="cat-restablecer">Restablecer catálogo base (Excel)</button></div></section>' +
        (REMOTO ? '' : '<section class="card"><div class="card-h"><h3>PIN de administrador</h3></div><div class="card-b"><p style="margin-top:0; color:var(--ink-2)">El PIN solo protege la interfaz en este navegador. Con Supabase configurado se reemplaza por usuarios con rol «admin» y políticas RLS.</p>' +
        '<button class="btn" data-act="pin-cambiar">Cambiar PIN</button></div></section>'));
      vista.innerHTML = h.join('');
      return;
    }
    if (sub === 'usuarios') {
      h.push('<section class="card"><div class="card-h"><h3>Usuarios</h3><span class="nota">Se registran desde la pantalla de acceso. Los correos @sinergia.co.cr quedan activos; los demás, pendientes hasta que un admin los active.</span></div>' +
        '<div class="card-b flush tabla-wrap" data-out="usuarios"><div class="vacio">Cargando…</div></div></section>');
      vista.innerHTML = h.join('');
      Auth.listarUsuarios().then(function (l) {
        var yo = (Auth.usuario() || {}).id;
        out('usuarios', '<table class="t"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Registrado</th></tr></thead><tbody>' +
          l.map(function (u) {
            var dis = u.user_id === yo ? ' disabled title="No puede cambiar su propio rol"' : '';
            return '<tr><td>' + esc(u.nombre) + (u.user_id === yo ? ' <span class="badge pend">usted</span>' : '') + '</td><td>' + esc(u.email) + '</td>' +
              '<td><select class="in w-sm" data-usuario="' + esc(u.user_id) + '" data-campo="rol"' + dis + '>' + opts([{ v: 'usuario', l: 'Usuario' }, { v: 'admin', l: 'Administrador' }], u.rol) + '</select></td>' +
              '<td><input type="checkbox" data-usuario="' + esc(u.user_id) + '" data-campo="activo"' + (u.activo ? ' checked' : '') + dis + '></td>' +
              '<td class="muted">' + esc(new Date(u.creado_en).toLocaleDateString()) + '</td></tr>';
          }).join('') + '</tbody></table>');
      }).catch(function (e) { out('usuarios', '<div class="vacio">⚠ ' + esc(msgError(e)) + '</div>'); });
      return;
    }

    var cols = COLS_ADMIN[sub];
    var lista = S.cat[sub];
    if (sub === 'baterias') lista.sort(function (a, b) { return (Calc.num(a.ah) || 0) - (Calc.num(b.ah) || 0); });
    h.push('<section class="card"><div class="card-h">');
    if (sub === 'dispositivos') {
      h.push('<div style="display:flex; gap:8px; flex-wrap:wrap"><select class="in" id="fFab" style="width:auto"><option value="">Todos los fabricantes</option>' +
        S.cat.fabricantes.map(function (f) { return '<option value="' + esc(f.id) + '"' + (S.adminFiltro.fab === f.id ? ' selected' : '') + '>' + esc(f.nombre) + '</option>'; }).join('') + '</select>' +
        '<input class="in" id="fQ" placeholder="Buscar modelo, TAG o descripción…" style="width:260px" value="' + esc(S.adminFiltro.q) + '"></div>');
    } else {
      h.push('<h3>' + esc(SUBS.filter(function (s) { return s.id === sub; })[0].l) + '</h3>');
    }
    if (sub === 'baterias') h.push('<span class="nota">Se ordenan de menor a mayor: la selección toma la capacidad inmediata superior</span>');
    h.push('<button class="btn btn-primary btn-sm" data-act="cat-add">+ Agregar</button></div><div class="card-b flush tabla-wrap"><table class="t"><thead><tr>' +
      cols.map(function (c) { return '<th' + (c.t ? ' class="num"' : '') + '>' + esc(c.l) + '</th>'; }).join('') + (sub === 'fabricantes' ? '<th class="num">Dispositivos</th>' : '') + '<th></th></tr></thead><tbody>');
    lista.forEach(function (x) {
      h.push('<tr data-row="' + esc(x.id) + '" data-fab="' + esc(x.fabricante || '') + '">');
      cols.forEach(function (c) {
        if (c.calc) { h.push('<td class="calc num" data-out="calc:' + x.id + ':' + c.k + '">' + c.calc(x) + '</td>'); return; }
        var a = 'data-o="cat" data-col="' + sub + '" data-id="' + esc(x.id) + '" data-k="' + c.k + '"' + (c.re ? ' data-re="' + c.re + '"' : '');
        if (c.tipo === 'fab') h.push('<td><select class="in w-sm" ' + a + '>' + optsFabricantes(x.fabricante) + '</select></td>');
        else if (c.t) h.push('<td><input class="in w-xs" type="number" step="any" data-t="num" ' + a + ' value="' + fmtN(x[c.k]) + '"></td>');
        else h.push('<td><input class="in ' + (c.w || '') + '" ' + (c.list ? 'list="' + c.list + '" ' : '') + a + ' value="' + esc(x[c.k]) + '"></td>');
      });
      if (sub === 'fabricantes') h.push('<td class="calc num">' + Calc.dispositivosDe(S.cx, x.id).length + '</td>');
      h.push('<td style="white-space:nowrap">' + (sub !== 'fabricantes' ? '<button class="btn-icon" title="Duplicar" data-act="cat-dup" data-id="' + esc(x.id) + '">⧉</button>' : '') +
        '<button class="btn-icon del" title="Eliminar" data-act="cat-del" data-id="' + esc(x.id) + '">✕</button></td></tr>');
    });
    h.push('</tbody></table></div></section>');
    var circuitos = {};
    S.cat.dispositivos.forEach(function (d) { if (d.circuito) circuitos[d.circuito] = 1; });
    h.push('<datalist id="dl-circuitos">' + Object.keys(circuitos).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>');
    vista.innerHTML = h.join('');

    if (sub === 'dispositivos') {
      S.pintor = filtrarAdmin;
      var fFab = document.getElementById('fFab'), fQ = document.getElementById('fQ');
      fFab.addEventListener('change', function () { S.adminFiltro.fab = fFab.value; filtrarAdmin(); });
      fQ.addEventListener('input', function () { S.adminFiltro.q = fQ.value; filtrarAdmin(); });
    } else if (sub === 'cables') {
      S.pintor = function () {
        S.cat.cables.forEach(function (x) { out('calc:' + x.id + ':_rm', COLS_ADMIN.cables[7].calc(x)); });
      };
    }
  }

  function filtrarAdmin() {
    var fab = S.adminFiltro.fab, q = S.adminFiltro.q.toLowerCase().trim();
    vista.querySelectorAll('tr[data-row]').forEach(function (tr) {
      var d = porId(S.cat.dispositivos, tr.getAttribute('data-row'));
      var ok = (!fab || d.fabricante === fab) && (!q || [d.modelo, d.tag, d.descripcion, d.circuito].join(' ').toLowerCase().indexOf(q) >= 0);
      tr.style.display = ok ? '' : 'none';
    });
  }

  /* ======================= enlace de datos ======================= */
  function objetivo(el) {
    var d = el.dataset, P = S.proy;
    switch (d.o) {
      case 'proy': return P;
      case 'params': return P.params;
      case 'caida': return P.caida;
      case 'panel': return porId(P.paneles, d.id);
      case 'fuente': return porId(P.fuentes, d.id);
      case 'fila': { var e = equipo(d.eq); return e ? porId(e.filas, d.id) : null; }
      case 'circ': return porId(P.caida.circuitos, d.id);
      case 'cat': return porId(S.cat[d.col], d.id);
    }
    return null;
  }
  function leerValor(el) {
    var t = el.dataset.t, v = el.value;
    if (t === 'num') return v.trim() === '' || !isFinite(Number(v)) ? null : Number(v);
    if (t === 'pct') return v.trim() === '' || !isFinite(Number(v)) ? null : Number(v) / 100;
    return v;
  }
  function asignar(obj, k, v) {
    var partes = k.split('.'), o = obj;
    for (var i = 0; i < partes.length - 1; i++) {
      if (o[partes[i]] === undefined || o[partes[i]] === null) o[partes[i]] = /^\d+$/.test(partes[i + 1]) ? [] : {};
      o = o[partes[i]];
    }
    o[partes[partes.length - 1]] = v;
  }
  function aplicar(el) {
    var obj = objetivo(el);
    if (!obj) return;
    var k = el.dataset.k, v = leerValor(el);
    asignar(obj, k, v);
    if (el.dataset.o === 'fila' && k === 'fab') {
      var d = S.cx.disp[obj.disp];
      if (d && d.fabricante !== v) obj.disp = '';
    }
    if (el.dataset.o === 'fila' && k === 'disp') { obj.iEsp = null; obj.iAlm = null; }
    if (el.dataset.o === 'cat') catalogoCambiado(el.dataset.col);
    else proyectoCambiado();
    if (S.pintor) S.pintor();
  }

  vista.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.k || el.tagName === 'SELECT') return;
    aplicar(el);
  });
  vista.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'chkDetalle') { S.memDetalle = el.checked; renderVista(); return; }
    if (el.dataset && el.dataset.usuario) {
      var cambio = {};
      cambio[el.dataset.campo] = el.type === 'checkbox' ? el.checked : el.value;
      Auth.actualizarUsuario(el.dataset.usuario, cambio).then(function () { toast('Usuario actualizado'); })
        .catch(function (err) { toast('⚠ ' + msgError(err)); renderVista(); });
      return;
    }
    if (!el.dataset || !el.dataset.k) return;
    if (el.tagName === 'SELECT') aplicar(el);
    var re = el.dataset.re;
    if (re === 'vista' || re === 'all') renderVista();
    if (re === 'tabs' || re === 'all') renderTabs();
    if (re === 'sel') guardarYa();
  });

  /* ======================= acciones ======================= */
  function nuevosIdsEquipo(e, prefijo) {
    var c = clonar(e);
    c.id = uid(prefijo);
    c.filas.forEach(function (f) { f.id = uid('r'); });
    return c;
  }

  function agregarNiveles(texto) {
    var P = S.proy, n = 0;
    String(texto || '').split(/[,;\n]+/).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean).forEach(function (s) {
      if (P.niveles.indexOf(s) < 0) { P.niveles.push(s); n++; }
    });
    return n;
  }

  var acciones = {
    ir: function (b) { irA(b.dataset.tab); },
    imprimir: function () { window.print(); },

    'nivel-add': function () {
      var inp = document.getElementById('inNivel');
      if (!agregarNiveles(inp.value)) { toast('Escriba uno o varios niveles nuevos'); return; }
      proyectoCambiado(); renderVista();
      document.getElementById('inNivel').focus();
    },
    'niveles-rango': function () {
      dialogo({
        titulo: 'Agregar rango de niveles',
        html: '<label class="campo"><span>Prefijo</span><select name="pre"><option value="NIVEL">NIVEL</option><option value="SÓTANO">SÓTANO</option><option value="PISO">PISO</option></select></label>' +
          '<div class="grid c2"><label class="campo"><span>Desde</span><input name="a" type="number" value="1" required></label><label class="campo"><span>Hasta</span><input name="b" type="number" value="5" required></label></div>' +
          '<small>Para sótanos el rango se agrega de mayor a menor (p. ej. SÓTANO 3, SÓTANO 2, SÓTANO 1).</small>'
      }).then(function (r) {
        if (!r) return;
        var a = parseInt(r.a, 10), b = parseInt(r.b, 10), l = [];
        if (!isFinite(a) || !isFinite(b)) return;
        var lo = Math.min(a, b), hi = Math.max(a, b);
        for (var i = lo; i <= hi && l.length < 200; i++) l.push(r.pre + ' ' + i);
        if (r.pre === 'SÓTANO') l.reverse();
        var n = agregarNiveles(l.join(','));
        toast(n + ' nivel(es) agregados');
        proyectoCambiado(); renderVista();
      });
    },
    'nivel-del': function (b) {
      S.proy.niveles.splice(+b.dataset.i, 1);
      proyectoCambiado(); renderVista();
    },
    'trp-por-nivel': function () {
      var P = S.proy;
      if (!P.niveles.length) { toast('Primero defina los niveles del edificio'); return; }
      var conPanel = P.paneles.map(function (p) { return p.nivel; }), n = 0;
      P.niveles.forEach(function (nv) {
        if (conPanel.indexOf(nv) >= 0) return;
        P.paneles.push(nuevoPanel(P.paneles.length ? 'TRP' : 'FACP', nv));
        n++;
      });
      toast(n ? n + ' panel(es) creados — cada uno tiene su pestaña' : 'Todos los niveles ya tienen panel');
      proyectoCambiado(); render();
    },
    'panel-add': function (b) {
      var p = nuevoPanel(b.dataset.tipo, '');
      S.proy.paneles.push(p);
      proyectoCambiado(); render();
      toast('Panel ' + p.tag + ' agregado');
    },
    'panel-dup': function (b) {
      var P = S.proy, i = P.paneles.findIndex(function (x) { return x.id === b.dataset.id; });
      var c = nuevosIdsEquipo(P.paneles[i], 'pn');
      c.tag = tagLibre(c.tag);
      P.paneles.splice(i + 1, 0, c);
      proyectoCambiado(); render();
    },
    'panel-del': function (b) {
      var P = S.proy, p = porId(P.paneles, b.dataset.id);
      confirmar('Eliminar panel', '¿Eliminar <b>' + esc(p.tag) + '</b> y sus ' + p.filas.length + ' fila(s) de dispositivos?').then(function (ok) {
        if (!ok) return;
        P.paneles = P.paneles.filter(function (x) { return x !== p; });
        if (S.tab === 'p:' + p.id) S.tab = 'proyecto';
        proyectoCambiado(); render();
      });
    },
    'fuente-add': function () {
      var f = nuevaFuente('');
      S.proy.fuentes.push(f);
      proyectoCambiado(); render();
      toast('Fuente ' + f.tag + ' agregada');
    },
    'fuente-dup': function (b) {
      var P = S.proy, i = P.fuentes.findIndex(function (x) { return x.id === b.dataset.id; });
      var c = nuevosIdsEquipo(P.fuentes[i], 'fu');
      c.tag = tagLibre(c.tag);
      P.fuentes.splice(i + 1, 0, c);
      proyectoCambiado(); render();
    },
    'fuente-del': function (b) {
      var P = S.proy, f = porId(P.fuentes, b.dataset.id);
      confirmar('Eliminar fuente auxiliar', '¿Eliminar <b>' + esc(f.tag) + '</b>?').then(function (ok) {
        if (!ok) return;
        P.fuentes = P.fuentes.filter(function (x) { return x !== f; });
        if (S.tab === 'f:' + f.id) S.tab = 'proyecto';
        proyectoCambiado(); render();
      });
    },

    'fila-add': function (b) {
      var eq = equipo(S.tab), n = +b.dataset.n || 1;
      var ult = eq.filas[eq.filas.length - 1];
      for (var i = 0; i < n; i++) eq.filas.push(nuevaFila(ult ? ult.fab : S.proy.fabricante, ult ? ult.zona : eq.nivel));
      proyectoCambiado(); renderVista();
      var sel = vista.querySelectorAll('select[data-k="disp"]');
      if (sel.length) sel[sel.length - n].focus();
    },
    'fila-dup': function (b) {
      var eq = equipo(S.tab), i = eq.filas.findIndex(function (x) { return x.id === b.dataset.id; });
      var c = clonar(eq.filas[i]); c.id = uid('r');
      eq.filas.splice(i + 1, 0, c);
      proyectoCambiado(); renderVista();
    },
    'fila-del': function (b) {
      var eq = equipo(S.tab);
      eq.filas = eq.filas.filter(function (x) { return x.id !== b.dataset.id; });
      proyectoCambiado(); renderVista();
    },
    'filas-limpiar': function () {
      var eq = equipo(S.tab), antes = eq.filas.length;
      eq.filas = eq.filas.filter(function (f) { return f.disp || Calc.num(f.cant) !== null; });
      toast((antes - eq.filas.length) + ' fila(s) vacías eliminadas');
      proyectoCambiado(); renderVista();
    },

    'circ-add': function (b) {
      var n = +b.dataset.n || 1, cs = S.proy.caida.circuitos, ult = cs[cs.length - 1];
      for (var i = 0; i < n; i++) {
        var c = nuevoCircuito();
        if (ult) { c.fuente = ult.fuente; c.cable = ult.cable; }
        cs.push(c);
      }
      proyectoCambiado(); renderVista();
    },
    'circ-dup': function (b) {
      var cs = S.proy.caida.circuitos, i = cs.findIndex(function (x) { return x.id === b.dataset.id; });
      var c = clonar(cs[i]); c.id = uid('c');
      cs.splice(i + 1, 0, c);
      proyectoCambiado(); renderVista();
    },
    'circ-del': function (b) {
      S.proy.caida.circuitos = S.proy.caida.circuitos.filter(function (x) { return x.id !== b.dataset.id; });
      proyectoCambiado(); renderVista();
    },

    /* ----- administración ----- */
    'admin-sub': function (b) { S.adminSub = b.dataset.sub; renderVista(); },
    'cat-add': function () {
      var sub = S.adminSub, x;
      if (sub === 'dispositivos') x = { id: uid('d'), fabricante: S.adminFiltro.fab || (S.cat.fabricantes[0] || {}).id, modelo: '', tag: '', descripcion: '', iEspera: 0, iAlarma: 0, circuito: '', obs: '' };
      else if (sub === 'cables') x = { id: uid('c'), fabricante: '', modelo: '', awg: 16, conductores: 2, pantalla: 'NO', listado: 'FPLR', rKm: null, uso: '', obs: '' };
      else if (sub === 'baterias') x = { id: uid('b'), ah: null, refSimplex: '', refNotifier: '', refGenerica: '', obs: '' };
      else x = { id: uid('fab'), nombre: '' };
      S.adminFiltro.q = '';
      S.cat[sub].push(x);
      catalogoCambiado(sub); renderVista();
      var tr = vista.querySelector('tr[data-row="' + x.id + '"]');
      if (tr) { tr.scrollIntoView({ block: 'center' }); var inp = tr.querySelector('input'); if (inp) inp.focus(); }
      if (sub === 'baterias') toast('Digite la capacidad; la lista se reordena al volver a esta pestaña');
    },
    'cat-dup': function (b) {
      var l = S.cat[S.adminSub], i = l.findIndex(function (x) { return x.id === b.dataset.id; });
      var c = clonar(l[i]); c.id = uid(S.adminSub.charAt(0));
      l.splice(i + 1, 0, c);
      catalogoCambiado(S.adminSub); renderVista();
    },
    'cat-del': function (b) {
      var sub = S.adminSub, x = porId(S.cat[sub], b.dataset.id);
      if (sub === 'fabricantes' && Calc.dispositivosDe(S.cx, x.id).length) {
        toast('No se puede eliminar: el fabricante tiene dispositivos. Elimínelos o reasígnelos primero.');
        return;
      }
      var nombre = x.nombre || [x.fabricante, x.modelo, x.tag].filter(Boolean).join(' ') || (x.ah ? x.ah + ' Ah' : 'este registro');
      confirmar('Eliminar del catálogo', '¿Eliminar <b>' + esc(nombre) + '</b>? Los proyectos que lo usen mostrarán «no está en el catálogo».').then(function (ok) {
        if (!ok) return;
        S.cat[sub] = S.cat[sub].filter(function (y) { return y !== x; });
        catalogoCambiado(sub); renderVista();
      });
    },
    'cat-exportar': function () { descargar('catalogo-baterias-alarma-' + hoy() + '.json', S.cat); },
    'cat-importar': function () { S.importModo = 'catalogo'; document.getElementById('fileInput').click(); },
    'cat-restablecer': function () {
      confirmar('Restablecer catálogo', 'Se reemplazará el catálogo actual por el catálogo base (del Excel). Los cambios del administrador se perderán. ¿Continuar?', 'Restablecer').then(function (ok) {
        if (!ok) return;
        Store.restablecerCatalogo().then(function (c) { S.cat = c; S.cx = Calc.preparar(c); render(); toast('Catálogo base restablecido'); })
          .catch(function (e) { toast('⚠ ' + msgError(e)); });
      });
    },
    'cat-semilla': function () {
      var base = clonar(window.CATALOGO_BASE);
      Store.saveCatalogo(base).then(function () {
        S.cat = base; S.cx = Calc.preparar(base); render(); toast('Catálogo base cargado en Supabase');
      }).catch(function (e) { toast('⚠ ' + msgError(e)); });
    },
    'pin-cambiar': function () {
      dialogo({
        titulo: 'Cambiar PIN de administrador',
        html: '<label class="campo"><span>PIN nuevo (mín. 4 caracteres)</span><input name="a" type="password" minlength="4" required autocomplete="new-password"></label>' +
          '<label class="campo"><span>Repita el PIN</span><input name="b" type="password" minlength="4" required autocomplete="new-password"></label>'
      }).then(function (r) {
        if (!r) return;
        if (r.a !== r.b) { toast('Los PIN no coinciden'); return; }
        Auth.definirPin(r.a).then(function () { toast('PIN actualizado'); });
      });
    }
  };

  vista.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || !vista.contains(b)) return;
    var f = acciones[b.dataset.act];
    if (f) f(b);
  });
  vista.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'inNivel') { e.preventDefault(); acciones['nivel-add'](); }
  });

  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) irA(b.dataset.tab);
  });

  /* ----- menú de proyecto ----- */
  var menu = document.getElementById('menuProyecto');
  document.getElementById('btnMenuProyecto').addEventListener('click', function (e) {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', function () { menu.hidden = true; });

  function abrirProyecto(p, tab) {
    S.proy = normalizar(p);
    Store.setProyectoActual(p.id);
    S.tab = tab || 'proyecto';
    return guardarYa().then(function () { renderSelector(); render(); });
  }

  menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b) return;
    menu.hidden = true;
    var a = b.dataset.accion;
    if (a === 'nuevo') {
      dialogo({
        titulo: 'Nuevo proyecto',
        html: '<label class="campo"><span>Nombre del proyecto</span><input name="nombre" required></label>' +
          '<label class="campo"><span>N.º de proyecto</span><input name="numero"></label>' +
          '<label class="campo"><span>Niveles (opcional, separados por coma)</span><input name="niveles" placeholder="SÓTANO 1, NIVEL 1, NIVEL 2"></label>',
        ok: 'Crear'
      }).then(function (r) {
        if (!r) return;
        var p = nuevoProyecto(r.nombre.trim());
        p.numero = r.numero.trim();
        S.proy = p;
        agregarNiveles(r.niveles);
        abrirProyecto(p).then(function () { toast('Proyecto creado. Agregue paneles por nivel.'); });
      });
    } else if (a === 'ejemplo') {
      abrirProyecto(proyectoEjemplo()).then(function () { toast('Proyecto de ejemplo creado con los datos del Excel'); });
    } else if (a === 'duplicar') {
      var c = clonar(S.proy);
      c.id = uid('p');
      c.nombre = (c.nombre || '') + ' (copia)';
      abrirProyecto(c).then(function () { toast('Proyecto duplicado'); });
    } else if (a === 'exportar') {
      guardarYa().then(function () {
        descargar((S.proy.numero ? S.proy.numero + ' ' : '') + (S.proy.nombre || 'proyecto') + '.json',
          { tipo: 'baterias-alarma/proyecto', version: 1, exportado: new Date().toISOString(), proyecto: S.proy });
      });
    } else if (a === 'importar') {
      S.importModo = 'proyecto';
      document.getElementById('fileInput').click();
    } else if (a === 'eliminar') {
      confirmar('Eliminar proyecto', '¿Eliminar definitivamente <b>' + esc(S.proy.nombre) + '</b> ' + (REMOTO ? 'de la base de datos (lo pierden todos los usuarios)' : 'de este navegador') + '? Exporte un respaldo antes si lo necesita.').then(function (ok) {
        if (!ok) return;
        clearTimeout(S.tGuardar); S.tGuardar = null;
        Store.eliminarProyecto(S.proy.id).then(function () { return Store.listarProyectos(); }).then(function (l) {
          S.lista = l;
          if (l.length) return Store.getProyecto(l[0].id).then(function (p) { return abrirProyecto(p); });
          return abrirProyecto(nuevoProyecto('Proyecto nuevo'));
        }).then(function () { toast('Proyecto eliminado'); })
          .catch(function (e) { toast('⚠ ' + msgError(e)); });
      });
    }
  });

  document.getElementById('selProyecto').addEventListener('change', function (e) {
    guardarYa().then(function () { return Store.getProyecto(e.target.value); }).then(function (p) {
      if (p) abrirProyecto(p);
    }).catch(function (err) { toast('⚠ ' + msgError(err)); });
  });

  document.getElementById('fileInput').addEventListener('change', function (e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(function (txt) {
      var d = JSON.parse(txt);
      if (S.importModo === 'catalogo') {
        if (!d.dispositivos || !d.baterias || !d.cables) throw new Error('El archivo no es un catálogo válido');
        return confirmar('Importar catálogo', 'Se reemplazará el catálogo actual (' + S.cat.dispositivos.length + ' dispositivos) por el del archivo (' + d.dispositivos.length + ' dispositivos). ¿Continuar?', 'Importar').then(function (ok) {
          if (!ok) return;
          d.fabricantes = d.fabricantes || [];
          S.cat = d;
          catalogoCambiado();
          render();
          toast('Catálogo importado');
        });
      }
      var p = d.proyecto || d;
      if (!p.paneles) throw new Error('El archivo no es un proyecto válido');
      p.id = uid('p');
      return abrirProyecto(p).then(function () { toast('Proyecto importado'); });
    }).catch(function (err) { toast('⚠ No se pudo importar: ' + err.message); });
  });

  /* ----- administrador / sesión ----- */
  function btnAdminLocal() {
    if (Auth.esAdmin()) {
      Auth.salir();
      if (S.tab === 'admin') S.tab = 'proyecto';
      renderAdminBtn(); render();
      toast('Sesión de administrador cerrada');
      return;
    }
    if (!Auth.tienePin()) {
      dialogo({
        titulo: 'Definir PIN de administrador',
        html: '<p style="margin:0">Primera vez en este navegador: defina el PIN que protegerá la edición de catálogos (fabricantes, dispositivos, cables y baterías).</p>' +
          '<label class="campo"><span>PIN (mín. 4 caracteres)</span><input name="a" type="password" minlength="4" required autocomplete="new-password"></label>' +
          '<label class="campo"><span>Repita el PIN</span><input name="b" type="password" minlength="4" required autocomplete="new-password"></label>',
        ok: 'Definir PIN'
      }).then(function (r) {
        if (!r) return;
        if (r.a !== r.b) { toast('Los PIN no coinciden'); return; }
        Auth.definirPin(r.a).then(function () { renderAdminBtn(); irA('admin'); });
      });
      return;
    }
    dialogo({
      titulo: 'Modo administrador',
      html: '<label class="campo"><span>PIN</span><input name="pin" type="password" required autocomplete="current-password"></label>',
      ok: 'Entrar'
    }).then(function (r) {
      if (!r) return;
      Auth.entrar(r.pin).then(function (ok) {
        if (!ok) { toast('PIN incorrecto'); return; }
        renderAdminBtn(); irA('admin');
      });
    });
  }

  function btnAdminRemoto() {
    var u = Auth.usuario();
    if (!u) return;
    var pf = Auth.perfil() || {};
    dialogo({
      titulo: 'Sesión',
      html: '<p style="margin:0"><b>' + esc(pf.nombre || u.email) + '</b><br>' + esc(u.email) + '<br>Rol: <b>' + (Auth.esAdmin() ? 'administrador' : 'usuario') + '</b></p>' +
        '<label class="campo"><span>Acción</span><select name="op"><option value="salir">Cerrar sesión</option><option value="clave">Cambiar mi contraseña</option>' +
        '<option value="migrar">Subir a Supabase los proyectos guardados en este navegador</option></select></label>',
      ok: 'Continuar'
    }).then(function (r) {
      if (!r) return;
      if (r.op === 'salir') {
        guardarYa().then(function () { return Auth.salir(); });
      } else if (r.op === 'clave') {
        pedirClaveNueva();
      } else {
        migrarLocales();
      }
    });
  }

  function pedirClaveNueva() {
    return dialogo({
      titulo: 'Nueva contraseña',
      html: '<label class="campo"><span>Contraseña nueva (mín. 8 caracteres)</span><input name="a" type="password" minlength="8" required autocomplete="new-password"></label>' +
        '<label class="campo"><span>Repita la contraseña</span><input name="b" type="password" minlength="8" required autocomplete="new-password"></label>',
      ok: 'Guardar'
    }).then(function (r) {
      if (!r) return;
      if (r.a !== r.b) { toast('Las contraseñas no coinciden'); return; }
      return Auth.cambiarClave(r.a).then(function () { toast('Contraseña actualizada'); })
        .catch(function (e) { toast('⚠ ' + msgError(e)); });
    });
  }

  /* Migración: proyectos de la fase 1 (localStorage) → Supabase */
  function migrarLocales() {
    Store.proyectosLocales().then(function (locales) {
      if (!locales.length) { toast('No hay proyectos locales en este navegador'); return; }
      return confirmar('Subir proyectos locales', 'Se subirán <b>' + locales.length + '</b> proyecto(s) de este navegador a Supabase (los que ya existan allí con el mismo identificador se omiten). ¿Continuar?', 'Subir').then(function (ok) {
        if (!ok) return;
        var n = 0, omit = 0, p = Promise.resolve();
        locales.forEach(function (l) {
          p = p.then(function () {
            return Store.saveProyecto(normalizar(l)).then(function (res) { if (res === true) n++; else omit++; });
          });
        });
        return p.then(function () { return Store.listarProyectos(); }).then(function (lista) {
          S.lista = lista; renderSelector();
          toast(n + ' proyecto(s) subidos' + (omit ? ', ' + omit + ' omitidos (ya existían)' : ''));
        });
      });
    }).catch(function (e) { toast('⚠ ' + msgError(e)); });
  }

  document.getElementById('btnAdmin').addEventListener('click', function () {
    if (REMOTO) btnAdminRemoto(); else btnAdminLocal();
  });

  window.addEventListener('beforeunload', function (e) {
    if (!S.tGuardar) return;
    if (REMOTO) { e.preventDefault(); e.returnValue = ''; return; }
    Store.saveProyecto(S.proy);
  });

  /* ======================= acceso (modo Supabase) ======================= */
  function pantallaAcceso(modo, aviso) {
    document.body.classList.add('sin-sesion');
    tabsEl.innerHTML = '';
    renderAdminBtn();
    var reg = modo === 'registro';
    vista.innerHTML = '<div class="acceso"><div class="card"><div class="card-h"><h3>' + (reg ? 'Crear cuenta' : 'Iniciar sesión') + '</h3></div><div class="card-b">' +
      (aviso ? '<div class="ayuda">' + aviso + '</div>' : '') +
      '<form id="frmAcceso" class="grid" style="grid-template-columns:1fr">' +
      (reg ? '<label class="campo"><span>Nombre</span><input name="nombre" required autocomplete="name"></label>' : '') +
      '<label class="campo"><span>Correo</span><input name="email" type="email" required autocomplete="username"></label>' +
      '<label class="campo"><span>Contraseña' + (reg ? ' (mín. 8 caracteres)' : '') + '</span><input name="clave" type="password" required minlength="' + (reg ? 8 : 1) + '" autocomplete="' + (reg ? 'new-password' : 'current-password') + '"></label>' +
      '<button class="btn btn-primary" type="submit">' + (reg ? 'Registrarme' : 'Entrar') + '</button>' +
      '<div style="display:flex; justify-content:space-between; font-size:13px">' +
      '<a href="#" data-modo="' + (reg ? 'login' : 'registro') + '">' + (reg ? 'Ya tengo cuenta' : 'Crear cuenta') + '</a>' +
      (reg ? '' : '<a href="#" data-modo="recuperar">Olvidé mi contraseña</a>') + '</div></form>' +
      '<p style="font-size:12px; color:var(--ink-3); margin-bottom:0">Las cuentas @sinergia.co.cr quedan activas al registrarse. Otras cuentas requieren aprobación de un administrador.</p>' +
      '</div></div></div>';
    var frm = document.getElementById('frmAcceso');
    frm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = frm.elements, btn = frm.querySelector('button[type=submit]');
      btn.disabled = true;
      var email = f.email.value.trim();
      var p = reg ? Auth.registrar(email, f.clave.value, f.nombre.value.trim()) : Auth.entrar(email, f.clave.value);
      p.then(function (res) {
        if (reg && res === false) {
          pantallaAcceso('login', 'Cuenta creada. Revise su correo para <b>confirmar la dirección</b> y luego inicie sesión.');
          return;
        }
        return iniciarApp();
      }).catch(function (err) {
        btn.disabled = false;
        var m = msgError(err);
        if (/invalid login/i.test(m)) m = 'Correo o contraseña incorrectos';
        else if (/not confirmed/i.test(m)) m = 'Debe confirmar su correo antes de entrar';
        toast('⚠ ' + m);
      });
    });
    vista.querySelectorAll('[data-modo]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var m = a.dataset.modo;
        if (m !== 'recuperar') return pantallaAcceso(m);
        var email = frm.elements.email.value.trim();
        if (!email) { toast('Escriba su correo y vuelva a pulsar «Olvidé mi contraseña»'); return; }
        Auth.recuperar(email).then(function () { toast('Si el correo existe, recibirá un enlace para restablecer la contraseña'); })
          .catch(function (err) { toast('⚠ ' + msgError(err)); });
      });
    });
  }

  function pantallaPendiente() {
    document.body.classList.add('sin-sesion');
    tabsEl.innerHTML = '';
    renderAdminBtn();
    var u = Auth.usuario();
    vista.innerHTML = '<div class="acceso"><div class="card"><div class="card-h"><h3>Cuenta pendiente de aprobación</h3></div><div class="card-b">' +
      '<p style="margin-top:0">Su cuenta <b>' + esc(u ? u.email : '') + '</b> está registrada, pero un administrador debe activarla para que pueda ver los proyectos.</p>' +
      '<div style="display:flex; gap:8px"><button class="btn btn-primary" id="btnReintentar">Ya me activaron — reintentar</button><button class="btn" id="btnSalirPend">Cerrar sesión</button></div></div></div></div>';
    document.getElementById('btnReintentar').addEventListener('click', function () { iniciarApp(); });
    document.getElementById('btnSalirPend').addEventListener('click', function () { Auth.salir(); });
  }

  /* ======================= inicio ======================= */
  function cargarDatos() {
    return Store.getCatalogo().then(function (cat) {
      S.cat = cat;
      S.cat.fabricantes = S.cat.fabricantes || [];
      S.cx = Calc.preparar(cat);
      return Store.listarProyectos();
    }).then(function (l) {
      S.lista = l;
      var id = Store.getProyectoActual();
      if (!l.some(function (x) { return x.id === id; })) id = l.length ? l[0].id : null;
      return id ? Store.getProyecto(id) : null;
    }).then(function (p) {
      renderAdminBtn();
      if (p) return abrirProyecto(p);
      S.proy = nuevoProyecto();
      // Local: primer uso con el proyecto de ejemplo del Excel. Supabase: proyecto en blanco (no se ensucia la base compartida).
      return abrirProyecto(REMOTO ? nuevoProyecto('Proyecto nuevo') : proyectoEjemplo());
    });
  }

  function iniciarApp() {
    document.body.classList.remove('sin-sesion');
    if (!REMOTO) return cargarDatos();
    if (!Auth.usuario()) return pantallaAcceso('login');
    return Auth.recargarPerfil().then(function () {
      if (!Auth.esMiembro()) return pantallaPendiente();
      return cargarDatos();
    }).catch(function (e) {
      pantallaAcceso('login', '⚠ No se pudo conectar con Supabase: ' + esc(msgError(e)));
    });
  }

  if (window.SUPABASE_ERROR) {
    vista.innerHTML = '<div class="acceso"><div class="card"><div class="card-b">⚠ ' + esc(window.SUPABASE_ERROR) + '</div></div></div>';
  } else if (REMOTO) {
    Auth.alCambiar(function (evento) {
      if (evento === 'SIGNED_OUT') { S.proy = null; pantallaAcceso('login'); }
      else if (evento === 'PASSWORD_RECOVERY') { pedirClaveNueva().then(function () { iniciarApp(); }); }
    });
    Auth.iniciar().then(iniciarApp).catch(function (e) {
      pantallaAcceso('login', '⚠ No se pudo conectar con Supabase: ' + esc(msgError(e)));
    });
  } else {
    iniciarApp();
  }
})();
