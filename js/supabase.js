/* Fase 2 — Supabase.
 * Si js/config.js tiene URL y clave, reemplaza window.Store y window.Auth por implementaciones con supabase-js
 * que mantienen la misma interfaz que store.js / auth.js (app.js no distingue el origen de los datos).
 * Tablas y políticas: supabase/01_esquema.sql. */
(function (global) {
  'use strict';

  var cfg = global.APP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;          // modo local
  if (!global.supabase || !global.supabase.createClient) {
    global.SUPABASE_ERROR = 'No se pudo cargar la librería de Supabase (revise la conexión a internet).';
    return;
  }

  var sb = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  var Local = global.Store;

  function datos(r) {
    if (r.error) throw r.error;
    return r.data;
  }

  /* ---------- correspondencia app (camelCase) ↔ tablas (snake_case) ---------- */
  var MAPAS = {
    fabricantes: { id: 'id', nombre: 'nombre' },
    dispositivos: {
      id: 'id', fabricante: 'fabricante_id', modelo: 'modelo', tag: 'tag', descripcion: 'descripcion',
      iEspera: 'i_espera_ma', iAlarma: 'i_alarma_ma', circuito: 'circuito', obs: 'obs'
    },
    cables: {
      id: 'id', fabricante: 'fabricante', modelo: 'modelo', awg: 'awg', conductores: 'conductores', pantalla: 'pantalla',
      listado: 'listado', rKm: 'r_ohm_km', uso: 'uso', obs: 'obs'
    },
    baterias: { id: 'id', ah: 'ah', refSimplex: 'ref_simplex', refNotifier: 'ref_notifier', refGenerica: 'ref_generica', obs: 'obs' }
  };
  var TABLAS = ['fabricantes', 'dispositivos', 'cables', 'baterias'];
  var TEXTO = { modelo: 1, tag: 1, descripcion: 1, circuito: 1, obs: 1, fabricante: 1, pantalla: 1, listado: 1, uso: 1, refSimplex: 1, refNotifier: 1, refGenerica: 1, nombre: 1 };

  function aFila(tabla, x, orden) {
    var m = MAPAS[tabla], r = { orden: orden };
    Object.keys(m).forEach(function (k) {
      var v = x[k];
      if (v === undefined) v = null;
      if (v === null && TEXTO[k]) v = '';
      if (typeof v === 'string' && !TEXTO[k] && k !== 'id') v = v.trim() === '' ? null : Number(v);
      r[m[k]] = v;
    });
    return r;
  }
  function deFila(tabla, r) {
    var m = MAPAS[tabla], x = {};
    Object.keys(m).forEach(function (k) {
      var v = r[m[k]];
      x[k] = v !== null && v !== undefined && !TEXTO[k] && k !== 'id' ? Number(v) : v;
    });
    return x;
  }

  var idsRemotos = {};      // ids presentes en la base al último leer/guardar (para borrar los quitados)
  var versiones = {};       // versión de cada proyecto abierto (control de concurrencia)

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  var SupabaseStore = {
    nombre: 'Supabase',
    remoto: true,
    cliente: sb,

    getCatalogo: function () {
      return Promise.all(TABLAS.map(function (t) {
        return sb.from(t).select('*').order('orden').order('id').then(datos);
      })).then(function (res) {
        var cat = { version: 1, actualizado: '' };
        var max = '';
        TABLAS.forEach(function (t, i) {
          idsRemotos[t] = res[i].map(function (r) { return r.id; });
          cat[t] = res[i].map(function (r) {
            if (r.actualizado_en > max) max = r.actualizado_en;
            return deFila(t, r);
          });
        });
        cat.actualizado = max ? max.slice(0, 10) : '';
        if (!cat.dispositivos.length && !cat.baterias.length) {
          // Base sin semilla: se trabaja con el catálogo del Excel hasta que un admin lo cargue
          var base = clonar(global.CATALOGO_BASE);
          base.sinSemilla = true;
          return base;
        }
        return cat;
      });
    },

    /* Guarda las tablas indicadas (o todas): upsert de lo presente + borrado de lo quitado.
     * Orden: fabricantes primero al insertar y último al borrar (los dispositivos lo referencian). */
    saveCatalogo: function (cat, tablas) {
      var lista = tablas && tablas.length ? TABLAS.filter(function (t) { return tablas.indexOf(t) >= 0; }) : TABLAS;
      var p = Promise.resolve();
      lista.forEach(function (t) {
        p = p.then(function () {
          var filas = (cat[t] || []).map(function (x, i) { return aFila(t, x, i); });
          return filas.length ? sb.from(t).upsert(filas).then(datos) : null;
        });
      });
      lista.slice().reverse().forEach(function (t) {
        p = p.then(function () {
          var actuales = (cat[t] || []).map(function (x) { return x.id; });
          var quitar = (idsRemotos[t] || []).filter(function (id) { return actuales.indexOf(id) < 0; });
          return quitar.length ? sb.from(t).delete().in('id', quitar).then(datos) : null;
        }).then(function () {
          idsRemotos[t] = (cat[t] || []).map(function (x) { return x.id; });
        });
      });
      return p.then(function () {
        delete cat.sinSemilla;
        cat.actualizado = new Date().toISOString().slice(0, 10);
        return true;
      });
    },

    restablecerCatalogo: function () {
      var base = clonar(global.CATALOGO_BASE);
      return SupabaseStore.saveCatalogo(base).then(function () { return base; });
    },

    listarProyectos: function () {
      return sb.from('proyectos')
        .select('id, numero, nombre, actualizado_en, editor:perfiles!proyectos_actualizado_por_fkey(nombre)')
        .order('actualizado_en', { ascending: false })
        .then(datos)
        .then(function (l) {
          return l.map(function (r) {
            return { id: r.id, numero: r.numero, nombre: r.nombre, actualizado: r.actualizado_en, editor: r.editor ? r.editor.nombre : '' };
          });
        });
    },

    getProyecto: function (id) {
      return sb.from('proyectos').select('datos, version').eq('id', id).maybeSingle().then(datos).then(function (r) {
        if (!r) return null;
        versiones[id] = r.version;
        var p = r.datos;
        p.id = id;
        return p;
      });
    },

    /* Devuelve true si guardó, o 'conflicto' si otro usuario guardó una versión más nueva */
    saveProyecto: function (p) {
      p.actualizado = new Date().toISOString();
      var fila = { numero: p.numero || '', nombre: p.nombre || '', datos: p };
      var v = versiones[p.id];
      if (v === undefined) {
        fila.id = p.id;
        return sb.from('proyectos').insert(fila).select('version').single().then(function (r) {
          if (r.error && r.error.code === '23505') return 'conflicto';   // ya existe (creado en otra pestaña)
          versiones[p.id] = datos(r).version;
          return true;
        });
      }
      return sb.from('proyectos').update(fila).eq('id', p.id).eq('version', v).select('version').then(datos).then(function (l) {
        if (!l.length) return 'conflicto';
        versiones[p.id] = l[0].version;
        return true;
      });
    },

    eliminarProyecto: function (id) {
      return sb.from('proyectos').delete().eq('id', id).select('id').then(datos).then(function (l) {
        if (!l.length) throw new Error('Sin permiso: solo el creador del proyecto o un administrador puede eliminarlo');
        delete versiones[id];
        return true;
      });
    },

    olvidarVersion: function (id) { delete versiones[id]; },

    /* Proyectos guardados en este navegador durante la fase 1 (para subirlos) */
    proyectosLocales: function () {
      return Local.listarProyectos().then(function (l) {
        return Promise.all(l.map(function (x) { return Local.getProyecto(x.id); }));
      }).then(function (l) { return l.filter(Boolean); });
    },

    getProyectoActual: Local.getProyectoActual,
    setProyectoActual: Local.setProyectoActual
  };

  /* ---------- Autenticación (Supabase Auth + tabla perfiles) ---------- */
  var sesion = null, perfil = null;

  function cargarPerfil() {
    if (!sesion) { perfil = null; return Promise.resolve(null); }
    return sb.from('perfiles').select('*').eq('user_id', sesion.user.id).maybeSingle().then(datos).then(function (p) {
      perfil = p;
      return p;
    });
  }

  var SupabaseAuth = {
    modo: 'supabase',
    iniciar: function () {
      return sb.auth.getSession().then(function (r) {
        sesion = r.data && r.data.session;
        return cargarPerfil();
      }).then(function () { return !!sesion; });
    },
    alCambiar: function (fn) {
      sb.auth.onAuthStateChange(function (evento, s) {
        sesion = s;
        fn(evento);
      });
    },
    usuario: function () { return sesion ? sesion.user : null; },
    perfil: function () { return perfil; },
    recargarPerfil: cargarPerfil,
    esMiembro: function () { return !!(perfil && perfil.activo); },
    esAdmin: function () { return !!(perfil && perfil.activo && perfil.rol === 'admin'); },

    entrar: function (email, clave) {
      return sb.auth.signInWithPassword({ email: email, password: clave }).then(function (r) {
        if (r.error) throw r.error;
        sesion = r.data.session;
        return cargarPerfil();
      });
    },
    registrar: function (email, clave, nombre) {
      return sb.auth.signUp({
        email: email, password: clave,
        options: { data: { nombre: nombre }, emailRedirectTo: location.origin + location.pathname }
      }).then(function (r) {
        if (r.error) throw r.error;
        sesion = r.data.session;          // null si el proyecto exige confirmar el correo
        return cargarPerfil().then(function () { return !!sesion; });
      });
    },
    recuperar: function (email) {
      return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function (r) {
        if (r.error) throw r.error;
      });
    },
    cambiarClave: function (clave) {
      return sb.auth.updateUser({ password: clave }).then(function (r) { if (r.error) throw r.error; });
    },
    salir: function () {
      return sb.auth.signOut().then(function () { sesion = null; perfil = null; });
    },

    /* Administración de usuarios (solo admin; lo garantiza RLS) */
    listarUsuarios: function () {
      return sb.from('perfiles').select('*').order('creado_en').then(datos);
    },
    actualizarUsuario: function (id, cambios) {
      return sb.from('perfiles').update(cambios).eq('user_id', id).select('user_id').then(datos).then(function (l) {
        if (!l.length) throw new Error('Sin permiso para modificar este usuario');
      });
    },

    // Compatibilidad con la interfaz del PIN local (no se usan en este modo)
    tienePin: function () { return true; }
  };

  global.Store = SupabaseStore;
  global.Auth = SupabaseAuth;
})(window);
