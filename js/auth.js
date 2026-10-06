/* Permisos de administrador.
 * Fase 1: PIN local (hash SHA-256 en este navegador). Solo oculta/habilita la pestaña Administración
 *         (catálogos de fabricantes, dispositivos, cables y baterías). NO es seguridad real: todo corre en el navegador.
 * Fase 2: se reemplaza por Supabase Auth + tabla de roles + políticas RLS (solo el rol «admin»
 *         puede escribir en los catálogos). La interfaz de este módulo se mantiene. */
(function (global) {
  'use strict';

  var K_HASH = 'bat.adminHash';
  var K_SES = 'bat.adminSesion';

  function hash(texto) {
    var datos = new TextEncoder().encode('bat::' + texto);
    if (global.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', datos).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    // Respaldo sin crypto.subtle (archivo abierto sin https): hash simple
    var h = 0;
    for (var i = 0; i < datos.length; i++) h = (h * 31 + datos[i]) | 0;
    return Promise.resolve('x' + h.toString(16));
  }

  global.Auth = {
    tienePin: function () { return !!localStorage.getItem(K_HASH); },
    esAdmin: function () { return sessionStorage.getItem(K_SES) === '1'; },
    definirPin: function (pin) {
      return hash(pin).then(function (h) {
        localStorage.setItem(K_HASH, h);
        sessionStorage.setItem(K_SES, '1');
        return true;
      });
    },
    entrar: function (pin) {
      return hash(pin).then(function (h) {
        var ok = h === localStorage.getItem(K_HASH);
        if (ok) sessionStorage.setItem(K_SES, '1');
        return ok;
      });
    },
    salir: function () { sessionStorage.removeItem(K_SES); }
  };
})(window);
