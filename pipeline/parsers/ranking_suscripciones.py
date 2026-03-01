"""Parse 17-RKGestoras por categoria (suscripciones).csv — gestora flows by category."""
from .spanish_csv import read_csv_rows, parse_spanish_number, find_file
import os


def parse_ranking_suscripciones(folder):
    """Parse gestora subscriptions by category file."""
    # This file has different name pattern
    datos = os.path.join(folder, "Datos Generales")
    filepath = None
    if os.path.isdir(datos):
        for f in os.listdir(datos):
            if "por categoria" in f.lower() and f.endswith('.csv'):
                filepath = os.path.join(datos, f)
                break
    if not filepath:
        return []

    headers, rows = read_csv_rows(filepath, skip_rows=1, encoding='latin-1')
    if not headers:
        return []

    results = []
    for row in rows:
        if not row or len(row) < 3:
            continue
        name = row[0].strip()
        if not name or name.upper().startswith('TOTAL'):
            continue

        record = {'name': name, 'flows': {}}
        for i, h in enumerate(headers[1:], 1):
            if i < len(row) and h.strip() and h.strip() != 'Total general':
                val = parse_spanish_number(row[i])
                if val is not None:
                    record['flows'][h.strip()] = val

        # Total
        for i in range(len(row) - 1, 0, -1):
            h = headers[i].strip() if i < len(headers) else ''
            if 'Total' in h:
                val = parse_spanish_number(row[i])
                if val is not None:
                    record['total_net_flows'] = val
                break

        results.append(record)
    return results
