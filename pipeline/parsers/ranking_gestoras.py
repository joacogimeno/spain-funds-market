"""Parse 17-RKGestoras.csv — wide format gestora ranking with category breakdown."""
from .spanish_csv import read_csv_rows, parse_spanish_number, find_file


def parse_ranking_gestoras(folder):
    """Parse gestora ranking file. Returns list of gestora records with category AUMs."""
    filepath = find_file(folder, "17-RKGestoras.csv")
    if filepath and "por categoria" in filepath:
        filepath = None
    if not filepath:
        # Try direct pattern
        import os
        datos = os.path.join(folder, "Datos Generales")
        if os.path.isdir(datos):
            for f in os.listdir(datos):
                if "RKGestoras" in f and "por categoria" not in f and f.endswith('.csv'):
                    filepath = os.path.join(datos, f)
                    break
    if not filepath:
        return []

    headers, rows = read_csv_rows(filepath, skip_rows=1)
    if not headers:
        return []

    # Parse the wide header: Nombre; Nº de fondos; Cat1; Nº de fondos; Cat2; ...
    # Category columns are between "Nº de fondos" columns
    categories = []
    for i, h in enumerate(headers):
        h = h.strip()
        if h and h != 'Nombre' and h != 'Nº de fondos' and h != '% Total Patrimonio' and h != 'Total Patrimonio':
            categories.append((i, h))

    results = []
    for row in rows:
        if not row or len(row) < 3:
            continue
        name = row[0].strip()
        if not name or name.startswith('TOTAL'):
            continue

        record = {'name': name, 'categories': {}}
        total_patrim = None
        pct_total = None

        # Parse category AUM values (they follow "Nº de fondos" columns)
        for col_idx, cat_name in categories:
            if col_idx < len(row):
                val = parse_spanish_number(row[col_idx])
                if val is not None:
                    record['categories'][cat_name] = val

        # Find total and percentage - they're at the end
        for i in range(len(row) - 1, max(0, len(row) - 6), -1):
            val = parse_spanish_number(row[i])
            if val is not None:
                h = headers[i].strip() if i < len(headers) else ''
                if '% Total' in h or '%' in h:
                    pct_total = val
                elif 'Total' in h or (val > 1000 and total_patrim is None):
                    total_patrim = val

        record['total_patrimonio'] = total_patrim
        record['pct_total'] = pct_total
        # Also count total funds
        fund_count = 0
        for i, h in enumerate(headers):
            if 'Nº de fondos' in h and i < len(row):
                v = parse_spanish_number(row[i])
                if v is not None:
                    fund_count += int(v)
        record['num_fondos'] = fund_count

        results.append(record)
    return results
