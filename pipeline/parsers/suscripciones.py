"""Parse 07-Sus&Reemb.csv — subscriptions and redemptions by category."""
from .spanish_csv import read_csv_rows, parse_spanish_number, find_file


def parse_suscripciones(folder):
    """Parse subscriptions/redemptions file. Returns list of category records."""
    filepath = find_file(folder, "07-Sus")
    if not filepath:
        return []

    headers, rows = read_csv_rows(filepath, skip_rows=1)
    if not headers:
        return []

    results = []
    for row in rows:
        if not row or len(row) < 4:
            continue
        tipo = row[0].strip()
        if not tipo or tipo.startswith('TOTALES'):
            continue

        record = {'category': tipo}
        # Headers: Tipo fondo; Suscripciones mes; Reembolsos mes; Suscripciones netas mes;
        #          Suscripciones año; Reembolsos año; Suscripciones netas año
        field_map = {
            1: 'subs_month',
            2: 'redemp_month',
            3: 'net_month',
            4: 'subs_year',
            5: 'redemp_year',
            6: 'net_year',
        }
        for idx, key in field_map.items():
            if idx < len(row):
                val = parse_spanish_number(row[idx])
                if val is not None:
                    record[key] = val
        results.append(record)
    return results
