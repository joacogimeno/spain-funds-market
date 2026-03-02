"""Parse CNMV Estadisticas Anexo A2.2 — individual fund fees and expenses."""
import os
import openpyxl
from ..config import find_cnmv_file


# Vocación inversora code -> readable category name
VOCACION_MAP = {
    'M': 'Monetarios',
    'MCP': 'Monetarios CP',
    'RFECP': 'RF Euro CP',
    'RFE': 'RF Euro LP',
    'RFME': 'RF Mixta Euro',
    'RVME': 'RV Mixta Euro',
    'RVE': 'RV Euro',
    'RVI': 'RV Internacional',
    'RFMI': 'RF Mixta Internacional',
    'RVMI': 'RV Mixta Internacional',
    'FGL': 'Globales',
    'GRF': 'Garantizados RF',
    'GRV': 'Garantizados RV',
    'IND': 'Fondos Índice',
    'RA': 'Retorno Absoluto',
    'OCRNG': 'Objetivo Rentabilidad',
    'RFI': 'RF Internacional',
}


def parse_cnmv_fees(cnmv_dir):
    """Parse Anexo A2.2 sheet for individual fund fees.

    Returns list of dicts, one per share class, with:
      grupo, gestora, fund_name, vocacion, category,
      expenses_k (thousands €), ter (% expenses/avg AUM),
      investors, share_class, isin, currency, patrimonio_k (thousands €),
      mgmt_fee_aum (%), mgmt_fee_returns (%),
      sub_fee_max (%), sub_fee_min (%),
      redemp_fee_max (%), redemp_fee_min (%),
      depositary_fee (%),
      discount_max (%), discount_min (%)
    """
    filepath, _ = find_cnmv_file(cnmv_dir, 'Anexo')
    if filepath is None:
        print(f"  Warning: No CNMV Anexo file found in {cnmv_dir}")
        return []

    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb['A2.2']

    records = []
    current_grupo = ''
    current_gestora = ''
    current_fund = ''
    current_vocacion = ''
    current_expenses = None
    current_ter = None
    current_investors = None

    for row in ws.iter_rows(min_row=10, max_col=21, values_only=False):
        vals = {}
        for c in row:
            if hasattr(c, 'column') and c.column is not None:
                vals[c.column] = c.value

        # Skip empty rows
        if all(v is None or (isinstance(v, str) and not v.strip()) for v in vals.values()):
            continue

        col1 = str(vals.get(1, '') or '').strip()
        col3 = str(vals.get(3, '') or '').strip()

        # Skip Total/summary rows
        if col1.startswith('Total') or col1.startswith('TOTAL'):
            continue

        # Update grupo/gestora context
        if vals.get(1) and not col1.startswith('Total'):
            current_grupo = col1
        if vals.get(2):
            current_gestora = str(vals[2]).strip()

        # Fund-level row (col 3 = fund name)
        if col3 and col3 != '-':
            current_fund = col3
            current_vocacion = str(vals.get(5, '') or '').strip()
            current_expenses = _num(vals.get(6))
            current_ter = _num(vals.get(7))
            current_investors = _int(vals.get(8))
        else:
            # Compartment row: col3 empty but may have own vocacion/TER/investors
            # (e.g. "ABANCA GESTION / CONSERVADOR" in col4 with its own metrics)
            row_voc = str(vals.get(5, '') or '').strip()
            row_ter = _num(vals.get(7))
            row_inv = _int(vals.get(8))
            row_exp = _num(vals.get(6))
            if row_voc:
                current_vocacion = row_voc
            if row_ter is not None:
                current_ter = row_ter
            if row_inv:
                current_investors = row_inv
            if row_exp is not None:
                current_expenses = row_exp

        # Share class data (col 10 = ISIN must exist)
        isin = str(vals.get(10, '') or '').strip()
        if not isin or len(isin) < 10:
            continue

        share_class = str(vals.get(9, '') or '').strip()
        if share_class == '-':
            share_class = ''

        record = {
            'grupo': current_grupo,
            'gestora': current_gestora,
            'fund_name': current_fund,
            'vocacion': current_vocacion,
            'category': VOCACION_MAP.get(current_vocacion, current_vocacion),
            'expenses_k': current_expenses,
            'ter': current_ter,
            'investors': current_investors,
            'share_class': share_class,
            'isin': isin,
            'currency': str(vals.get(11, '') or '').strip(),
            'patrimonio_k': _num(vals.get(12)),
            'mgmt_fee_aum': _num(vals.get(13)),
            'mgmt_fee_returns': _num(vals.get(14)),
            'sub_fee_max': _num(vals.get(15)),
            'sub_fee_min': _num(vals.get(16)),
            'redemp_fee_max': _num(vals.get(17)),
            'redemp_fee_min': _num(vals.get(18)),
            'depositary_fee': _num(vals.get(19)),
            'discount_max': _num(vals.get(20)),
            'discount_min': _num(vals.get(21)),
        }
        records.append(record)

    wb.close()
    return records


def _num(val):
    """Convert to float, returning None if not numeric."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).strip().replace(',', '.'))
    except (ValueError, TypeError):
        return None


def _int(val):
    """Convert to int, returning 0 if not numeric."""
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return int(val)
    try:
        return int(str(val).strip().replace('.', '').replace(',', ''))
    except (ValueError, TypeError):
        return 0
