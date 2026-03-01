"""Parse 13-RkGruposEuros.csv — hierarchical group rankings."""
from .spanish_csv import read_csv_rows, parse_spanish_number, find_file


def parse_ranking_grupos(folder):
    """Parse group ranking file. Returns list of group records with sub-gestoras."""
    filepath = find_file(folder, "13-RkGrupos")
    if not filepath:
        return []

    # This file is often ISO-8859-1 encoded
    headers, rows = read_csv_rows(filepath, skip_rows=1, encoding='latin-1')
    if not headers:
        return []

    groups = []
    current_group = None

    for row in rows:
        if not row or len(row) < 4:
            continue

        orden = row[0].strip() if row[0] else ''
        nombre = row[1].strip() if len(row) > 1 else ''
        if not nombre:
            continue

        is_subgroup = nombre.startswith('>>') or nombre.startswith('  >>')
        nombre = nombre.lstrip('>').lstrip().strip()

        record = {
            'name': nombre,
            'num_isin': parse_spanish_number(row[2]) if len(row) > 2 else None,
            'patrimonio': parse_spanish_number(row[3]) if len(row) > 3 else None,
            'var_1y': parse_spanish_number(row[4]) if len(row) > 4 else None,
            'var_6m': parse_spanish_number(row[5]) if len(row) > 5 else None,
            'var_3m': parse_spanish_number(row[6]) if len(row) > 6 else None,
            'var_1m': parse_spanish_number(row[7]) if len(row) > 7 else None,
            'var_ytd': parse_spanish_number(row[8]) if len(row) > 8 else None,
        }

        if is_subgroup:
            if current_group:
                current_group['gestoras'].append(record)
        else:
            if orden:
                record['rank'] = int(orden) if orden.isdigit() else None
            record['gestoras'] = []
            current_group = record
            groups.append(record)

    return groups
