/* Simbología de alarmas contra incendio — CDCLH-001S (Circuito S.A.), versiones Simplex y Notifier.
 * Descripciones y referencias por fabricante tomadas de las láminas; tag/tipo permiten enlazar cada fila con los modelos del catálogo.
 * Generado con excel/generar_simbologia.py: no editar a mano. */
window.SIMBOLOGIA_CDCLH = {
 "fuente": "CDCLH-001S Simbología de alarmas contra incendio (Circuito S.A.)",
 "filas": [
  {
   "id": "sdh",
   "nombre": "Detector de humo fotoeléctrico",
   "sim": "FA132",
   "tag": "^SDH",
   "tipo": null,
   "desc": "DETECTOR DE HUMO FOTOELÉCTRICO DIRECCIONABLE (A MENOS QUE SE INDIQUE CONVENCIONAL) IGUAL O SUPERIOR A REFERENCIA. DEBE INCLUIR LA BASE PARA CADA APLICACIÓN.",
   "ref": {
    "simplex": "DETECTOR DIRECCIONABLE:4098-9714 DETECTOR CONVENCIONAL: 4098-9601",
    "notifier": "DIRECCIONABLE:FSP-851 CONVENCIONAL: 2151"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "sdt",
   "nombre": "Detector de temperatura",
   "sim": "FA079",
   "tag": "^SDT",
   "tipo": null,
   "desc": "DETECTOR DE TEMPERATURA DIRECCIONABLE (A MENOS QUE SE INDIQUE CONVENCIONAL) SEGÚN APLICA PARA 57.5°C (135°F). IGUAL O SUPERIOR A REFERENCIA. DEBE INCLUIR LA BASE PARA CADA APLICACIÓN.",
   "ref": {
    "simplex": "DETECTOR DIRECCIONABLE: 4098-9733 DETECTOR CONVENCIONAL: 4098-9613",
    "notifier": "DIRECCIONABLE: FST-851 CONVENCIONAL: 5601"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "em",
   "nombre": "Estación manual",
   "sim": "FA118",
   "tag": "^EM$",
   "tipo": null,
   "desc": "ESTACIÓN MANUAL DIRECCIONABLE DE DOBLE ACCIÓN, ROJA, (VER DETALLE EN LAMINA H-5XX). INCLUIR MODELO O ACCESORIOS APROPIADOS PARA EXTERIORES, AMBIENTES PELIGROSOS O A PRUEBA DE EXPLOSIÓN O EN MONTAJE SUPERFICIAL. IGUAL O SUPERIOR A REFERENCIA. DEBE INCLUIR COBERTOR PLÁSTICO EN APLICACIONES DE EDUCACIÓN, HOSPITALES, COMERCIO, TRANSPORTES.",
   "ref": {
    "simplex": "4099-9006 4099-9006SP (ESPAÑOL)",
    "notifier": "NOTIFIER NBG-12LX & STI-I200"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "duct",
   "nombre": "Detector de humo para ducto",
   "sim": "FA133",
   "tag": "^(SD-DUCTO|RTS)$",
   "tipo": null,
   "desc": "DETECTOR DE HUMO FOTOELÉCTRICO DIRECCIONABLE PARA DETECCIÓN EN DUCTO DE AIRE ACONDICIONADO, EN CASO DE QUE EL SENSOR DE DUCTO NO QUEDE ACCESIBLE DEBE INCLUIR ESTACIÓN REMOTA DE PRUEBA Y RESETEO ACCESIBLE COLOCADA EN PARED, DEBE INLCUIR TUBO DE MUESTREO Y TAPA ORIGINAL. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "DETECTOR 4098-9755 ESTACION REMOTA 2098-9806",
    "notifier": "NOTIFIER DNRW & FSP851R & RTS151 & DST10 & P48-21-00 & ETX"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "sb",
   "nombre": "Base audible con detector",
   "sim": "FA134",
   "tag": "^SB$",
   "tipo": null,
   "desc": "BASE AUDIBLE CON DETECTOR DIRECCIONABLE, REQUIERE 24VDC+SLC, FUNCIONAMIENTO SEGÚN FABRICANTE. EN HABITACIONES O DORMITORIOS SE DEBERÁ CONSIDERAR LA BASE A 520 Hz. MODELOS IGUALES O SUPERIORES A  LA REFERENCIA.",
   "ref": {
    "simplex": "DETECTOR 4098-9714 BASE 4098-9794 BASE 4098-9772 (520 Hz)",
    "notifier": "NOTIFIER B200S+DETECTOR. DEPENDE DE PANEL UTILIZADO."
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "bh",
   "nombre": "Detector de humo de haz de luz",
   "sim": "FA130",
   "tag": "^BH$",
   "tipo": null,
   "desc": "DETECTOR DE HUMO DE HAZ DE LUZ (TRANSMISOR Y RECEPTOR). DEPENDIENDO DEL MODELO Y FABRICANTE PUEDE SER UN ESPEJO. SE DEBE INCLUIR UNIDAD DE PRUEBA Y RESETEO REMOTA. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4098-9019",
    "notifier": "NOTIFIER FSB-200 & RTS451 NOTIFIER REFLECTIVE PLATE"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "co",
   "nombre": "Detector combinado humo/CO",
   "sim": "FA127",
   "tag": "^CO$",
   "tipo": null,
   "desc": "DETECTOR COMBINADO DIRECCIONABLE HUMO FOTOELÉCTRICO/MONÓXIDO DE CARBONO, DEBE INCLUIR LA BASE PARA CADA APLICACIÓN. (O EQUIVALENTE, BASE CON DETECCIÓN DE MONÓXIDO DE CARBONO Y UN DETECTOR DE HUMO FOTOELÉCTRICO DIRECCIONABLES). IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "BASE 4098-9770 + DETECTOR",
    "notifier": "INTELLIQUAD PLUS"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "cosb",
   "nombre": "Detector combinado humo/CO con base audible",
   "sim": "FA127",
   "tag": "^(CO\\+SB|CO-B)$",
   "tipo": null,
   "desc": "DETECTOR COMBINADO DIRECCIONABLE, HUMO FOTOELÉCTRICO/MONÓXIDO DE CARBONO CON BASE AUDIBLE. (O EQUIVALENTE, BASE AUDIBLE CON DETECCIÓN DE MONÓXIDO DE CARBONO Y UN DETECTOR DE HUMO FOTOELÉCTRICO DIRECCIONABLES). IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "BASE 4098-9771 + DETECTOR",
    "notifier": "INTELLIQUAD PLUS + B200S"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "aom",
   "nombre": "Módulo de salida / control / relay",
   "sim": "FA066",
   "tag": "^(AOM|RLY)$",
   "tipo": null,
   "desc": "MÓDULO DE SALIDA, CONTROL O RELAY DIRECCIONABLE SEGÚN APLICA MONITOREO DE SALIDA, DOBLE CONTACTO INDEPENDIENTE. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4090-9002",
    "notifier": "FRM-1, FCM-1"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "aim",
   "nombre": "Módulo de entrada / monitoreo",
   "sim": "FA064",
   "tag": "^(AIM|ZAM)$",
   "tipo": null,
   "desc": "MÓDULO DE ENTRADA, O MONITOREO DIRECCIONABLE, CAPAZ DE SUPERVISAR ENTRADAS DE CONTACTOS SECOS. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4090-9001",
    "notifier": "NOTIFIER FMM-1, FZM-1"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "vs",
   "nombre": "Interruptor de posición de válvula",
   "sim": "FA104",
   "tag": "^VS$",
   "tipo": null,
   "desc": "INTERRUPTOR MONITOR DE POSICIÓN ABIERTA DE VÁLVULA DEL SISTEMA DE SUPRESIÓN, DEBE TENER UN CONTACTO SECO QUE SE CONECTE A UN MÓDULO DE MONITOREO QUE COMUNICA EL ESTADO AL PANEL DE ALARMAS. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "PIBV2",
    "notifier": "NOTIFIER PIBV2"
   },
   "refMarca": {
    "simplex": "SYSTEM SENSOR"
   }
  },
  {
   "id": "wf",
   "nombre": "Interruptor de flujo",
   "sim": "FA090",
   "tag": "^WF$",
   "tipo": null,
   "desc": "INTERRUPTOR MONITOR DE FLUJO, DEBE TENER UN CONTACTO SECO QUE SE CONECTE A UN MÓDULO DE MONITOREO QUE COMUNICA EL ESTADO AL PANEL DE ALARMAS. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "SEGUN CALIBRE TUBERÍA",
    "notifier": "NOTIFIER WFD"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "iso",
   "nombre": "Módulo aislador de lazo",
   "sim": "FA067",
   "tag": "^ISO$",
   "tipo": null,
   "desc": "MÓDULO DE AISLAMIENTO DE CIRCUITO DE CONTROL, DEBE PROTEGER AL CIRCUITO DE CORTOCIRCUITOS, SE DEBEN INSTALAR CADA NIVEL O CADA 25 DISPOSITIVOS O SEGÚN FABRICANTE. UBICACIÓN DEFINIDA EN CAMPO, NO SE INDICAN EN PLANOS. IGUAL O SUPERIOR A REFERENCIA. SE PERMITE EL USO DE BASES AISLADORAS.",
   "ref": {
    "simplex": "4090-9116",
    "notifier": "NOTIFIER ISO-X"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "ss",
   "nombre": "Protección contra sobretensiones",
   "sim": "FA100",
   "tag": "^SS$",
   "tipo": null,
   "desc": "MÓDULO DE PROTECCIÓN CONTRA SOBRETENSIONES PARA LAZO, RED O POTENCIA, DEBE INCLUIR ADECUADA CONEXIÓN A TIERRA PARA DESCARGA, EN CONDUIT SEPARADO. TIPO SEGÚN APLICACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "SLC Y COM. COBRE 2081-9044 NAC 2081-9028",
    "notifier": "PLP-42-S, SL2DIN"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "rps",
   "nombre": "Fuente de poder remota",
   "sim": "FA025",
   "tag": "^RPS$",
   "tipo": null,
   "desc": "FUENTE DE PODER REMOTA DE 24VDC 8AMP, CON BATERÍA Y CARGADOR, DEBE REPORTAR FALLAS DE ALIMENTACIÓN, BATERÍAS Y CIRCUITOS DE NOTIFICACIÓN DE ACUERDO A NFPA 72. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "NAC CONVENCIONAL 4009-9201 NAC DIRECCIONABLE 4009-9401 IDNAC 4009-9601",
    "notifier": "FCPS 24S8"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "amp",
   "nombre": "Panel de amplificadores",
   "sim": "FA002",
   "tag": "^AMP$",
   "tipo": null,
   "desc": "PANEL DE AMPLIFICADORES DIGITALES REMOTOS 70.7V Ó 25V RMS POWER LIMITED, CON GABINETE, COBRE O FIBRA SEGÚN DIAGRAMA UNIFILAR, 6 CIRCUITOS DE SALIDA. DEBE INCLUIR FUENTE CON BATERÍAS. ALIMENTACIÓN 120V. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4100-9600 4100-9601 TRANSPONDER MODO LOCAL",
    "notifier": "NOTIFIER DAA2 ONIX SERIES + BDA. DEPENDE DE PANEL UTILIZADO."
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "faa",
   "nombre": "Anunciador remoto",
   "sim": "FA013",
   "tag": "^ANN$",
   "tipo": null,
   "desc": "ANUNCIADOR REMOTO DEL SISTEMA EN RECEPCIÓN O EN UBICACIÓN PERMANENTEMENTE OCUPADA, ALIMENTACIÓN 24VDC Y COMUNICACIÓN DIRECTA Y DEDICADA CON EL PANEL PRINCIPAL MEDIANTE 6x14 STP, DEBE INCLUIR CAJA. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4603-9101",
    "notifier": "NOTIFIER ONIX SERIES FDU-80 + ABF-1DB. DEPENDE DE PANEL UTILIZADO."
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "facp",
   "nombre": "Panel de alarma contra incendio",
   "sim": "FA016",
   "tag": "^(FACP|TRP)$",
   "tipo": null,
   "desc": "PANEL PRINCIPAL, DEBE INCLUIR: GABINETE, BATERÍAS, TECLADO, DISPLAY DE 80 O MAS CARACTERES, CAPACIDAD DE RED, CONTROL Y NOTIFICACIÓN SEGÚN DIAGRAMA UNIFILAR Y DISPOSITIVOS EN PLANTA, SALIDAS POWER LIMITED UL 864. PROYECTOS CON VOCEO DEBEN TAMBIÉN INCLUIR: GABINETE, BATERÍAS, 8 MINUTOS DE AUDIO PREGRABADO, TECLADO DE SELECCIÓN DE ZONAS, MICRÓFONO \"PUSH TO TALK\", AMPLIFICADORES DIGITALES PARA CIRCUITOS DE VOCEO, VER DESCRIPCIÓN DE AMP, SALIDAS POWER LIMITED. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4100ES",
    "notifier": "NOTIFIER ONIX SERIES (VOCEO) DVC SERIES+DVC-KD FIRE-WARDEN (CUANDO APLIQUE)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "avc",
   "nombre": "Estrobo con sirena de cielo",
   "sim": "FA142",
   "tag": null,
   "tipo": "^Sirena \\+ estrobo de cielo",
   "desc": "LUZ ESTROBOSCOPICA CON SIRENA DE MONTAJE EN CIELO (23VDC-30VDC) CON CAPACIDAD VARIABLE DE CANDELAS Y TAPS DE POTENCIA, CON SU CAJA O MONTAJES SEGÚN CORRESPONDA. MODELO, COBERTORES Y ACCESORIOS SEGÚN CONDICIONES DE INSTALACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4906-9128 49AV-APPLC DIRECCIONABLE",
    "notifier": "NOTIFIER PC2R (INTERIORES), PC2RK (EXTERIORES)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "spc",
   "nombre": "Estrobo con parlante de cielo",
   "sim": "FA154",
   "tag": null,
   "tipo": "^Parlante \\+ estrobo de cielo",
   "desc": "LUZ ESTROBOSCOPICA CON PARLANTE DE MONTAJE EN CIELO (23VDC-30VDC) CON CAPACIDAD VARIABLE DE CANDELAS Y TAPS DE POTENCIA, CON SU CAJA O MONTAJES SEGÚN CORRESPONDA. MODELO, COBERTORES Y ACCESORIOS SEGÚN CONDICIONES DE INSTALACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4906-9154 ESTANDAR 49SV-APPLC DIRECCIONABLE ALTA FIDELIDADO/CANDELAS 49HFV-APPLC 49SVH-APPLC 49HFVH-APPLC",
    "notifier": "NOTIFIER SPSCR (INTERIORES), SPSCRK (EXTERIORES)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "avp",
   "nombre": "Estrobo con sirena de pared",
   "sim": "FA142",
   "tag": null,
   "tipo": "^Sirena \\+ estrobo de pared",
   "desc": "LUZ ESTROBOSCOPICA CON SIRENA  DE MONTAJE EN PARED (23VDC-30VDC)  CON CAPACIDAD VARIABLE DE CANDELAS Y TAPS DE POTENCIA, CON SU CAJA O MONTAJES . MODELO, COBERTORES Y ACCESORIOS SEGÚN CONDICIONES DE INSTALACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4906-9127 49AV-WRF DIRECCIONABLE 59AV-WRF DIRECCIONABLE LED",
    "notifier": "NOTIFIER P2R (INTERIORES), P2RK (EXTERIORES)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "spp",
   "nombre": "Estrobo con parlante de pared",
   "sim": "FA155",
   "tag": null,
   "tipo": "^Parlante \\+ estrobo de pared",
   "desc": "LUZ ESTROBOSCOPICA CON PARLANTE DE MONTAJE EN PARED (23VDC-30VDC) CON CAPACIDAD VARIABLE DE CANDELAS Y TAPS DE POTENCIA, CON SU CAJA O MONTAJES . MODELO, COBERTORES Y ACCESORIOS SEGÚN CONDICIONES DE INSTALACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4906-9151 49SV-APPLW DIRECCIONABLE 49HFV ALTA FIDELIDAD",
    "notifier": "NOTIFIER SPSR (INTERIORES), SPSRK (EXTERIORES)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "stp",
   "nombre": "Estrobo de pared",
   "sim": "FA153",
   "tag": null,
   "tipo": "^Estrobo de pared",
   "desc": "LUZ ESTROBOSCOPICA (23VDC-30VDC)  DIRECCIONABLE ( A MENOS QUE SE ESPECIFIQUE CONVENCIONAL) DE MONTAJE EN PARED, CAPACIDAD VARIABLE DE CANDELAS SEGÚN SE INDICA EN PLANOS. MODELO, COBERTORES O ACCESORIOS SEGÚN CONDICIONES DE INSTALACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4904-9168 ESTANDAR 49VO-WRF DIRECCIONABLE 59VO-WRF DIRECCIONABLE LED",
    "notifier": "NOTIFIER SR (INTERIORES) SRK (EXTERIORES)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "stc",
   "nombre": "Estrobo de cielo",
   "sim": "FA152",
   "tag": null,
   "tipo": "^Estrobo de cielo",
   "desc": "LUZ ESTROBOSCOPICA DIRECCIONABLE ( A MENOS QUE SE ESPECIFIQUE CONVENCIONAL) DE MONTAJE EN CIELO, CAPACIDAD VARIABLE DE CANDELAS SEGÚN SE INDICA EN PLANOS. MODELO Y ACCESORIOS SEGÚN CONDICIONES DE INSTALACIÓN. IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "4904 9183 ESTANDAR 49VO-APPLC DIRECCIONABLE",
    "notifier": "NOTIFIER SCRL (INTERIORES) SCRK (EXTERIORES)"
   },
   "refMarca": {
    "simplex": ""
   }
  },
  {
   "id": "jack",
   "nombre": "Placa con jack para teléfono de bomberos",
   "sim": "FA166",
   "tag": "^J(-PH)?$",
   "tipo": null,
   "desc": "PLACA CON JACK PARA TELÉFONO DE USO EXCLUSIVO POR PARTE DE BOMBEROS. LA PARTE FRONTAL ESTARÁ MARCADA COMO \"FIRE EMERGENCY PHONE\" O SU TRADUCCIÓN EN ESPAÑOL.  IGUAL O SUPERIOR A REFERENCIA.",
   "ref": {
    "simplex": "2084-9023 JACK 2 UNITS 2084-9014 PHONE",
    "notifier": ""
   },
   "refMarca": {
    "simplex": ""
   }
  }
 ]
};
(function (g) {
  'use strict';
  var D = g.SIMBOLOGIA_CDCLH;
  D.filas.forEach(function (r) { r._tag = r.tag ? new RegExp(r.tag) : null; r._tipo = r.tipo ? new RegExp(r.tipo) : null; });
  var POR_ID = {}; D.filas.forEach(function (r) { POR_ID[r.id] = r; });
  /* fila de la simbología a la que pertenece un dispositivo del catálogo (por tipo o por tag) o null */
  function filaDe(d) {
    if (!d) return null;
    for (var i = 0; i < D.filas.length; i++) {
      var r = D.filas[i];
      if (r._tipo && r._tipo.test(d.tipo || '')) return r;
    }
    for (var j = 0; j < D.filas.length; j++) {
      var q = D.filas[j];
      if (q._tag && q._tag.test(d.tag || '')) return q;
    }
    return null;
  }
  g.Simbologia = { fuente: D.fuente, filas: D.filas, porId: function (id) { return POR_ID[id] || null; }, filaDe: filaDe };
})(window);
