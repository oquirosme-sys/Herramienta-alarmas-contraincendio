# -*- coding: utf-8 -*-
"""Convierte los bloques del DXF NFPA 170 (cap. 8) a js/simbolos-nfpa170.js
   (geometría simple: L línea, P polilínea, C círculo, T texto, H relleno; 1 unidad = 1 mm impreso).
   Uso: python excel/extraer_simbolos_nfpa170.py  <ruta.dxf>  """
import sys, json, re, os
import ezdxf
from ezdxf import path as ezpath

src = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\Sinergia01\Downloads\NFPA170_Cap8_Simbolos_Alarma_Incendio.dxf'
d = ezdxf.readfile(src)
ms = d.modelspace()

# Nombre legible y tabla desde los textos de la leyenda (el texto inmediato anterior al id del bloque)
textos = sorted([(e.dxf.insert.x, -e.dxf.insert.y, e.dxf.text) for e in ms if e.dxftype() == 'TEXT'], key=lambda t: (t[0] > 150, t[1]))
leyenda = {}
tabla_actual = ''
buf = []
for x, y, t in textos:
    if t.startswith('Table '):
        tabla_actual = t; buf = []; continue
    if t.startswith('FA_'):
        leyenda[t] = (' '.join(buf).strip(), tabla_actual); buf = []
    elif not t.startswith('NFPA 170'):
        buf.append(t)

def r(v): return round(v, 2)

def flat(e):
    p = ezpath.make_path(e)
    return [[r(v.x), r(v.y)] for v in p.flattening(0.05)], p.is_closed

salida = []
for b in d.blocks:
    if not b.name.startswith('FA_'): continue
    items = []
    for e in b:
        k = e.dxftype()
        if k == 'LINE':
            items.append(['L', r(e.dxf.start.x), r(e.dxf.start.y), r(e.dxf.end.x), r(e.dxf.end.y)])
        elif k == 'CIRCLE':
            items.append(['C', r(e.dxf.center.x), r(e.dxf.center.y), r(e.dxf.radius)])
        elif k in ('LWPOLYLINE', 'ELLIPSE', 'ARC'):
            pts, cerr = flat(e)
            if len(pts) > 1: items.append(['P', 1 if cerr else 0, pts])
        elif k == 'HATCH':
            for sub in ezpath.make_path(e).sub_paths():
                pts = [[r(v.x), r(v.y)] for v in sub.flattening(0.05)]
                if len(pts) > 2: items.append(['H', pts])
        elif k == 'TEXT':
            items.append(['T', r(e.dxf.insert.x), r(e.dxf.insert.y), r(e.dxf.height), e.dxf.text])
    # centrar el símbolo en su caja (sin contar textos): el punto de inserción queda en el centro
    xs, ys = [], []
    for it in items:
        if it[0] == 'L': xs += [it[1], it[3]]; ys += [it[2], it[4]]
        elif it[0] == 'C': xs += [it[1] - it[3], it[1] + it[3]]; ys += [it[2] - it[3], it[2] + it[3]]
        elif it[0] in ('P', 'H'):
            for q in (it[2] if it[0] == 'P' else it[1]): xs.append(q[0]); ys.append(q[1])
    if not xs:
        xs = [it[1] for it in items if it[0] == 'T'] or [0]; ys = [it[2] for it in items if it[0] == 'T'] or [0]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    for it in items:
        if it[0] == 'L': it[1:5] = [r(it[1] - cx), r(it[2] - cy), r(it[3] - cx), r(it[4] - cy)]
        elif it[0] == 'C': it[1:3] = [r(it[1] - cx), r(it[2] - cy)]
        elif it[0] == 'P': it[2] = [[r(q[0] - cx), r(q[1] - cy)] for q in it[2]]
        elif it[0] == 'H': it[1] = [[r(q[0] - cx), r(q[1] - cy)] for q in it[1]]
        elif it[0] == 'T': it[1:3] = [r(it[1] - cx), r(it[2] - cy)]
    m = re.match(r'FA_(8-\d(?:-\d)?)_(\d+)_(.*)', b.name)
    nombre, tabla = leyenda.get(b.name, (m.group(3).replace('_', ' '), 'Table ' + m.group(1)))
    salida.append({'id': 'FA' + m.group(2), 'tabla': m.group(1), 'nombre': nombre or m.group(3).replace('_', ' '), 'g': items})

destino = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'js', 'simbolos-nfpa170.js')
with open(destino, 'w', encoding='utf-8') as f:
    f.write('/* Símbolos NFPA 170 (2018) cap. 8, extraídos de NFPA170_Cap8_Simbolos_Alarma_Incendio.dxf. 1 unidad = 1 mm impreso.\n'
            ' * g: L=línea[x1,y1,x2,y2]  P=polilínea[cerrada,pts]  C=círculo[cx,cy,r]  H=relleno[pts]  T=texto[x,y,alto,txt]. Generado: no editar. */\n')
    f.write('window.SIMBOLOS_NFPA170 = ' + json.dumps(salida, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(salida), 'símbolos →', destino, os.path.getsize(destino) // 1024, 'KB')
