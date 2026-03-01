"""Parse individual fund CSVs (19-45) from Categorias Fondos folder."""
from .spanish_csv import read_csv_rows, parse_spanish_number, find_category_file
from ..config import CATEGORY_FILE_MAP


def parse_single_category(folder, file_num):
    """Parse a single category fund file. Returns list of fund records."""
    filepath = find_category_file(folder, file_num)
    if not filepath:
        return []

    headers, rows = read_csv_rows(filepath, skip_rows=1)
    if not headers:
        return []

    results = []
    for row in rows:
        if not row or len(row) < 5:
            continue
        # Skip summary rows (Rentabilidad media, etc.)
        ranking = row[0].strip() if row[0] else ''
        if not ranking or not ranking.isdigit():
            continue

        isin = row[1].strip() if len(row) > 1 else ''
        if not isin or len(isin) < 5:
            continue

        record = {
            'ranking': int(ranking),
            'isin': isin,
            'cnmv': row[2].strip() if len(row) > 2 else '',
            'name': row[3].strip() if len(row) > 3 else '',
            'nav': parse_spanish_number(row[4]) if len(row) > 4 else None,
            'return_month': parse_spanish_number(row[5]) if len(row) > 5 else None,
            'return_ytd': parse_spanish_number(row[6]) if len(row) > 6 else None,
            'return_1y': parse_spanish_number(row[7]) if len(row) > 7 else None,
            'return_3y': parse_spanish_number(row[8]) if len(row) > 8 else None,
            'return_5y': parse_spanish_number(row[9]) if len(row) > 9 else None,
            'return_10y': parse_spanish_number(row[10]) if len(row) > 10 else None,
            'return_15y': parse_spanish_number(row[11]) if len(row) > 11 else None,
            'return_20y': parse_spanish_number(row[12]) if len(row) > 12 else None,
            'return_25y': parse_spanish_number(row[13]) if len(row) > 13 else None,
            'participes': parse_spanish_number(row[14]) if len(row) > 14 else None,
            'subs_month': parse_spanish_number(row[15]) if len(row) > 15 else None,
            'subs_year': parse_spanish_number(row[16]) if len(row) > 16 else None,
            'redemp_month': parse_spanish_number(row[17]) if len(row) > 17 else None,
            'redemp_year': parse_spanish_number(row[18]) if len(row) > 18 else None,
            'net_subs_month': parse_spanish_number(row[19]) if len(row) > 19 else None,
            'net_subs_year': parse_spanish_number(row[20]) if len(row) > 20 else None,
            'patrimonio': parse_spanish_number(row[21]) if len(row) > 21 else None,
            'var_patrim_month': parse_spanish_number(row[22]) if len(row) > 22 else None,
            'var_patrim_year': parse_spanish_number(row[23]) if len(row) > 23 else None,
            'grupo': row[24].strip() if len(row) > 24 else '',
            'cod_gestora': row[25].strip() if len(row) > 25 else '',
            'gestora': row[26].strip() if len(row) > 26 else '',
        }
        results.append(record)
    return results


def parse_all_categories(folder):
    """Parse all category files from a snapshot. Returns dict of category -> fund list."""
    all_funds = {}
    for file_num, cat_name in CATEGORY_FILE_MAP.items():
        funds = parse_single_category(folder, file_num)
        if funds:
            all_funds[cat_name] = funds
    return all_funds
