"""Parse 09-Rentab.csv — returns by category across time horizons."""
from .spanish_csv import read_csv_rows, parse_spanish_number, find_file


def parse_rentabilidad(folder):
    """Parse returns file. Returns list of category records with returns."""
    filepath = find_file(folder, "09-Rentab")
    if not filepath:
        return []

    headers, rows = read_csv_rows(filepath, skip_rows=1)
    if not headers:
        return []

    results = []
    for row in rows:
        if not row or len(row) < 3:
            continue
        nombre = row[0].strip()
        if not nombre or nombre.startswith('TOTALES'):
            continue

        record = {'category': nombre}
        # Headers: Nombre;Mes;Año;1 año;3 años;5 años;10 años;15 años;20 años;25 años;30 años;Patrimonio
        field_map = {
            1: 'return_month',
            2: 'return_ytd',
            3: 'return_1y',
            4: 'return_3y',
            5: 'return_5y',
            6: 'return_10y',
            7: 'return_15y',
            8: 'return_20y',
            9: 'return_25y',
            10: 'return_30y',
            11: 'patrimonio',
        }
        for idx, key in field_map.items():
            if idx < len(row):
                val = parse_spanish_number(row[idx])
                if val is not None:
                    record[key] = val
        results.append(record)
    return results
