/* Capa de datos.
 * Fase 1: guarda en el navegador (localStorage).
 * Fase 2: se reemplaza por SupabaseStore con la MISMA interfaz asíncrona, sin tocar app.js:
 *   getCatalogo / saveCatalogo / restablecerCatalogo / listarProyectos / getProyecto / saveProyecto / eliminarProyecto
 * Ver README.md → «Fase 2 — Supabase» para el modelo de tablas propuesto. */
(function (global) {
  'use strict';

  var K = {
    catalogo: 'bat.catalogo',
    indice: 'bat.proyectos',
    proyecto: function (id) { return 'bat.proyecto.' + id; },
    actual: 'bat.proyectoActual'
  };

  function leer(k, def) {
    try {
      var v = localStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }
  function escribir(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { console.error('No se pudo guardar', k, e); return false; }
  }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function uid(prefijo) {
    return (prefijo || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function desdeBase() {
    var c = clonar(global.CATALOGO_BASE);
    c.baseVersion = c.version;
    return c;
  }

  var LocalStore = {
    nombre: 'Navegador (local)',

    getCatalogo: function () {
      var c = leer(K.catalogo, null);
      if (!c) return Promise.resolve(desdeBase());
      // Catálogo editado y guardado antes de una versión nueva del catálogo base: se suman, una sola vez, los registros
      // nuevos del base (por id) sin tocar lo editado; lo que el administrador borre después no vuelve a agregarse.
      var base = global.CATALOGO_BASE;
      if ((c.baseVersion || 0) < base.version) {
        ['fabricantes', 'dispositivos', 'cables'].forEach(function (t) {
          var ids = {};
          (c[t] = c[t] || []).forEach(function (x) { ids[x.id] = 1; });
          (base[t] || []).forEach(function (x) { if (!ids[x.id]) c[t].push(clonar(x)); });
        });
        c.baseVersion = base.version;
        escribir(K.catalogo, c);
      }
      return Promise.resolve(c);
    },
    saveCatalogo: function (cat) {
      cat.actualizado = new Date().toISOString().slice(0, 10);
      return Promise.resolve(escribir(K.catalogo, cat));
    },
    restablecerCatalogo: function () {
      localStorage.removeItem(K.catalogo);
      return Promise.resolve(desdeBase());
    },

    listarProyectos: function () {
      return Promise.resolve(leer(K.indice, []));
    },
    getProyecto: function (id) {
      return Promise.resolve(leer(K.proyecto(id), null));
    },
    saveProyecto: function (p) {
      p.actualizado = new Date().toISOString();
      var ok = escribir(K.proyecto(p.id), p);
      var idx = leer(K.indice, []).filter(function (x) { return x.id !== p.id; });
      idx.unshift({ id: p.id, numero: p.numero, nombre: p.nombre, actualizado: p.actualizado });
      return Promise.resolve(escribir(K.indice, idx) && ok);
    },
    eliminarProyecto: function (id) {
      localStorage.removeItem(K.proyecto(id));
      escribir(K.indice, leer(K.indice, []).filter(function (x) { return x.id !== id; }));
      return Promise.resolve(true);
    },

    getProyectoActual: function () { return leer(K.actual, null); },
    setProyectoActual: function (id) { escribir(K.actual, id); }
  };

  global.Store = LocalStore;
  global.uid = uid;
  global.clonar = clonar;
})(window);
