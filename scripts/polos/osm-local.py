# OpenStreetMap from a Geofabrik extract (.osm.pbf) instead of Overpass: answers the generator's
# queries and writes each answer as Overpass would (`out geom`).
#
#   python scripts/polos/osm-local.py <consultas.json>
#
# consultas.json: {"pbf": path, "salidas": [{"archivo": path, "partes": [[tipo, caja, filtros]]}]}
#   tipo: "way" or "node"; caja: "south,west,north,east"; filtros: [[key], [key, "=", v],
#   [key, "~", regex], [key, "!"]] (the key exists, equals, matches, or is absent).
# A way is in a box when one of its nodes is, or one of its sides crosses it.
#
# Two passes, without an index of every node of the country (it doesn't fit in memory): the first
# keeps the coordinates of the nodes near the boxes asked for (MARGEN degrees around them) and
# answers the node queries; the second reads the tagged ways and draws them with those nodes. A
# way is cut where it goes farther than the margin, which is more than the generator draws.
#
# Needs pyosmium: python -m pip install --user osmium
import json
import re
import sys
import time

import osmium

MARGEN = 0.3


def pasa(tags, filtros):
    for f in filtros:
        k = f[0]
        if len(f) == 1:
            if k not in tags:
                return False
        elif f[1] == '!':
            if k in tags:
                return False
        elif f[1] == '=':
            if tags.get(k) != f[2]:
                return False
        elif f[1] == '~':
            if k not in tags or not re.search(f[2], tags[k]):
                return False
    return True


def cruza(a, b, caja):
    """Does the side a→b (lon, lat) cross the box (Liang–Barsky)?"""
    s, w, n, e = caja
    x0, y0 = a
    dx, dy = b[0] - x0, b[1] - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - w), (dx, e - x0), (-dy, y0 - s), (dy, n - y0)):
        if p == 0:
            if q < 0:
                return False
        else:
            t = q / p
            if p < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
            if t0 > t1:
                return False
    return True


def dentro(lon, lat, caja):
    s, w, n, e = caja
    return s <= lat <= n and w <= lon <= e


def main():
    pedido = json.load(open(sys.argv[1], encoding='utf-8'))
    salidas = pedido['salidas']
    for sal in salidas:
        sal['elementos'] = []
        sal['partes'] = [(t, [float(x) for x in c.split(',')], f) for t, c, f in sal['partes']]
    cajas = [c for sal in salidas for _, c, _ in sal['partes']]
    anchas = [(s - MARGEN, w - MARGEN, n + MARGEN, e + MARGEN) for s, w, n, e in cajas]
    # Join overlapping wide boxes' test into one outer box first: most nodes are far from all.
    S, W, N, E = min(c[0] for c in anchas), min(c[1] for c in anchas), max(c[2] for c in anchas), max(c[3] for c in anchas)
    claves = sorted({f[0] for sal in salidas for _, _, fs in sal['partes'] for f in fs if len(f) == 1 or f[1] != '!'})
    nodos_pedidos = [sal for sal in salidas if any(t == 'node' for t, _, _ in sal['partes'])]
    t0 = time.time()

    # Pass 1: the nodes near the boxes, and the node queries.
    coords = {}
    for o in osmium.FileProcessor(pedido['pbf'], osmium.osm.NODE):
        loc = o.location
        lon, lat = loc.lon, loc.lat
        if not (S <= lat <= N and W <= lon <= E):
            continue
        if not any(c[0] <= lat <= c[2] and c[1] <= lon <= c[3] for c in anchas):
            continue
        coords[o.id] = (lon, lat)
        if nodos_pedidos and len(o.tags):
            tags = {t.k: t.v for t in o.tags}
            for sal in nodos_pedidos:
                if any(t == 'node' and pasa(tags, f) and dentro(lon, lat, c) for t, c, f in sal['partes']):
                    sal['elementos'].append({'type': 'node', 'id': o.id, 'lat': lat, 'lon': lon, 'tags': tags})
    print(f'{len(coords):,} nodos cerca de las cajas ({time.time() - t0:.0f} s)')

    # Pass 2: the tagged ways (filtered in C++), drawn with those nodes.
    for o in osmium.FileProcessor(pedido['pbf'], osmium.osm.WAY).with_filter(osmium.filter.KeyFilter(*claves)):
        geom = [coords[nd.ref] for nd in o.nodes if nd.ref in coords]
        if len(geom) < 2:
            continue
        tags = {t.k: t.v for t in o.tags}
        for sal in salidas:
            for t, c, f in sal['partes']:
                if t != 'way' or not pasa(tags, f):
                    continue
                if any(dentro(x, y, c) for x, y in geom) or any(cruza(geom[i], geom[i + 1], c) for i in range(len(geom) - 1)):
                    sal['elementos'].append({'type': 'way', 'id': o.id, 'tags': tags, 'geometry': [{'lat': y, 'lon': x} for x, y in geom]})
                    break
    print(f'vías leídas ({time.time() - t0:.0f} s)')

    for sal in salidas:
        with open(sal['archivo'], 'w', encoding='utf-8') as h:
            json.dump({'generator': 'osm-local.py (Geofabrik)', 'elements': sal['elementos']}, h)
        print(f"{sal['archivo']}: {len(sal['elementos'])} elementos")


main()
