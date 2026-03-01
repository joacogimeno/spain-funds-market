"""Core Spanish CSV parser — handles semicolons, Spanish number format, encoding."""
import csv
import re
import os


def detect_encoding(filepath):
    """Detect file encoding by trying UTF-8-sig first, then latin-1."""
    for enc in ['utf-8-sig', 'latin-1']:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                f.read(500)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return 'latin-1'


def parse_spanish_number(text):
    """Parse Spanish-format number: 1.234.567,89 -> 1234567.89"""
    if text is None:
        return None
    text = text.strip()
    if text == '' or text == '-':
        return None
    # Remove dots (thousands separator), replace comma with dot (decimal)
    text = text.replace('.', '').replace(',', '.')
    try:
        return float(text)
    except ValueError:
        return None


def read_csv_rows(filepath, skip_rows=1, encoding=None):
    """Read a semicolon-delimited CSV, skipping metadata rows.

    Returns (headers, rows) where rows is list of lists.
    """
    if encoding is None:
        encoding = detect_encoding(filepath)
    with open(filepath, 'r', encoding=encoding) as f:
        lines = f.readlines()

    # Strip BOM if present
    if lines and lines[0].startswith('\ufeff'):
        lines[0] = lines[0][1:]

    # Skip metadata rows
    data_lines = lines[skip_rows:]
    if not data_lines:
        return [], []

    reader = csv.reader(data_lines, delimiter=';')
    all_rows = list(reader)
    if not all_rows:
        return [], []

    headers = [h.strip() for h in all_rows[0]]
    rows = all_rows[1:]
    return headers, rows


def read_time_series_csv(filepath, encoding=None):
    """Parse historical time series CSV (01, 02, 05, 06, 11, 12 files).

    Returns list of dicts with 'date' and category columns (numeric).
    """
    headers, rows = read_csv_rows(filepath, skip_rows=1, encoding=encoding)
    if not headers:
        return []

    results = []
    for row in rows:
        if not row or len(row) < 2:
            continue
        date_str = row[0].strip()
        # Skip summary/variation rows
        if not date_str or 'Variaci' in date_str or 'variaci' in date_str:
            continue
        # Parse date DD-MM-YYYY or DD/MM/YYYY
        m = re.match(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', date_str)
        if not m:
            continue
        dd, mm, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
        record = {'date': f"{yyyy}-{mm:02d}", 'year': yyyy, 'month': mm}
        for i, h in enumerate(headers[1:], 1):
            if i < len(row) and h and h.strip():
                key = h.strip()
                # Skip empty/variation columns
                if 'Variaci' in key or key == '' or key == 'Total patrimonio' or key == 'Total partícipes' or key == 'Total número fondos':
                    if 'Total' in key:
                        val = parse_spanish_number(row[i])
                        if val is not None:
                            record['total'] = val
                    continue
                val = parse_spanish_number(row[i])
                if val is not None:
                    record[key] = val
        # Compute total if not present
        if 'total' not in record:
            total = sum(v for k, v in record.items() if isinstance(v, (int, float)) and k not in ('year', 'month'))
            if total > 0:
                record['total'] = total
        results.append(record)
    return results


def find_file(folder, pattern):
    """Find a file in folder matching a pattern (number prefix like '01-')."""
    datos_dir = os.path.join(folder, "Datos Generales")
    if not os.path.isdir(datos_dir):
        return None
    for name in os.listdir(datos_dir):
        # Match pattern like "01-PatrimFondos" in filename
        if pattern in name and name.endswith('.csv'):
            return os.path.join(datos_dir, name)
    return None


def find_category_file(folder, file_num):
    """Find a category file by number (19-45)."""
    cat_dir = os.path.join(folder, "Categorias Fondos")
    if not os.path.isdir(cat_dir):
        return None
    pattern = f"_{file_num:02d}-" if file_num < 100 else f"_{file_num}-"
    for name in os.listdir(cat_dir):
        if pattern in name and (name.endswith('.csv') or name.endswith('.CSV')):
            return os.path.join(cat_dir, name)
    return None
