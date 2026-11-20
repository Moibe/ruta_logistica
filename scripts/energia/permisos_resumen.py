"""Private generation that came into service from 2019 on, from the CNE permits list.

usage: permisos_resumen.py <xlsx> <out json>
"""
import collections
import datetime
import json
import sys

import openpyxl

wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
ws = wb['Permisos Vigentes']
filas = list(ws.iter_rows(values_only=True))
h = [str(c or '').strip() for c in filas[4]]
col = {n: i for i, n in enumerate(h)}


def c(row, prefijo):
    for n, i in col.items():
        if n.startswith(prefijo):
            return row[i]
    return None


def mw(v):
    try:
        return float(str(v).replace(',', '').strip())
    except (TypeError, ValueError):
        return 0.0


def fecha(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    return None


salida = []
estados = collections.Counter()
for row in filas[5:]:
    if not row or row[0] is None:
        continue
    quien = str(c(row, 'Permisionario') or '')
    if 'Comisión Federal' in quien or 'CFE ' in quien or quien.startswith('CFE'):
        es_cfe = True
    else:
        es_cfe = False
    f = fecha(c(row, 'Fecha de Entrada')) or fecha(c(row, 'Fecha Entrada Operación Mejo'))
    estado = str(c(row, 'Estado Actual') or '').strip()
    estados[estado] += 1
    salida.append({
        'permisionario': quien.strip(),
        'cfe': es_cfe,
        'modalidad': str(c(row, 'Modalidad') or '').strip(),
        'mw': mw(c(row, 'Capacidad Autorizada')),
        'tecnologia': str(c(row, 'Tecnolog') or '').strip(),
        'energetico': str(c(row, 'Energético') or '').strip(),
        'operacion': f.isoformat() if f else None,
        'estado': estado,
        'entidad': str(c(row, 'Entidad') or '').strip(),
        'municipio': str(c(row, 'Municipio') or '').strip(),
        'inversion_musd': mw(c(row, 'Inversión Estimada')),
    })

json.dump(salida, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print('permisos vigentes', len(salida), '| estados:', dict(estados))

priv = [p for p in salida if not p['cfe']]
nuevos = [p for p in priv if p['operacion'] and p['operacion'] >= '2019-01-01' and p['estado'] == 'En operación']
print('privados en operación con entrada desde 2019:', len(nuevos), 'permisos,', round(sum(p['mw'] for p in nuevos)), 'MW')
por_año = collections.defaultdict(lambda: collections.Counter())
for p in nuevos:
    por_año[p['operacion'][:4]][p['tecnologia'][:22]] += p['mw']
for a in sorted(por_año):
    print('  ', a, round(sum(por_año[a].values())), 'MW |', ', '.join('%s %d' % (k, v) for k, v in por_año[a].most_common(4)))
futuros = [p for p in priv if p['estado'] != 'En operación']
print('privados no en operación:', len(futuros), round(sum(p['mw'] for p in futuros)), 'MW', collections.Counter(p['estado'] for p in futuros).most_common(6))
cfe = [p for p in salida if p['cfe']]
print('permisos de la CFE:', len(cfe), round(sum(p['mw'] for p in cfe)), 'MW')
grandes = sorted(nuevos, key=lambda p: -p['mw'])[:12]
for p in grandes:
    print('    %6d MW %s %s, %s · %s · %s' % (p['mw'], p['operacion'], p['municipio'][:22], p['entidad'], p['tecnologia'][:24], p['permisionario'][:40]))
