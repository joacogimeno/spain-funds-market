"""Parse CNMV Estadisticas Anexo A1.1 — fund→gestora→depositario→grupo registry."""
import os
import openpyxl


def parse_cnmv_registry(cnmv_dir):
    """Parse Anexo A1.1 sheet for fund-to-depositario mapping.

    Returns list of dicts, one per share class, with:
      fund_name, compartimento, share_class, isin, gestora, depositario, grupo
    """
    filepath = os.path.join(cnmv_dir, 'Estadisticas_IIC_2025_3T_Anexo.xlsx')
    if not os.path.exists(filepath):
        print(f"  Warning: {filepath} not found")
        return []

    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb['A1.1']

    records = []
    current_fund = ''
    current_compartimento = ''

    for row in ws.iter_rows(min_row=8, max_col=7, values_only=False):
        vals = {}
        for c in row:
            if hasattr(c, 'column') and c.column is not None:
                vals[c.column] = c.value

        # Skip empty rows
        if all(v is None or (isinstance(v, str) and not v.strip()) for v in vals.values()):
            continue

        col1 = str(vals.get(1, '') or '').strip()

        # Skip Total/summary rows
        if col1.startswith('Total') or col1.startswith('TOTAL'):
            continue

        # Update fund context
        if col1 and col1 != '-':
            current_fund = col1

        comp = str(vals.get(2, '') or '').strip()
        if comp and comp != '-':
            current_compartimento = comp
        elif col1:
            current_compartimento = ''

        # ISIN must exist
        isin = str(vals.get(4, '') or '').strip()
        if not isin or len(isin) < 10:
            continue

        share_class = str(vals.get(3, '') or '').strip()
        if share_class == '-':
            share_class = ''

        gestora = str(vals.get(5, '') or '').strip()
        depositario = str(vals.get(6, '') or '').strip()
        grupo = str(vals.get(7, '') or '').strip()

        if not gestora or not depositario:
            continue

        records.append({
            'fund_name': current_fund,
            'compartimento': current_compartimento,
            'share_class': share_class,
            'isin': isin,
            'gestora': gestora,
            'depositario': depositario,
            'grupo': grupo,
        })

    wb.close()
    return records
