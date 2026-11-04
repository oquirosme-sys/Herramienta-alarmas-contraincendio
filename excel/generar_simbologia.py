# -*- coding: utf-8 -*-
"""Genera js/simbologia-cdclh.js a partir de las dos láminas CDCLH-001S (Simbología de alarmas contra incendio, Circuito S.A.):
   versión Simplex y versión Notifier. Se extrae por filas (símbolo / descripción / referencia) con PyMuPDF.
   Uso:  python excel/generar_simbologia.py  <Simplex.pdf>  <Notifier.pdf>
   (por defecto toma los de la carpeta Descargas). Las descripciones son las de la simbología; las referencias de cada fabricante se muestran
   en el diagrama junto a los modelos cargados en el catálogo. """
import fitz, sys, os, json, re

base = r'C:\Users\Sinergia01\Downloads'
pdfs = {
    'simplex': sys.argv[1] if len(sys.argv) > 1 else os.path.join(base, 'CDCLH-001S (Simbologia Alarmas Contra Incendio)-Model2.pdf'),
    'notifier': sys.argv[2] if len(sys.argv) > 2 else os.path.join(base, 'CDCLH-001S (Simbologia Alarmas Contra Incendio)-Model.pdf'),
}

def filas(pdf):
    p = fitz.open(pdf)[0]
    sp, vistos = [], set()
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].strip()
                if not t: continue
                k = (t, round(s['bbox'][0] / 3), round(s['bbox'][1] / 3))   # la lámina trae el texto repetido: se descartan duplicados
                if k in vistos: continue
                vistos.add(k); sp.append((s['bbox'][0], s['bbox'][1], s['bbox'][2], s['bbox'][3], t))
    hs = set()
    for dr in p.get_drawings():
        for it in dr['items']:
            if it[0] == 'l' and abs(it[1].y - it[2].y) < 0.5 and abs(it[1].x - it[2].x) > 200: hs.add(round(it[1].y, 1))
            elif it[0] == 're' and it[1].width > 200 and it[1].height < 1.5: hs.add(round(it[1].y0, 1))
    L = []
    for y in sorted(hs):
        if not L or y - L[-1] > 6: L.append(y)
    out = []
    for i in range(len(L) - 1):
        r = [s for s in sp if L[i] - 1 <= (s[1] + s[3]) / 2 < L[i + 1] + 1]
        def col(a, b):
            q = sorted([s for s in r if a <= s[0] < b], key=lambda s: (round(s[1] / 5), s[0]))
            return ' '.join(s[4] for s in q)
        out.append({'desc': col(1050, 1430), 'ref': col(1430, 9999)})
    return out

F = {k: filas(v) for k, v in pdfs.items()}

# (id, nombre corto, símbolo NFPA 170, tag del catálogo, tipo del catálogo, fila en la lámina)
FILAS = [
    ('sdh', 'Detector de humo fotoeléctrico', 'FA132', r'^SDH', None, 0),
    ('sdt', 'Detector de temperatura', 'FA079', r'^SDT', None, 1),
    ('em', 'Estación manual', 'FA118', r'^EM$', None, 2),
    ('duct', 'Detector de humo para ducto', 'FA133', r'^(SD-DUCTO|RTS)$', None, 3),
    ('sb', 'Base audible con detector', 'FA134', r'^SB$', None, 4),
    ('bh', 'Detector de humo de haz de luz', 'FA130', r'^BH$', None, 5),
    ('co', 'Detector combinado humo/CO', 'FA127', r'^CO$', None, 6),
    ('cosb', 'Detector combinado humo/CO con base audible', 'FA127', r'^(CO\+SB|CO-B)$', None, 7),
    ('aom', 'Módulo de salida / control / relay', 'FA066', r'^(AOM|RLY)$', None, 8),
    ('aim', 'Módulo de entrada / monitoreo', 'FA064', r'^(AIM|ZAM)$', None, 9),
    ('vs', 'Interruptor de posición de válvula', 'FA104', r'^VS$', None, 10),
    ('wf', 'Interruptor de flujo', 'FA090', r'^WF$', None, 11),
    ('iso', 'Módulo aislador de lazo', 'FA067', r'^ISO$', None, 12),
    ('ss', 'Protección contra sobretensiones', 'FA100', r'^SS$', None, 13),
    ('rps', 'Fuente de poder remota', 'FA025', r'^RPS$', None, 14),
    ('amp', 'Panel de amplificadores', 'FA002', r'^AMP$', None, 15),
    ('faa', 'Anunciador remoto', 'FA013', r'^ANN$', None, 16),
    ('facp', 'Panel de alarma contra incendio', 'FA016', r'^(FACP|TRP)$', None, 17),
    ('avc', 'Estrobo con sirena de cielo', 'FA142', None, r'^Sirena \+ estrobo de cielo', 18),
    ('spc', 'Estrobo con parlante de cielo', 'FA154', None, r'^Parlante \+ estrobo de cielo', 19),
    ('avp', 'Estrobo con sirena de pared', 'FA142', None, r'^Sirena \+ estrobo de pared', 20),
    ('spp', 'Estrobo con parlante de pared', 'FA155', None, r'^Parlante \+ estrobo de pared', 21),
    ('stp', 'Estrobo de pared', 'FA153', None, r'^Estrobo de pared', 22),
    ('stc', 'Estrobo de cielo', 'FA152', None, r'^Estrobo de cielo', 23),
    ('jack', 'Placa con jack para teléfono de bomberos', 'FA166', r'^J(-PH)?$', None, 28),
]

def limpia_ref(t):
    t = re.sub(r'^\s*REFERENCIA\s*(SIMPLEX|NOTIFIER|SYSTEM SENSOR)?\s*:?\s*', '', t)
    return t.strip()

salida = []
for (i, nom, sim, tag, tipo, fila) in FILAS:
    d1, d2 = F['simplex'][fila], F['notifier'][fila]
    desc = d1['desc'] or d2['desc']
    prefijo = 'SYSTEM SENSOR' if re.match(r'\s*REFERENCIA\s+SYSTEM SENSOR', d1['ref']) else ''
    salida.append({'id': i, 'nombre': nom, 'sim': sim, 'tag': tag, 'tipo': tipo, 'desc': desc,
                   'ref': {'simplex': limpia_ref(d1['ref']), 'notifier': limpia_ref(d2['ref'])},
                   'refMarca': {'simplex': prefijo}})

destino = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'js', 'simbologia-cdclh.js')
with open(destino, 'w', encoding='utf-8') as f:
    f.write('/* Simbología de alarmas contra incendio — CDCLH-001S (Circuito S.A.), versiones Simplex y Notifier.\n'
            ' * Descripciones y referencias por fabricante tomadas de las láminas; tag/tipo permiten enlazar cada fila con los modelos del catálogo.\n'
            ' * Generado con excel/generar_simbologia.py: no editar a mano. */\n')
    f.write('window.SIMBOLOGIA_CDCLH = ' + json.dumps({'fuente': 'CDCLH-001S Simbología de alarmas contra incendio (Circuito S.A.)', 'filas': salida}, ensure_ascii=False, indent=1) + ';\n')
    f.write("""(function (g) {
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
""")
print(len(salida), 'filas →', destino, os.path.getsize(destino) // 1024, 'KB')
